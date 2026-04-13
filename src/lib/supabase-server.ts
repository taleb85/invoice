import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
            // In Server Components setAll non è disponibile; il middleware gestisce il refresh
          }
        },
      },
    }
  )
}

// Restituisce ruolo e sede_id effettiva (solo Admin Master usa cookie admin-sede-id)
export async function getProfileAndSede() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null, sedeId: null, isAdmin: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const sedeId =
    profile?.role === 'admin'
      ? cookieStore.get('admin-sede-id')?.value ?? null
      : profile?.sede_id ?? null

  return { user, profile, sedeId, isAdmin }
}
