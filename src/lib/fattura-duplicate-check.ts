import type { SupabaseClient } from '@supabase/supabase-js'

/** Messaggio utente (IT) per API e toast — allineato a `t.fatture.duplicateInvoiceSameSupplierDateNumber`. */
export const FATTURA_DUPLICATE_USER_MESSAGE_IT =
  'Questa fattura è già registrata: stesso fornitore, stessa data e stesso numero documento. Per sostituire il PDF apri la fattura esistente e usa «Sostituisci file».'

export function normalizeNumeroFattura(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ')
}

/** Estrae `numero_fattura` dai metadata documento email / OCR (documenti_da_processare). */
export function numeroFatturaFromDocMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const n = (metadata as Record<string, unknown>).numero_fattura
  if (typeof n !== 'string') return null
  const norm = normalizeNumeroFattura(n)
  return norm || null
}

/**
 * Stessa chiave logica: fornitore + data documento + numero fattura normalizzato + sede.
 * Il confronto sul numero è case-insensitive.
 */
export async function findDuplicateFatturaId(
  supabase: SupabaseClient,
  p: { sedeId: string | null; fornitoreId: string; data: string; numeroFattura: string }
): Promise<string | null> {
  const want = normalizeNumeroFattura(p.numeroFattura)
  if (!want || !p.fornitoreId || !p.data) return null

  const { data: rows, error } = await supabase
    .from('fatture')
    .select('id, numero_fattura, sede_id')
    .eq('fornitore_id', p.fornitoreId)
    .eq('data', p.data)

  if (error || !rows?.length) return null

  const wantLower = want.toLowerCase()
  for (const row of rows) {
    if (normalizeNumeroFattura(row.numero_fattura).toLowerCase() !== wantLower) continue
    const rowSede = row.sede_id ?? null
    const ctxSede = p.sedeId ?? null
    if (rowSede !== ctxSede) continue
    return row.id
  }
  return null
}
