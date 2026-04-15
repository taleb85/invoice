import type { SupabaseClient } from '@supabase/supabase-js'
import { getFiscalYearPgBounds, parseFiscalYearQueryParam } from '@/lib/fiscal-year'

export type FiscalPgBounds = ReturnType<typeof getFiscalYearPgBounds>

/**
 * Risolve `fy` dalla query e i bound DB per la sede operatore (o null se senza sede).
 */
export async function resolveFiscalFilterForSede(
  supabase: SupabaseClient,
  sedeId: string | null,
  fyRaw: string | undefined
): Promise<{ labelYear: number; countryCode: string; bounds: FiscalPgBounds } | null> {
  if (!sedeId) return null
  const { data } = await supabase.from('sedi').select('country_code').eq('id', sedeId).maybeSingle()
  const countryCode = (data?.country_code ?? 'IT').trim() || 'IT'
  const labelYear = parseFiscalYearQueryParam(fyRaw, countryCode)
  return { labelYear, countryCode, bounds: getFiscalYearPgBounds(countryCode, labelYear) }
}
