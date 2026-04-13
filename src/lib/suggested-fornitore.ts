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

/**
 * Primo documento in coda (sede) senza fornitore ma con hint OCR — per banner dashboard operatore.
 */
export async function fetchSedeSupplierSuggestion(
  supabase: SupabaseClient,
  sedeId: string
): Promise<SedeSupplierSuggestion> {
  const { data, error } = await supabase
    .from('documenti_da_processare')
    .select('metadata, mittente')
    .eq('sede_id', sedeId)
    .is('fornitore_id', null)
    .in('stato', ['da_associare', 'in_attesa'])
    .order('created_at', { ascending: false })
    .limit(12)

  if (error || !data?.length) return null

  const row = data.find((d) => {
    const m = d.metadata as DocMeta
    return !!(m?.ragione_sociale?.trim() || m?.p_iva?.trim())
  })
  if (!row) return null

  const m = row.metadata as DocMeta
  const nome = m?.ragione_sociale?.trim() || m?.p_iva?.trim() || 'Fornitore'
  const displayName = nome.length > 72 ? `${nome.slice(0, 72)}…` : nome

  const qNew = new URLSearchParams()
  if (m?.ragione_sociale?.trim()) qNew.set('prefill_nome', m.ragione_sociale.trim())
  if (m?.p_iva?.trim()) qNew.set('prefill_piva', m.p_iva.trim())
  if (m?.indirizzo?.trim()) qNew.set('prefill_indirizzo', m.indirizzo.trim())
  const mitt = row.mittente?.trim()
  if (mitt?.includes('@')) qNew.set('prefill_email', mitt.toLowerCase())

  const qImp = new URLSearchParams()
  if (m?.ragione_sociale?.trim()) qImp.set('prefill_nome', m.ragione_sociale.trim())
  if (m?.p_iva?.trim()) qImp.set('prefill_piva', m.p_iva.trim())
  if (mitt?.includes('@')) qImp.set('prefill_email', mitt.toLowerCase())

  return {
    displayName,
    newFornitoreHref: `/fornitori/new?${qNew.toString()}`,
    importHref: `/fornitori/import?${qImp.toString()}`,
  }
}
