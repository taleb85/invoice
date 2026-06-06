import type { SupabaseClient } from '@supabase/supabase-js'

/** Se `fornitori.email` è vuota, la imposta con il primo alias registrato (sync / anagrafica). */
export async function promotePrimaryFornitoreEmailIfEmpty(
  supabase: SupabaseClient,
  fornitoreId: string,
  email: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!normalized.includes('@')) return false

  const { data: row } = await supabase
    .from('fornitori')
    .select('email')
    .eq('id', fornitoreId)
    .maybeSingle()

  const current = row?.email?.trim().toLowerCase()
  if (current) return false

  const { error } = await supabase
    .from('fornitori')
    .update({ email: normalized })
    .eq('id', fornitoreId)
    .is('email', null)

  if (error) {
    // Race: un altro alias può aver già riempito email primaria.
    if (error.code === '23505') return false
    throw error
  }

  return true
}
