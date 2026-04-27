import type { SupabaseClient } from '@supabase/supabase-js'

export type SedeSupplierSuggestion = {
  displayName: string
  newFornitoreHref: string
  importHref: string
} | null

type DocMeta = {
  ragione_sociale?: string | null
  p_iva?: string | null
  indirizzo?: string | null
} | null

type FornitoreRow = {
  id: string
  nome: string
  piva: string | null
  email: string | null
  display_name: string | null
}

function normalizePivaDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Chiave stabile per confrontare ragioni sociali (spazi, punteggiatura, maiuscole). */
function normalizeSupplierNameKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normEmail(s: string | null | undefined): string | null {
  const t = s?.trim().toLowerCase()
  return t && t.includes('@') ? t : null
}

/**
 * True se in sede esiste già un fornitore che corrisponde ai dati OCR / mittente
 * (evita banner dopo creazione fornitore mentre il documento resta in coda senza fornitore_id).
 */
function existingFornitoreMatchesDoc(
  fornitori: FornitoreRow[],
  aliasEmailsLower: Set<string>,
  meta: DocMeta,
  mittente: string | null | undefined,
): boolean {
  const pMeta = meta?.p_iva?.trim() ? normalizePivaDigits(meta.p_iva) : ''
  const rsMeta = meta?.ragione_sociale?.trim() ?? ''
  const rsKey = rsMeta.length >= 2 ? normalizeSupplierNameKey(rsMeta) : ''
  const mitt = normEmail(mittente ?? undefined)

  for (const f of fornitori) {
    if (pMeta.length >= 5) {
      const pf = f.piva ? normalizePivaDigits(f.piva) : ''
      if (pf && pf === pMeta) return true
    }
    if (rsKey.length >= 3) {
      if (normalizeSupplierNameKey(f.nome) === rsKey) return true
      if (f.display_name?.trim() && normalizeSupplierNameKey(f.display_name) === rsKey) return true
    }
    const fe = normEmail(f.email ?? undefined)
    if (mitt && fe && fe === mitt) return true
    if (mitt && aliasEmailsLower.has(mitt)) return true
  }
  return false
}

function buildSuggestionFromRow(row: { metadata: unknown; mittente: string | null }): SedeSupplierSuggestion {
  const m = row.metadata as DocMeta
  const nome = m?.ragione_sociale?.trim() || m?.p_iva?.trim() || 'Fornitore'
  const displayName = nome.length > 72 ? `${nome.slice(0, 72)}…` : nome

  const q = new URLSearchParams()
  if (m?.ragione_sociale?.trim()) q.set('prefill_nome', m.ragione_sociale.trim())
  if (m?.p_iva?.trim()) q.set('prefill_piva', m.p_iva.trim())
  if (m?.indirizzo?.trim()) q.set('prefill_indirizzo', m.indirizzo.trim())
  const mitt = row.mittente?.trim()
  if (mitt?.includes('@')) q.set('prefill_email', mitt.toLowerCase())
  const qs = q.toString()

  return {
    displayName,
    newFornitoreHref: `/fornitori/new?${qs}`,
    importHref: `/fornitori/import?${qs}`,
  }
}

/**
 * Primo documento in coda (sede) senza fornitore ma con hint OCR — per banner dashboard operatore.
 * Non propone il fornitore se ne esiste già uno in sede con stessa P.IVA, ragione sociale (normalizzata)
 * o email mittente (profilo o alias).
 */
export async function fetchSedeSupplierSuggestion(
  supabase: SupabaseClient,
  sedeId: string
): Promise<SedeSupplierSuggestion> {
  const [{ data, error }, { data: fornitoriRows, error: fornErr }] = await Promise.all([
    supabase
      .from('documenti_da_processare')
      .select('metadata, mittente')
      .eq('sede_id', sedeId)
      .is('fornitore_id', null)
      .in('stato', ['da_associare', 'in_attesa'])
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('fornitori').select('id, nome, piva, email, display_name').eq('sede_id', sedeId),
  ])

  if (error || !data?.length) return null
  if (fornErr) return null

  const fornitori = (fornitoriRows ?? []) as FornitoreRow[]
  const fornitoreIds = fornitori.map((f) => f.id)
  let aliasEmailsLower = new Set<string>()
  if (fornitoreIds.length > 0) {
    const { data: aliases } = await supabase.from('fornitore_emails').select('email').in('fornitore_id', fornitoreIds)
    aliasEmailsLower = new Set(
      (aliases ?? [])
        .map((a: { email: string }) => a.email?.trim().toLowerCase())
        .filter((e): e is string => !!e?.includes('@')),
    )
  }

  for (const d of data) {
    const m = d.metadata as DocMeta
    if (!(m?.ragione_sociale?.trim() || m?.p_iva?.trim())) continue
    if (existingFornitoreMatchesDoc(fornitori, aliasEmailsLower, m, d.mittente)) continue
    return buildSuggestionFromRow(d)
  }

  return null
}
