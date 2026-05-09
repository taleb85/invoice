'use server'

import { revalidatePath } from 'next/cache'
import type { PostgrestError } from '@supabase/supabase-js'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import {
  DEFAULT_AUTO_SOLLECITI_ENABLED,
  DEFAULT_SOLLECITI_TOLERANCE,
  SOLLECITI_APP_DESCRIZIONI,
  SOLLECITI_APP_TO_LEGACY_CHIAVE,
  SOLLECITI_CONFIG_CHIAVI,
  type SollecitiReminderSettings,
} from '@/lib/sollecito-aging'
import { isSedePrivilegedRole } from '@/lib/roles'

export type SaveSollecitiSettingsResult =
  | { ok: true }
  | { ok: false; error: string; details?: string }

function clampDay(raw: unknown, fallback: number): number {
  const n =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw.trim(), 10) : NaN
  const i = Number.isFinite(n) ? Math.floor(Number(n)) : fallback
  return Math.min(366, Math.max(0, i))
}

export type SaveSollecitiSettingsPayload = {
  /** Preferito: 1 = attivi, 0 = disattivi. */
  autoSolleciti?: 0 | 1
  /**
   * Client/cache vecchi (es. PWA) possono ancora inviare solo questo campo.
   * `string` per tollerare deserializzazioni anomale.
   */
  autoSollecitiEnabled?: boolean | string
  giorniTolBolla: number
  giorniTolPromessa: number
  giorniTolEstrattoMismatch: number
}

function resolveAutoSollecitiFlag(
  input: SaveSollecitiSettingsPayload,
): { ok: true; flag: 0 | 1 } | { ok: false } {
  const a = input.autoSolleciti
  if (a === 0 || a === 1) return { ok: true, flag: a }
  const n = Number(a)
  if (n === 0 || n === 1) return { ok: true, flag: n as 0 | 1 }

  const legacy = input.autoSollecitiEnabled
  if (legacy === true) return { ok: true, flag: 1 }
  if (legacy === false) return { ok: true, flag: 0 }
  if (typeof legacy === 'string') {
    const s = legacy.trim().toLowerCase()
    if (['true', '1', 'yes', 'on', 'si', 'sì'].includes(s)) return { ok: true, flag: 1 }
    if (['false', '0', 'no', 'off'].includes(s)) return { ok: true, flag: 0 }
  }
  return { ok: false }
}

/**
 * Tabella `configurazioni_app` assente o non esposta in PostgREST.
 * Non usare per errori RLS (`row-level security`, `permission denied`).
 */
function isConfigAppTableUnavailable(error: PostgrestError): boolean {
  const msg = (error.message ?? '').toLowerCase()
  const code = (error.code ?? '').toUpperCase()
  if (code === '42P01') return true
  if (msg.includes('row-level security') || msg.includes('rls')) return false
  if (msg.includes('permission denied')) return false
  if (code === '42501') return false
  if (msg.includes('schema cache')) return true
  if (msg.includes('could not find') && msg.includes('configurazioni_app')) return true
  if (msg.includes('does not exist') && msg.includes('configurazioni_app')) return true
  if (msg.includes('relation') && msg.includes('configurazioni_app') && msg.includes('does not exist'))
    return true
  return false
}

type SollecitiSettingsDb = ReturnType<typeof createServiceClient>

