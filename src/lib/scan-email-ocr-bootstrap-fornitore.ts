import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeSenderEmailCanonical } from '@/lib/sender-email'
import { senderAlreadyLinkedToFornitore } from '@/lib/mittente-fornitore-assoc'
import type { FornitoreScanRow } from '@/lib/fornitore-resolve-scan-email'

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
    .limit(3)
  if (sedeId) q = q.eq('sede_id', sedeId)
  const { data, error } = await q
  if (error || !data?.length) return 'none'
  if (data.length > 1) return 'ambiguous'
  return { row: data[0] as FornitoreScanRow }
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
 * Dopo OCR su mittente sconosciuto: usa ragione sociale estratta per abbinare/creare fornitore nella sede.
 */
export async function tryBootstrapFornitoreFromOcrRagione(
  supabase: SupabaseClient,
  ocr: { ragione_sociale?: string | null; p_iva?: string | null },
  sedeId: string | null,
): Promise<OcrRagioneBootstrapResult> {
  const rs = ocr.ragione_sociale?.trim() ?? ''
  if (!rs) return { kind: 'none' }
  if (!sedeId?.trim()) return { kind: 'none' }

  const ignore = await loadSedeBuyerIgnoreNames(supabase, sedeId)
  if (ragioneSocialeIsIgnoredBuyer(rs, ignore)) return { kind: 'ignored_buyer' }

  const found = await findFornitoreByNomeIlike(supabase, rs, sedeId)
  if (found === 'ambiguous') return { kind: 'ambiguous_match' }
  if (found !== 'none' && 'row' in found) {
    return { kind: 'resolved', fornitore: found.row, created: false }
  }

  const created = await createFornitoreFromOcrRagione(supabase, {
    nome: rs,
    sedeId,
    piva: ocr.p_iva ?? null,
  })
  if (created) {
    return { kind: 'resolved', fornitore: created, created: true }
  }
  return { kind: 'none' }
}
