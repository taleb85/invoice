import type { SupabaseClient } from '@supabase/supabase-js'

export type FornitoreInferRow = {
  id: string
  nome: string
  sede_id: string | null
  language: string | null
  rekki_link: string | null
  rekki_supplier_id: string | null
  email: string | null
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
