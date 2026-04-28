import type { SupabaseClient } from '@supabase/supabase-js'
import type { FiscalPgBounds } from '@/lib/fiscal-year-page'
import { utcBoundsForZonedCalendarDay } from '@/lib/zoned-day-bounds'

/** Stati “in coda” su `documenti_da_processare` (tab Documenti pendenti / KPI). */
export const PENDING_DOCUMENTI_STATI = ['da_revisionare'] as const

const LOG_ERROR_STATI = ['fornitore_non_trovato', 'bolla_non_trovata'] as const

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Errori log sincronizzazione: ultime 24h (badge / admin) oppure, con `fiscalBounds`,
 * solo eventi nel periodo fiscale (KPI dashboard allineati al selettore anno).
 */
export async function countSyncLogErrors24h(
  supabase: SupabaseClient,
  fiscalBounds?: FiscalPgBounds | null
): Promise<number> {
  let q = supabase
    .from('log_sincronizzazione')
    .select('*', { count: 'exact', head: true })
    .in('stato', [...LOG_ERROR_STATI])
  if (fiscalBounds) {
    q = q.gte('data', fiscalBounds.tsFrom).lt('data', fiscalBounds.tsToExclusive)
  } else {
    q = q.gte('data', since24hIso())
  }
  const { count } = await q
  return count ?? 0
}

/** Errori log ultime 24h limitati a una sede (admin_sede / badge). */
export async function countSyncLogErrors24hForSede(
  supabase: SupabaseClient,
  sedeId: string
): Promise<number> {
  const { count } = await supabase
    .from('log_sincronizzazione')
    .select('*', { count: 'exact', head: true })
    .eq('sede_id', sedeId)
    .in('stato', [...LOG_ERROR_STATI])
    .gte('data', since24hIso())
  return count ?? 0
}

/**
 * Documenti in attesa visibili alla sessione (RLS / sede utente), senza filtro esplicito.
 * Allineato alla query aggregata della dashboard operatore.
 */
export async function countPendingDocumentiSessionScoped(
  supabase: SupabaseClient,
  fiscalBounds?: FiscalPgBounds | null
): Promise<number> {
  let q = supabase
    .from('documenti_da_processare')
    .select('*', { count: 'exact', head: true })
    .in('stato', [...PENDING_DOCUMENTI_STATI])
  if (fiscalBounds) {
    q = q.gte('created_at', fiscalBounds.tsFrom).lt('created_at', fiscalBounds.tsToExclusive)
  }
  const { count } = await q
  return count ?? 0
}

/**
 * Conteggio per sede operativa (operatore con switch / cookie admin).
 * Include `sede_id` della sede **e** `sede_id` NULL (IMAP globale / mittente sconosciuto),
 * come RLS `documenti_processare: select` e lista `/api/documenti-da-processare`.
 */
export async function countPendingDocumentiForSede(
  supabase: SupabaseClient,
  sedeId: string,
  fiscalBounds?: FiscalPgBounds | null
): Promise<number> {
  let q = supabase
    .from('documenti_da_processare')
    .select('*', { count: 'exact', head: true })
    .or(`sede_id.eq.${sedeId},sede_id.is.null`)
    .in('stato', [...PENDING_DOCUMENTI_STATI])
  if (fiscalBounds) {
    q = q.gte('created_at', fiscalBounds.tsFrom).lt('created_at', fiscalBounds.tsToExclusive)
  }
  const { count } = await q
  return count ?? 0
}

/** Fatture + bolle create da scansione email OCR nel giorno solare della sede (colonna opzionale post-migration). */
export async function countEmailAutoSavedTodayForSede(
  supabase: SupabaseClient,
  sedeId: string,
  timeZone: string,
): Promise<number> {
  const { start, endExclusive } = utcBoundsForZonedCalendarDay(timeZone.trim() || 'UTC')
  const { count: fc, error: ef } = await supabase
    .from('fatture')
    .select('*', { count: 'exact', head: true })
    .eq('sede_id', sedeId)
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)

  const { count: bc, error: eb } = await supabase
    .from('bolle')
    .select('*', { count: 'exact', head: true })
    .eq('sede_id', sedeId)
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)

  if (
    ef?.message?.includes('email_sync_auto_saved_at') ||
    ef?.code === '42703' ||
    eb?.message?.includes('email_sync_auto_saved_at') ||
    eb?.code === '42703'
  ) {
    return 0
  }
  return (fc ?? 0) + (bc ?? 0)
}
