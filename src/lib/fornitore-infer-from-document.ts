import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSenderEmailCanonical } from '@/lib/sender-email'
import { resolveFornitoreFromScanEmail, resolveFornitoreByEmailDomain } from '@/lib/fornitore-resolve-scan-email'
import type { OcrResult } from '@/lib/ocr-invoice'
import {
  extractSupplierFieldsFromEmailBody,
  crossCheckSupplierFields,
  compareRagioneSociale,
  tokenOverlapRatio,
  normalizeRagioneSocialeForComparison,
} from '@/lib/fornitore-cross-check'

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

export type InferredFornitoreSource = 'email' | 'piva' | 'ragione_sociale' | 'rekki_supplier' | 'cross_check'

export type InferredFornitoreAfterOcr = {
  fornitore: FornitoreInferRow
  source: InferredFornitoreSource
}

function vatDigits(s: string | null | undefined): string | null {
  const d = String(s ?? '').replace(/\D/g, '')
  if (d.length < 9) return null
  return d
}

function pivaNormalizedMatch(dbPiva: string | null | undefined, ocrDigits: string): boolean {
  const db = vatDigits(dbPiva)
  if (!db || !ocrDigits) return false
  if (db === ocrDigits) return true
  const short = Math.min(11, Math.min(db.length, ocrDigits.length))
  if (short < 9) return false
  return db.slice(-short) === ocrDigits.slice(-short)
}

/**
 * Dopo OCR: prova email mittente -> P.IVA -> cross-check corpo mail ->
 *     dominio email -> ragione sociale parziale -> rekki da metadata.
 *
 * Aggiunto parametro `emailBodyText` per confronto incrociato tra dati
 * della mail e dell'OCR documento.
 */
export async function inferFornitoreAfterOcr(
  supabase: SupabaseClient,
  ocr: OcrResult,
  row: {
    mittente: string | null | undefined
    sede_id: string | null | undefined
    metadata: Record<string, unknown> | null | undefined
    emailBodyText?: string | null | undefined
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
    const found = await findFornitoreByPiva(supabase, ocrDig, sedeFilter)
    if (found) return { fornitore: found, source: 'piva' }
  }

  if (row.emailBodyText?.trim()) {
    const emailFields = extractSupplierFieldsFromEmailBody(row.emailBodyText)
    const crossCheck = crossCheckSupplierFields(emailFields, ocr)

    if (crossCheck.confirmed && crossCheck.confidence >= 60) {
      const nomeCandidato = emailFields.ragione_sociale || ocr.ragione_sociale
      if (nomeCandidato) {
        const found = await findFornitoreByNameAndPiva(
          supabase, nomeCandidato, emailFields.p_iva || ocr.p_iva, sedeFilter,
        )
        if (found) return { fornitore: found, source: 'cross_check' }

        const foundByName = await resolveFornitoreByPartialNameEnhanced(
          supabase, nomeCandidato, sedeFilter,
        )
        if (foundByName) return { fornitore: foundByName, source: 'cross_check' }
      }
    }
  }

  if (emNorm?.includes('@')) {
    const byDomain = await resolveFornitoreByEmailDomain(supabase, emNorm, sedeFilter)
    if (byDomain && byDomain !== 'ambiguous') {
      return { fornitore: byDomain as FornitoreInferRow, source: 'email' }
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

  const partial = await resolveFornitoreByPartialNameEnhanced(supabase, ocr.ragione_sociale, sedeFilter)
  if (partial?.id) return { fornitore: partial, source: 'ragione_sociale' }

  return null
}

async function findFornitoreByPiva(
  supabase: SupabaseClient,
  ocrDigits: string,
  sedeFilter?: string | null,
): Promise<FornitoreInferRow | null> {
  let q = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email, piva')
    .limit(500)
  if (sedeFilter) q = q.eq('sede_id', sedeFilter) as typeof q
  const { data } = await q
  for (const r of data ?? []) {
    const fr = r as FornitoreInferRow
    if (fr.piva && pivaNormalizedMatch(fr.piva, ocrDigits)) {
      return fr
    }
  }
  return null
}

async function findFornitoreByNameAndPiva(
  supabase: SupabaseClient,
  nome: string,
  pIva: string | null | undefined,
  sedeFilter?: string | null,
): Promise<FornitoreInferRow | null> {
  const norm = normalizeRagioneSocialeForComparison(nome)
  const tokens = norm.split(/\s+/).filter(t => t.length >= 4).slice(0, 3)
  if (!tokens.length) return null

  let q = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email, piva')
    .limit(200)
  if (sedeFilter) q = q.eq('sede_id', sedeFilter) as typeof q

  if (pIva) {
    const digPiva = vatDigits(pIva)
    if (digPiva) {
      let pQ = supabase
        .from('fornitori')
        .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email, piva')
        .limit(200)
      if (sedeFilter) pQ = pQ.eq('sede_id', sedeFilter) as typeof pQ
      const { data: pData } = await pQ
      for (const r of pData ?? []) {
        const fr = r as FornitoreInferRow
        if (fr.piva && pivaNormalizedMatch(fr.piva, digPiva)) {
          const nameOverlap = tokenOverlapRatio(fr.nome, nome)
          if (nameOverlap >= 0.25) return fr
        }
      }
    }
  }

  const { data } = await q
  for (const r of data ?? []) {
    const fr = r as FornitoreInferRow
    const matchLevel = compareRagioneSociale(fr.nome, nome)
    if (matchLevel === 'exact' || matchLevel === 'strong') return fr
    if (matchLevel === 'partial') {
      const overlap = tokenOverlapRatio(fr.nome, nome)
      if (overlap >= 0.5) return fr
    }
  }
  return null
}

export async function resolveFornitoreByPartialNameEnhanced(
  supabase: SupabaseClient,
  ragioneSociale: string | null | undefined,
  sedeFilter?: string | null
): Promise<FornitoreInferRow | null> {
  const raw = (ragioneSociale ?? '').trim()
  if (raw.length < 4) return null

  const maxTokens = raw
    .toUpperCase()
    .split(/[\s,.\-\/]+/g)
    .map((t) => t.replace(/[^A-Z0-9À-ÿ]/g, ''))
    .filter((t) => t.length >= 4)
  if (!maxTokens.length) return null

  const allSuppliers: FornitoreInferRow[] = []
  for (const tok of maxTokens.slice(0, 8)) {
    let q = supabase
      .from('fornitori')
      .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
      .ilike('nome', `%${tok}%`)
      .limit(10)
    if (sedeFilter) q = q.eq('sede_id', sedeFilter)
    const { data, error } = await q
    if (error || !data?.length) continue
    for (const r of data) {
      allSuppliers.push(r as FornitoreInferRow)
    }
  }

  if (!allSuppliers.length) return null

  const scored = allSuppliers.map(s => ({
    supplier: s,
    score: tokenOverlapRatio(s.nome, raw),
  }))
  scored.sort((a, b) => b.score - a.score)

  if (scored[0].score >= 0.4) return scored[0].supplier
  if (scored[0].score >= 0.2 && scored.length === 1) return scored[0].supplier

  return null
}

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
