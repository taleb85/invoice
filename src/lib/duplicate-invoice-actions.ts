import type { SupabaseClient } from '@supabase/supabase-js'

export type DuplicateTable = 'fatture' | 'bolle' | 'conferme_ordine'

/**
 * Elimina una riga duplicata per ID dalla tabella specificata.
 * La conferma va gestita dal chiamante (es. `window.confirm`).
 */
export async function deleteDuplicateRow(
  supabase: SupabaseClient,
  table: DuplicateTable,
  id: string
): Promise<{ error: string | null }> {
  const trimmed = id?.trim()
  if (!trimmed) return { error: 'ID mancante' }
  const { error } = await supabase.from(table).delete().eq('id', trimmed)
  return { error: error?.message ?? null }
}
