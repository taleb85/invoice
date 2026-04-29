import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSenderEmailCanonical } from '@/lib/sender-email'
import { resolveFornitoreFromScanEmail } from '@/lib/fornitore-resolve-scan-email'
import type { OcrResult } from '@/lib/ocr-invoice'

export type FornitoreInferRow = {
  id: string
  nome: string
  sede_id: string | null
  language: string | null
  rekki_link: string | null
  rekki_supplier_id: string | null
  email: string | null
  piva?: string | null
}

/** Origine dell’abbinamento dopo OCR (mittente → P.IV.A → nome → Rekki da metadata). */
export type InferredFornitoreSource = 'email' | 'piva' | 'ragione_sociale' | 'rekki_supplier'

export type InferredFornitoreAfterOcr = {
  fornitore: FornitoreInferRow
  source: InferredFornitoreSource
}

function vatDigits(s: string | null | undefined): string | null {
  const d = String(s ?? '').replace(/\D/g, '')
  if (d.length < 9) return null
  return d
}

/** Confronto flessibile tra P.IV.A in anagrafica e valore OCR (prefissi IT, spazi). */
function pivaNormalizedMatch(dbPiva: string | null | undefined, ocrDigits: string): boolean {
  const db = vatDigits(dbPiva)
  if (!db || !ocrDigits) return false
  if (db === ocrDigits) return true
  const short = Math.min(11, Math.min(db.length, ocrDigits.length))
  if (short < 9) return false
  return db.slice(-short) === ocrDigits.slice(-short)
}

/** Dopo OCR: prova mittente → P.IV.A su rubrica sede → ragione sociale parziale → rekki da metadata allegato. */
export async function inferFornitoreAfterOcr(
  supabase: SupabaseClient,
  ocr: OcrResult,
  row: {
    mittente: string | null | undefined
    sede_id: string | null | undefined
    metadata: Record<string, unknown> | null | undefined
  },
): Promise<InferredFornitoreAfterOcr | null> {
  const sedeFilter = row.sede_id?.trim() || null

  const emNorm = normalizeSenderEmailCanonical(row.mittente ?? null)
  if (emNorm?.includes('@')) {
    const fromEmail = await resolveFornitoreFromScanEmail(supabase, emNorm, sedeFilter)
    if (fromEmail?.id) return { fornitore: fromEmail as FornitoreInferRow, source: 'email' }
  }

  const ocrDig = vatDigits(ocr.p_iva ?? ocr.piva)
  if (ocrDig) {
    let q = supabase
      .from('fornitori')
      .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email, piva')
      .limit(500)
    if (sedeFilter) q = q.eq('sede_id', sedeFilter) as typeof q
    const { data } = await q
    for (const r of data ?? []) {
      const fr = r as FornitoreInferRow
      if (fr.piva && pivaNormalizedMatch(fr.piva, ocrDig)) {
        return { fornitore: fr, source: 'piva' }
      }
    }
  }

  const meta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {}
  const rekMeta =
    typeof meta.rekki_supplier_id === 'string'
      ? meta.rekki_supplier_id.trim()
      : ''
  if (rekMeta.length >= 2) {
    const rek = await resolveFornitoreByRekkiSupplierId(supabase, rekMeta, sedeFilter)
    if (rek?.id) return { fornitore: rek, source: 'rekki_supplier' }
  }

  const partial = await resolveFornitoreByPartialName(supabase, ocr.ragione_sociale, sedeFilter)
  if (partial?.id) return { fornitore: partial, source: 'ragione_sociale' }

  return null
}

/**
 * Match fornitore per ragione sociale parziale (token lunghi dal documento).
 * Usato dopo P.IVA quando il mittente email non è riconosciuto.
 */
export async function resolveFornitoreByPartialName(
  supabase: SupabaseClient,
  ragioneSociale: string | null | undefined,
  sedeFilter?: string | null
): Promise<FornitoreInferRow | null> {
  const raw = (ragioneSociale ?? '').trim()
  if (raw.length < 4) return null
  const tokens = raw
    .toUpperCase()
    .split(/[\s,.\-\/]+/g)
    .map((t) => t.replace(/[^A-Z0-9]/g, ''))
    .filter((t) => t.length >= 4)
    .slice(0, 4)
  if (!tokens.length) return null

  for (const tok of tokens) {
    let q = supabase
      .from('fornitori')
      .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
      .ilike('nome', `%${tok}%`)
      .limit(1)
    if (sedeFilter) q = q.eq('sede_id', sedeFilter)
    const { data, error } = await q
    if (error || !data?.length) continue
    return data[0] as FornitoreInferRow
  }
  return null
}

/** Match su `fornitori.rekki_supplier_id` (es. da metadati allegato / parser Rekki). */
export async function resolveFornitoreByRekkiSupplierId(
  supabase: SupabaseClient,
  rekkiSupplierId: string | null | undefined,
  sedeFilter?: string | null
): Promise<FornitoreInferRow | null> {
  const id = (rekkiSupplierId ?? '').trim()
  if (id.length < 2) return null
  let q = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .eq('rekki_supplier_id', id)
    .limit(1)
  if (sedeFilter) q = q.eq('sede_id', sedeFilter)
  const { data, error } = await q
  if (error || !data?.length) return null
  return data[0] as FornitoreInferRow
}