async function writeLegacyConfigRow(
  supabase: SollecitiSettingsDb,
  row: { chiave: string; valore: string },
): Promise<{ error: PostgrestError | null }> {
  const legacyKey = SOLLECITI_APP_TO_LEGACY_CHIAVE[row.chiave]
  if (!legacyKey) {
    return {
      error: {
        name: 'PostgrestError',
        message: `Mappa legacy assente per chiave: ${row.chiave}`,
        details: '',
        hint: '',
        code: 'APP_LOGIC',
      } as PostgrestError,
    }
  }

  const upd = await supabase
    .from('configurazioni_solleciti')
    .update({ valore: row.valore })
    .eq('chiave', legacyKey)
    .select('chiave')
    .maybeSingle()

  if (upd.error) return { error: upd.error }
  if (upd.data?.chiave) return { error: null }

  const ins = await supabase.from('configurazioni_solleciti').insert({
    chiave: legacyKey,
    valore: row.valore,
  })
  if (ins.error?.code === '23505') {
    const again = await supabase
      .from('configurazioni_solleciti')
      .update({ valore: row.valore })
      .eq('chiave', legacyKey)
    return { error: again.error }
  }
  return { error: ins.error }
}

/** Update + insert: alcuni setup RLS/PostgREST gestiscono meglio questo rispetto a UPSERT. */
async function writeConfigRow(
  supabase: SollecitiSettingsDb,
  row: { chiave: string; valore: string; descrizione: string },
): Promise<{ error: PostgrestError | null }> {
  const upd = await supabase
    .from('configurazioni_app')
    .update({ valore: row.valore, descrizione: row.descrizione })
    .eq('chiave', row.chiave)
    .select('chiave')
    .maybeSingle()

  if (upd.error) {
    if (isConfigAppTableUnavailable(upd.error)) {
      return writeLegacyConfigRow(supabase, row)
    }
    return { error: upd.error }
  }

  if (upd.data?.chiave) return { error: null }

  const ins = await supabase.from('configurazioni_app').insert({
    chiave: row.chiave,
    valore: row.valore,
    descrizione: row.descrizione,
  })

  if (!ins.error) return { error: null }

  if (ins.error.code === '23505') {
    const retry = await supabase
      .from('configurazioni_app')
      .update({ valore: row.valore, descrizione: row.descrizione })
      .eq('chiave', row.chiave)
    return { error: retry.error }
  }

  if (isConfigAppTableUnavailable(ins.error)) {
    return writeLegacyConfigRow(supabase, row)
  }

  return { error: ins.error }
}

export async function saveSollecitiSettingsAction(
  input: SaveSollecitiSettingsPayload,
): Promise<SaveSollecitiSettingsResult> {
  const { user } = await getRequestAuth()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return { ok: false, error: 'forbidden' }
  }

  if (input == null || typeof input !== 'object') {
    return { ok: false, error: 'invalid_payload', details: 'missing body' }
  }

  const resolved = resolveAutoSollecitiFlag(input)
  if (!resolved.ok) {
    console.warn('[saveSollecitiSettingsAction] invalid auto flag', {
      autoSolleciti: input.autoSolleciti,
      autoSollecitiEnabled: input.autoSollecitiEnabled,
    })
    return { ok: false, error: 'invalid_payload' }
  }
  const autoOn = resolved.flag === 1

  const service = createServiceClient()

  const rows = [
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.autoEnabled,
      valore: autoOn ? 'true' : 'false',
      descrizione: SOLLECITI_APP_DESCRIZIONI[SOLLECITI_CONFIG_CHIAVI.autoEnabled],
    },
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.bolla,
      valore: String(
        clampDay(input.giorniTolBolla, DEFAULT_SOLLECITI_TOLERANCE.giorniTolBolla),
      ),
      descrizione: SOLLECITI_APP_DESCRIZIONI[SOLLECITI_CONFIG_CHIAVI.bolla],
    },
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.promessa,
      valore: String(
        clampDay(input.giorniTolPromessa, DEFAULT_SOLLECITI_TOLERANCE.giorniTolPromessa),
      ),
      descrizione: SOLLECITI_APP_DESCRIZIONI[SOLLECITI_CONFIG_CHIAVI.promessa],
    },
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.estratto,
      valore: String(
        clampDay(
          input.giorniTolEstrattoMismatch,
          DEFAULT_SOLLECITI_TOLERANCE.giorniTolEstrattoMismatch,
        ),
      ),
      descrizione: SOLLECITI_APP_DESCRIZIONI[SOLLECITI_CONFIG_CHIAVI.estratto],
    },
  ]

  for (const row of rows) {
    const { error } = await writeConfigRow(service, row)
    if (error) {
      console.error(
        '[saveSollecitiSettingsAction]',
        row.chiave,
        error.message,
        error.code,
        error.details,
      )
      return {
        ok: false,
        error: 'db_error',
        details: error.message,
      }
    }
  }

  try {
    revalidatePath('/settings/solleciti')
    revalidatePath('/impostazioni')
  } catch (revalidateErr) {
    console.warn('[saveSollecitiSettingsAction] revalidatePath', revalidateErr)
  }
  return { ok: true }
}

