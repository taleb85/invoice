import type { SupabaseClient } from '@supabase/supabase-js'

/** Stati “in coda” su `documenti_da_processare` (allineato a Statements / KPI). */
export const PENDING_DOCUMENTI_STATI = ['in_attesa', 'da_associare', 'bozza_creata'] as const

const LOG_ERROR_STATI = ['fornitore_non_trovato', 'bolla_non_trovata'] as const

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

/** Errori log sincronizzazione ultime 24h — stessa logica di `page.tsx` / dashboard admin. */
export async function countSyncLogErrors24h(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('log_sincronizzazione')
    .select('*', { count: 'exact', head: true })
    .in('stato', [...LOG_ERROR_STATI])
    .gte('data', since24hIso())
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
export async function countPendingDocumentiSessionScoped(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('documenti_da_processare')
    .select('*', { count: 'exact', head: true })
    .in('stato', [...PENDING_DOCUMENTI_STATI])
  return count ?? 0
}

/**
 * Conteggio per sede operativa (operatore con switch / cookie admin).
 * Include `sede_id` della sede **e** `sede_id` NULL (IMAP globale / mittente sconosciuto),
 * come RLS `documenti_processare: select` e lista `/api/documenti-da-processare`.
 */
export async function countPendingDocumentiForSede(
  supabase: SupabaseClient,
  sedeId: string
): Promise<number> {
  const { count } = await supabase
    .from('documenti_da_processare')
    .select('*', { count: 'exact', head: true })
    .or(`sede_id.eq.${sedeId},sede_id.is.null`)
    .in('stato', [...PENDING_DOCUMENTI_STATI])
  return count ?? 0
}
