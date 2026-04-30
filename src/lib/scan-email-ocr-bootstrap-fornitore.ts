import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSenderEmailCanonical } from '@/lib/sender-email'
import { senderAlreadyLinkedToFornitore } from '@/lib/mittente-fornitore-assoc'
import {
  resolveFornitoreByEmailDomain,
  resolveFornitoreFromScanEmail,
  type FornitoreScanRow,
} from '@/lib/fornitore-resolve-scan-email'
import { resolveFornitoreByPartialName } from '@/lib/fornitore-infer-from-document'

/** Stesso subset usato in scan-emails `Fornitore`. */
export type FornitoreScanFullRow = {
  id: string
  nome: string
  sede_id: string | null
  language?: string | null
  rekki_link?: string | null
  rekki_supplier_id?: string | null
  email?: string | null
}

export async function loadSedeBuyerIgnoreNames(
  supabase: SupabaseClient,
  sedeId: string | null,
): Promise<string[]> {
  if (!sedeId?.trim()) return []
  const { data, error } = await supabase
    .from('sedi')
    .select('nomi_cliente_da_ignorare')
    .eq('id', sedeId.trim())
    .maybeSingle()
  if (error || !data) return []
  const raw = data.nomi_cliente_da_ignorare as unknown
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

export function ragioneSocialeIsIgnoredBuyer(rs: string, ignoreList: string[]): boolean {
  const n = rs.trim().toLowerCase()
  if (!n) return false
  for (const ig of ignoreList) {
    const g = ig.trim().toLowerCase()
    if (!g) continue
    if (n.includes(g) || g.includes(n)) return true
  }
  return false
}

function escapeIlikeMetachars(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

async function findFornitoreByNomeIlike(
  supabase: SupabaseClient,
  ragioneSociale: string,
  sedeId: string | null,
): Promise<'none' | 'ambiguous' | { row: FornitoreScanRow }> {
  const raw = ragioneSociale.trim()
  if (raw.length < 2) return 'none'
  const pattern = `%${escapeIlikeMetachars(raw)}%`
  let q = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .ilike('nome', pattern)
    .limit(5)
  if (sedeId) q = q.eq('sede_id', sedeId)
  const { data, error } = await q
  if (error || !data?.length) return 'none'
  if (data.length > 1) return 'ambiguous'
  return { row: data[0] as FornitoreScanRow }
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

async function findFornitoreByOcrPiva(
  supabase: SupabaseClient,
  pivaRaw: string | null | undefined,
  sedeId: string | null,
): Promise<FornitoreScanRow | 'ambiguous' | null> {
  const ocrDig = vatDigits(pivaRaw)
  if (!ocrDig) return null
  let q = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email, piva')
    .limit(800)
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
  const { data, error } = await q
  if (error) return null
  const matches: FornitoreScanRow[] = []
  for (const r of data ?? []) {
    const fr = r as FornitoreScanRow & { piva?: string | null }
    if (pivaNormalizedMatch(fr.piva, ocrDig)) {
      matches.push({
        id: fr.id,
        nome: fr.nome,
        sede_id: fr.sede_id,
        language: fr.language,
        rekki_link: fr.rekki_link,
        rekki_supplier_id: fr.rekki_supplier_id,
        email: fr.email,
      })
    }
  }
  if (matches.length === 0) return null
  if (matches.length > 1) return 'ambiguous'
  return matches[0] ?? null
}

export async function fetchFullFornitoreForScan(
  supabase: SupabaseClient,
  fornitoreId: string,
): Promise<FornitoreScanFullRow | null> {
  const { data, error } = await supabase
    .from('fornitori')
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .eq('id', fornitoreId.trim())
    .maybeSingle()
  if (error || !data) return null
  return data as FornitoreScanFullRow
}

async function createFornitoreFromOcrRagione(
  supabase: SupabaseClient,
  opts: { nome: string; sedeId: string | null; piva: string | null },
): Promise<FornitoreScanRow | null> {
  const nome = opts.nome.trim()
  if (nome.length < 2 || !opts.sedeId?.trim()) return null
  const row: Record<string, unknown> = {
    nome,
    sede_id: opts.sedeId.trim(),
  }
  const digits = String(opts.piva ?? '').replace(/\D/g, '')
  if (digits.length >= 9) row.piva = opts.piva?.trim() ?? digits

  const { data, error } = await supabase
    .from('fornitori')
    .insert([row])
    .select('id, nome, sede_id, language, rekki_link, rekki_supplier_id, email')
    .maybeSingle()
  if (error || !data) {
    console.warn('[createFornitoreFromOcrRagione]', error?.message)
    return null
  }
  return data as FornitoreScanRow
}

export async function linkScanSenderToFornitore(
  supabase: SupabaseClient,
  fornitoreId: string,
  rawFromHeader: string,
): Promise<void> {
  const em = normalizeSenderEmailCanonical(rawFromHeader)
  if (!em?.includes('@')) return
  if (await senderAlreadyLinkedToFornitore(supabase, em, fornitoreId)) return
  const { error } = await supabase.from('fornitore_emails').insert([
    { fornitore_id: fornitoreId, email: em, label: 'Scan OCR ragione sociale' },
  ])
  if (error && error.code !== '23505') {
    console.warn('[linkScanSenderToFornitore]', error.message)
  }
}

export type OcrRagioneBootstrapResult =
  | { kind: 'none' }
  | { kind: 'ignored_buyer' }
  | { kind: 'ambiguous_match' }
  | { kind: 'resolved'; fornitore: FornitoreScanRow; created: boolean }

/**
 * Dopo OCR su mittente non in rubrica: abbina fornitore senza duplicare.
 * Ordine: email esatta (fornitore_emails + primaria) → dominio email (non generico)
 * → (se c’è ragione sociale OCR) ignora anagrafica cliente → P.IV.A → token nome (fuzzy)
 * → ILIKE nome pieno → crea.
 */
export async function tryBootstrapFornitoreFromOcrRagione(
  supabase: SupabaseClient,
  ocr: { ragione_sociale?: string | null; p_iva?: string | null; piva?: string | null },
  sedeId: string | null,
  mittenteRaw?: string | null,
): Promise<OcrRagioneBootstrapResult> {
  if (!sedeId?.trim()) return { kind: 'none' }
  const sede = sedeId.trim()

  const emNorm = normalizeSenderEmailCanonical(mittenteRaw ?? null)
  if (emNorm?.includes('@')) {
    const exact = await resolveFornitoreFromScanEmail(supabase, emNorm, sede)
    if (exact?.id) return { kind: 'resolved', fornitore: exact, created: false }

    const domRes = await resolveFornitoreByEmailDomain(supabase, emNorm, sede)
    if (domRes === 'ambiguous') return { kind: 'ambiguous_match' }
    if (domRes?.id) return { kind: 'resolved', fornitore: domRes, created: false }
  }

  const rs = ocr.ragione_sociale?.trim() ?? ''

  if (!rs) {
    const pivaOnly = await findFornitoreByOcrPiva(supabase, ocr.p_iva ?? ocr.piva, sede)
    if (pivaOnly === 'ambiguous') return { kind: 'ambiguous_match' }
    if (pivaOnly?.id) return { kind: 'resolved', fornitore: pivaOnly, created: false }
    return { kind: 'none' }
  }

  const ignore = await loadSedeBuyerIgnoreNames(supabase, sede)
  if (ragioneSocialeIsIgnoredBuyer(rs, ignore)) return { kind: 'ignored_buyer' }

  const pivaHit = await findFornitoreByOcrPiva(supabase, ocr.p_iva ?? ocr.piva, sede)
  if (pivaHit === 'ambiguous') return { kind: 'ambiguous_match' }
  if (pivaHit?.id) return { kind: 'resolved', fornitore: pivaHit, created: false }

  const partial = await resolveFornitoreByPartialName(supabase, rs, sede)
  if (partial?.id) return { kind: 'resolved', fornitore: partial as FornitoreScanRow, created: false }

  const ilike = await findFornitoreByNomeIlike(supabase, rs, sede)
  if (ilike === 'ambiguous') return { kind: 'ambiguous_match' }
  if (ilike !== 'none' && 'row' in ilike) {
    return { kind: 'resolved', fornitore: ilike.row, created: false }
  }

  const created = await createFornitoreFromOcrRagione(supabase, {
    nome: rs,
    sedeId,
    piva: ocr.p_iva ?? ocr.piva ?? null,
  })
  if (created) {
    return { kind: 'resolved', fornitore: created, created: true }
  }
  return { kind: 'none' }
}
