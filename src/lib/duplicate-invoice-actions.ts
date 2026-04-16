import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Elimina una sola riga `fatture` per ID (copia duplicata).
 * La conferma va gestita dal chiamante (es. `window.confirm`).
 */
export async function deleteDuplicateInvoice(
  supabase: SupabaseClient,
  fatturaId: string
): Promise<{ error: string | null }> {
  const id = fatturaId?.trim()
  if (!id) return { error: 'ID mancante' }
  const { error } = await supabase.from('fatture').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteDuplicateBolla(
  supabase: SupabaseClient,
  bollaId: string
): Promise<{ error: string | null }> {
  const id = bollaId?.trim()
  if (!id) return { error: 'ID mancante' }
  const { error } = await supabase.from('bolle').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteDuplicateOrdine(
  supabase: SupabaseClient,
  ordineId: string
): Promise<{ error: string | null }> {
  const id = ordineId?.trim()
  if (!id) return { error: 'ID mancante' }
  const { error } = await supabase.from('conferme_ordine').delete().eq('id', id)
  return { error: error?.message ?? null }
}