/**
 * Server action: legge le impostazioni solleciti dal DB con service role client,
 * bypassando eventuali problemi di RLS / schema cache del client anon.
 */
export async function fetchSollecitiSettingsAction(): Promise<SollecitiReminderSettings> {
  try {
    const service = createServiceClient()
    const [appRes, legRes] = await Promise.all([
      service.from('configurazioni_app').select('chiave, valore'),
      service.from('configurazioni_solleciti').select('chiave, valore'),
    ])
    const merged: { chiave: string; valore: string }[] = []
    if (!legRes.error && legRes.data?.length) merged.push(...(legRes.data as { chiave: string; valore: string }[]))
    if (!appRes.error && appRes.data?.length) merged.push(...(appRes.data as { chiave: string; valore: string }[]))

    const byKey = new Map<string, string>()
    for (const r of merged) { if (r?.chiave) byKey.set(r.chiave.trim(), r.valore) }

    const SOLLECITI_KEY_ORDER = {
      autoEnabled: ['solleciti_automatici_attivi', 'auto_solleciti_enabled'] as const,
      bolla: ['giorni_attesa_bolla', 'giorni_tolleranza_bolla'] as const,
      promessa: ['giorni_attesa_promessa', 'giorni_tolleranza_promessa_documento'] as const,
      estratto: ['giorni_attesa_mismatch_estratto', 'giorni_tolleranza_estratto_mismatch'] as const,
    }

    function pick(keys: readonly string[]): string | undefined {
      for (const k of keys) { const v = byKey.get(k); if (v !== undefined && String(v).trim() !== '') return v }
      return undefined
    }
    function parseNum(raw: string | undefined, fb: number): number {
      if (raw == null) return fb; const n = Number.parseInt(raw.trim(), 10); return Number.isFinite(n) && n >= 0 ? n : fb
    }
    function parseRaw(raw: string | undefined | null): boolean {
      if (raw == null || String(raw).trim() === '') return DEFAULT_AUTO_SOLLECITI_ENABLED
      return ['true', '1', 'yes', 'si', 'sì', 'on'].includes(String(raw).trim().toLowerCase())
    }

    return {
      autoSollecitiEnabled: parseRaw(pick(SOLLECITI_KEY_ORDER.autoEnabled)),
      giorniTolBolla: parseNum(pick(SOLLECITI_KEY_ORDER.bolla), DEFAULT_SOLLECITI_TOLERANCE.giorniTolBolla),
      giorniTolPromessa: parseNum(pick(SOLLECITI_KEY_ORDER.promessa), DEFAULT_SOLLECITI_TOLERANCE.giorniTolPromessa),
      giorniTolEstrattoMismatch: parseNum(pick(SOLLECITI_KEY_ORDER.estratto), DEFAULT_SOLLECITI_TOLERANCE.giorniTolEstrattoMismatch),
    }
  } catch (e) {
    console.error('[fetchSollecitiSettingsAction]', e)
    return {
      autoSollecitiEnabled: DEFAULT_AUTO_SOLLECITI_ENABLED,
      ...DEFAULT_SOLLECITI_TOLERANCE,
    }
  }
}
