import type { SupabaseClient } from '@supabase/supabase-js'

/** Messaggio utente (IT) per API e toast — allineato a `t.fatture.duplicateInvoiceSameSupplierDateNumber`. */
export const FATTURA_DUPLICATE_USER_MESSAGE_IT =
  'Questa fattura è già registrata: stesso fornitore, stessa data e stesso numero documento. Per sostituire il PDF apri la fattura esistente e usa «Sostituisci file».'

/** Borderline: fornitore + data + importo quando né il nuovo documento né l’archivio hanno numero fattura valorizzato. */
export const FATTURA_DUPLICATE_SANS_NUMERO_IMPORTO_IT =
  'Questa fattura è già registrata: stesso fornitore, stessa data e stesso importo (nessun numero documento). Per sostituire il PDF apri la fattura esistente e usa «Sostituisci file».'

/** Stesso fornitore + data + importo ma numero OCR diverso (doppia email / lettura errata). */
export const FATTURA_DUPLICATE_SAME_SUPPLIER_DATE_AMOUNT_IT =
  'Questa fattura è già registrata: stesso fornitore, stessa data e stesso importo (numero documento diverso — possibile duplicato OCR). Per sostituire il PDF apri la fattura esistente e usa «Sostituisci file».'

export function normalizeNumeroFattura(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (!s) return ''
  // Allinea zeri iniziali su numeri puri (es. estratto 53101 ↔ fattura 0053101).
  if (/^\d+$/.test(s)) {
    return s.replace(/^0+/, '') || '0'
  }
  return s
}

/** Trova una riga statement per `numero_doc` con confronto normalizzato. */
export function findStatementRowByNumeroDoc<T extends { numero_doc: string | null }>(
  rows: T[],
  numero: string,
): T | undefined {
  const want = normalizeNumeroFattura(numero)
  if (!want) return undefined
  return rows.find((r) => normalizeNumeroFattura(r.numero_doc) === want)
}

/** Estrae `numero_fattura` dai metadata documento email / OCR (documenti_da_processare). */
export function numeroFatturaFromDocMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const n = (metadata as Record<string, unknown>).numero_fattura
  if (typeof n !== 'string') return null
  const norm = normalizeNumeroFattura(n)
  return norm || null
}

/** Confronto importi (numeric DB / float) sui centesimi. */
function importiEquivalenti(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.round(a * 100) === Math.round(b * 100)
}

/**
 * Terza chiave (borderline): stesso fornitore, stessa data, stesso importo, stessa sede,
 * solo righe archiviate senza `numero_fattura`. Usare quando il nuovo documento non ha numero.
 */
export async function findDuplicateFatturaSansNumeroByImporto(
  supabase: SupabaseClient,
  p: { sedeId: string | null; fornitoreId: string; data: string; importo: number }
): Promise<string | null> {
  if (!p.fornitoreId || !p.data) return null
  if (p.importo == null || Number.isNaN(p.importo)) return null

  const { data: rows, error } = await supabase
    .from('fatture')
    .select('id, numero_fattura, sede_id, importo')
    .eq('fornitore_id', p.fornitoreId)
    .eq('data', p.data)

  if (error || !rows?.length) return null

  const ctxSede = p.sedeId ?? null
  for (const row of rows) {
    if (normalizeNumeroFattura(row.numero_fattura)) continue
    const rowSede = row.sede_id ?? null
    if (rowSede !== ctxSede) continue
    const rowImp = row.importo != null ? Number(row.importo) : null
    if (rowImp == null || Number.isNaN(rowImp)) continue
    if (!importiEquivalenti(rowImp, p.importo)) continue
    return row.id
  }
  return null
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

/**
 * Duplicato probabile: stesso fornitore, stessa data documento, stesso importo (centesimi),
 * anche se il numero fattura letto dall'OCR differisce (es. account number vs invoice no.).
 */
export async function findDuplicateFatturaBySupplierDateAmount(
  supabase: SupabaseClient,
  p: { sedeId: string | null; fornitoreId: string; data: string; importo: number },
): Promise<string | null> {
  if (!p.fornitoreId || !p.data) return null
  if (p.importo == null || Number.isNaN(p.importo)) return null

  const { data: rows, error } = await supabase
    .from('fatture')
    .select('id, sede_id, importo')
    .eq('fornitore_id', p.fornitoreId)
    .eq('data', p.data)

  if (error || !rows?.length) return null

  const ctxSede = p.sedeId ?? null
  for (const row of rows) {
    const rowSede = row.sede_id ?? null
    if (rowSede !== ctxSede) continue
    const rowImp = row.importo != null ? Number(row.importo) : null
    if (rowImp == null || Number.isNaN(rowImp)) continue
    if (!importiEquivalenti(rowImp, p.importo)) continue
    return row.id
  }
  return null
}
