/**
 * Backup settimanale (cron /api/cron/backup): flag in `configurazioni_app`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const BACKUP_AUTOMATION_CHIAVE = 'backup_automatico_attivo'

/** Se la chiave manca → comportamento storico (cron attivo). */
export const DEFAULT_BACKUP_AUTOMATION_ENABLED = true

export const BACKUP_AUTOMATION_DESCRIZIONE =
  'Abilita il backup CSV settimanale automatico (lunedì 02:00 UTC) avviato dal cron.'

export function parseBackupAutomationEnabled(raw: string | null | undefined): boolean {
  if (raw == null || String(raw).trim() === '') return DEFAULT_BACKUP_AUTOMATION_ENABLED
  const v = String(raw).trim().toLowerCase()
  if (['true', '1', 'yes', 'si', 'sì', 'on'].includes(v)) return true
  if (['false', '0', 'no', 'off'].includes(v)) return false
  return DEFAULT_BACKUP_AUTOMATION_ENABLED
}

export async function fetchBackupAutomationEnabled(
  supabase: Pick<SupabaseClient, 'from'>,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('configurazioni_app')
      .select('valore')
      .eq('chiave', BACKUP_AUTOMATION_CHIAVE)
      .maybeSingle()
    if (error) {
      console.warn('[backup-automation] configurazioni_app:', error.message)
      return DEFAULT_BACKUP_AUTOMATION_ENABLED
    }
    const row = data as { valore: string } | null
    return parseBackupAutomationEnabled(row?.valore)
  } catch (e) {
    console.warn('[backup-automation] read failed:', e)
    return DEFAULT_BACKUP_AUTOMATION_ENABLED
  }
}
