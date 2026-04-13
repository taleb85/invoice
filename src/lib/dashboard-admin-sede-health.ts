import type { SupabaseClient } from '@supabase/supabase-js'

const OCR_WINDOW_H = 48

/** Conteggi log OCR falliti per sede (ultime 48h), per alert dashboard admin. */
export async function countOcrFailuresBySedeLast48h(
  supabase: SupabaseClient
): Promise<Record<string, number>> {
  const since = new Date(Date.now() - OCR_WINDOW_H * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('log_sincronizzazione')
    .select('sede_id, errore_dettaglio')
    .gte('data', since)
    .eq('stato', 'bolla_non_trovata')
    .not('sede_id', 'is', null)

  const out: Record<string, number> = {}
  for (const row of data ?? []) {
    const sid = row.sede_id as string
    const det = String(row.errore_dettaglio ?? '').toLowerCase()
    if (!det.includes('ocr')) continue
    out[sid] = (out[sid] ?? 0) + 1
  }
  return out
}

export function sedeSyncUnhealthy(
  lastImapError: string | null | undefined,
  ocrFailures48h: number
): boolean {
  return !!(lastImapError?.trim()) || ocrFailures48h > 0
}
