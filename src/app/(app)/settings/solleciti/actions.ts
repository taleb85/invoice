'use server'

import { revalidatePath } from 'next/cache'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import {
  DEFAULT_SOLLECITI_TOLERANCE,
  SOLLECITI_CONFIG_CHIAVI,
} from '@/lib/sollecito-aging'

export type SaveSollecitiSettingsResult =
  | { ok: true }
  | { ok: false; error: string }

function clampDay(raw: unknown, fallback: number): number {
  const n =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw.trim(), 10) : NaN
  const i = Number.isFinite(n) ? Math.floor(Number(n)) : fallback
  return Math.min(366, Math.max(0, i))
}

export type SaveSollecitiSettingsPayload = {
  autoSollecitiEnabled: boolean
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

  const rows = [
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.autoEnabled,
      valore: input.autoSollecitiEnabled ? 'true' : 'false',
    },
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.bolla,
      valore: String(
        clampDay(input.giorniTolBolla, DEFAULT_SOLLECITI_TOLERANCE.giorniTolBolla),
      ),
    },
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.promessa,
      valore: String(
        clampDay(input.giorniTolPromessa, DEFAULT_SOLLECITI_TOLERANCE.giorniTolPromessa),
      ),
    },
    {
      chiave: SOLLECITI_CONFIG_CHIAVI.estratto,
      valore: String(
        clampDay(
          input.giorniTolEstrattoMismatch,
          DEFAULT_SOLLECITI_TOLERANCE.giorniTolEstrattoMismatch,
        ),
      ),
    },
  ]

  const { error } = await supabase.from('configurazioni_solleciti').upsert(rows, {
    onConflict: 'chiave',
  })

  if (error) {
    console.error('[saveSollecitiSettingsAction]', error.message)
    return { ok: false, error: 'db_error' }
  }

  revalidatePath('/settings/solleciti')
  revalidatePath('/impostazioni')
  return { ok: true }
}
