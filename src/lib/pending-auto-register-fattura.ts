import { parseAnyAmount } from '@/lib/ocr-amount'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

/** Values stored in metadata from email scan supplier matching — excludes unknown/manual. */
const CONFIDENT_MATCHED_BY = new Set([
  'email',
  'alias',
  'domain',
  'piva',
  'ragione_sociale',
  'rekki_supplier',
])

type MetaLike = {
  tipo_documento?: unknown
  totale_iva_inclusa?: number | null
  importo_raw?: string | null
  formato_importo?: 'dot' | 'comma' | 'plain' | null
  matched_by?: string | null
  estrazione_utile?: boolean | null
}

const AMOUNT_EPS = 0.02

/** Re-parse `importo_raw` using `formato_importo`; must agree with persisted total (no ambiguous UK/EU ambiguity). */
export function invoiceImportParsesClean(metadata: MetaLike): boolean {
  const tot = metadata.totale_iva_inclusa
  if (tot === null || tot === undefined || !Number.isFinite(tot)) return false

  const raw = metadata.importo_raw?.trim()
  if (!raw) return true

  const stripped = raw.replace(/[£€$¥₹\s]/g, '').trim()
  const fmt = metadata.formato_importo ?? null
  let reparsed: number | null
  if (fmt === 'comma') {
    reparsed = parseAnyAmount(stripped.replace(/\./g, '').replace(',', '.'))
  } else if (fmt === 'dot') {
    reparsed = parseAnyAmount(stripped.replace(/,/g, ''))
  } else {
    reparsed = parseAnyAmount(stripped)
  }
  if (reparsed === null || !Number.isFinite(reparsed)) return false
  return Math.abs(reparsed - tot) < AMOUNT_EPS
}

/** OCR/route confidence: extraction useful + supplier routing not "unknown". */
export function invoiceOcrRouteConfidenceOk(metadata: MetaLike | null | undefined): boolean {
  if (!metadata || metadata.estrazione_utile === false) return false
  const mb = metadata.matched_by ?? 'unknown'
  if (mb === 'unknown' || mb === '') return false
  return CONFIDENT_MATCHED_BY.has(mb)
}

export function invoiceTipoClassifiedAsFattura(metadata: MetaLike | null | undefined): boolean {
  return normalizeTipoDocumento(metadata?.tipo_documento) === 'fattura'
}

export function shouldAutoRegisterPendingFattura(opts: {
  fornitoreId: string | null
  pendingKind: 'statement' | 'bolla' | 'fattura' | 'ordine' | null
  metadata: MetaLike | null | undefined
  openBolleSameSupplierCount: number
}): boolean {
  if (!opts.fornitoreId) return false
  if (opts.pendingKind !== 'fattura') return false
  if (!invoiceTipoClassifiedAsFattura(opts.metadata)) return false
  if (!invoiceOcrRouteConfidenceOk(opts.metadata)) return false
  if (!invoiceImportParsesClean(opts.metadata ?? {})) return false
  if (opts.openBolleSameSupplierCount > 0) return false
  return true
}
