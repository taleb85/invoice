import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/server'

type GenerateLinkData = {
  properties?: {
    action_link?: string
    email_otp?: string
    hashed_token?: string
  }
}

/**
 * Crea sessione Supabase lato server dopo aver validato `device_id`, usando
 * `generateLink` (magic) + `verifyOtp` nello stesso request (niente invio email).
 * Richiede che il progetto Auth esponga `email_otp` nella risposta admin (comportamento standard GoTrue per link generati in backend).
 */
export async function createAuthSessionForEmailViaMagicOtp(
  supabase: SupabaseClient,
  userEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceClient()
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: userEmail,
  } as { type: 'magiclink'; email: string })

  if (error) {
    return { ok: false, error: error.message }
  }
  const gl = data as { properties?: GenerateLinkData['properties'] } | null
  const props = (gl?.properties ?? {}) as NonNullable<GenerateLinkData['properties']>

  if (typeof props.email_otp === 'string' && props.email_otp.length > 0) {
    const { error: vErr } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: props.email_otp,
      type: 'email',
    } as { email: string; token: string; type: 'email' })
    if (vErr) {
      return { ok: false, error: vErr.message }
    }
    return { ok: true }
  }

  if (typeof props.hashed_token === 'string' && props.hashed_token) {
    const { error: vErr } = await supabase.auth.verifyOtp({
      type: 'email',
      token_hash: props.hashed_token,
    } as { type: 'email'; token_hash: string })
    if (vErr) {
      return { ok: false, error: vErr.message }
    }
    return { ok: true }
  }

  return {
    ok: false,
    error:
      'Recupero sessione dispositivo non disponibile: contatta l’amministratore o accedi con PIN.',
  }
}
