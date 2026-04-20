import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImapErrorKind } from './imap-error-classifier'

const SETTING_KEY = 'imap_last_error'

type ImapErrorRecord = {
  kind: ImapErrorKind
  message: string
  failed_at: string
  consecutive_failures: number
}

/**
 * Read the current consecutive failure count for a sede (or global inbox when sedeId is null).
 * Returns 0 when no prior record exists.
 */
async function getConsecutiveFailures(
  supabase: SupabaseClient,
  sedeId: string | null,
): Promise<number> {
  const q = supabase
    .from('user_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .is('user_id', null)

  // sede_id filter: use .is() for null, .eq() for a real value
  const query = sedeId ? q.eq('sede_id', sedeId) : q.is('sede_id', null)
  const { data } = await query.maybeSingle()
  if (!data?.setting_value) return 0
  try {
    const parsed = JSON.parse(data.setting_value) as Partial<ImapErrorRecord>
    return typeof parsed.consecutive_failures === 'number' ? parsed.consecutive_failures : 0
  } catch {
    return 0
  }
}

/**
 * Record a classified IMAP failure for a sede (or global inbox when sedeId is null).
 * Increments the consecutive_failures counter on each call so repeated silent
 * failures become visible without waiting for a user complaint.
 *
 * Uses delete + insert instead of upsert because PostgreSQL unique indexes treat
 * NULL as distinct from every other NULL, so upserting with user_id=NULL would
 * always INSERT rather than UPDATE the existing row.
 */
export async function recordImapFailure(
  supabase: SupabaseClient,
  sedeId: string | null,
  kind: ImapErrorKind,
  message: string,
): Promise<void> {
  const consecutive = (await getConsecutiveFailures(supabase, sedeId)) + 1

  const record: ImapErrorRecord = {
    kind,
    message,
    failed_at: new Date().toISOString(),
    consecutive_failures: consecutive,
  }

  // Delete any existing record first, then insert the updated one.
  // This sidesteps the NULL uniqueness issue with Supabase upsert.
  const delQ = supabase
    .from('user_settings')
    .delete()
    .eq('setting_key', SETTING_KEY)
    .is('user_id', null)

  await (sedeId ? delQ.eq('sede_id', sedeId) : delQ.is('sede_id', null))

  await supabase.from('user_settings').insert([{
    user_id:       null,
    sede_id:       sedeId,
    setting_key:   SETTING_KEY,
    setting_value: JSON.stringify(record),
    metadata:      { source: 'imap_scan' },
  }])
}

/**
 * Clear the failure record on a successful IMAP scan so the consecutive counter resets.
 */
export async function recordImapSuccess(
  supabase: SupabaseClient,
  sedeId: string | null,
): Promise<void> {
  const q = supabase
    .from('user_settings')
    .delete()
    .eq('setting_key', SETTING_KEY)
    .is('user_id', null)

  await (sedeId ? q.eq('sede_id', sedeId) : q.is('sede_id', null))
}

/**
 * Read back the last IMAP error for a given sede (used by the settings UI to
 * show persistent failure state without requiring a live scan attempt).
 */
export async function getLastImapError(
  supabase: SupabaseClient,
  sedeId: string | null,
): Promise<ImapErrorRecord | null> {
  const q = supabase
    .from('user_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .is('user_id', null)

  const query = sedeId ? q.eq('sede_id', sedeId) : q.is('sede_id', null)
  const { data } = await query.maybeSingle()
  if (!data?.setting_value) return null
  try {
    return JSON.parse(data.setting_value) as ImapErrorRecord
  } catch {
    return null
  }
}
