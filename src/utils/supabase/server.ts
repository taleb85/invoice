import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isInvalidRefreshTokenError } from '@/lib/auth-refresh-error'
import type { Profile } from '@/types'

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Condivide `createClient` + `auth.getUser()` dentro la stessa richiesta RSC/API:
 * layout `(app)` e pagina non ripetono il round-trip Supabase Auth.
 */
export const getRequestAuth = cache(
  async (): Promise<{ supabase: SupabaseServerClient; user: User | null }> => {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error && isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut()
      return { supabase, user: null }
    }
    return { supabase, user: user ?? null }
  }
)

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Server Components setAll non è disponibile.
            // Il middleware aggiorna i cookie di sessione.
          }
        },
      },
    }
  )
}

/**
 * Client con service_role key: bypassa completamente RLS.
 * Da usare SOLO in API route server-side mai esposte al browser.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Restituisce il profilo dell'utente corrente inclusa la sede. Memoised per request via cache(). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const { supabase, user } = await getRequestAuth()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (data as Profile) ?? null
})
