'use server'

import { revalidatePath } from 'next/cache'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import {
  DEFAULT_SOLLECITI_TOLERANCE,
  SOLLECITI_APP_DESCRIZIONI,
  SOLLECITI_CONFIG_CHIAVI,
} from '@/lib/sollecito-aging'

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
  /**
   * 1 = solleciti automatici attivi, 0 = disattivi.
   * Usare un intero evita edge case di serializzazione `false` nelle Server Actions.
   */
  autoSolleciti: 0 | 1
  giorniTolBolla: number
  giorniTolPromessa: number
  giorniTolEstrattoMismatch: number
}

export async function saveSollecitiSettingsAction(
  input: SaveSollecitiSettingsPayload,
): Promise<SaveSollecitiSettingsResult> {
  const { supabase, user } = await getRequestAuth()
  if (!user) return { ok: false, error: 'not_authenticated' }

  const profile = await getProfile()
  if (!profile || !['admin', 'admin_sede'].includes(profile.role)) {
    return { ok: false, error: 'forbidden' }
  }

  const rawFlag = Number(input.autoSolleciti)
  const flag = Number.isInteger(rawFlag) ? rawFlag : NaN
  if (flag !== 0 && flag !== 1) {
    return { ok: false, error: 'invalid_payload' }
  }
  const autoOn = flag === 1

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
    const { error } = await supabase.from('configurazioni_app').upsert([row], {
      onConflict: 'chiave',
    })
    if (error) {
      console.error('[saveSollecitiSettingsAction]', row.chiave, error.message, error.code, error.details)
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
