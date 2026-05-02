import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { isInvalidRefreshTokenError } from '@/lib/auth-refresh-error'
import { NextResponse, type NextRequest } from 'next/server'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'

type ProxyProfile = { role: string | null; sede_id: string | null }

function mapProfileRow(data: unknown): ProxyProfile {
  const d = data as { role?: string | null; sede_id?: string | null }
  return {
    role: d.role ?? null,
    sede_id: d.sede_id ?? null,
  }
}

/**
 * Risolve `profiles` per i guard nel proxy. Se la lettura fallisce (service/anon/DB/eccezione),
 * `applyRouteGuards === false`: si lascia passare la richiesta e le pagine/API applicano i controlli.
 * Mai redirect a /login da qui per errori sul profilo.
 */
async function resolveProfileForProxy(
  userId: string,
  supabase: SupabaseClient,
): Promise<{ profile: ProxyProfile | null; applyRouteGuards: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && serviceKey) {
    try {
      const service = createSupabaseServiceClient(url, serviceKey)
      const { data, error } = await service
        .from('profiles')
        .select('role, sede_id')
        .eq('id', userId)
        .maybeSingle()
      if (error) {
        console.warn('[proxy] profiles (service):', error.message)
        return { profile: null, applyRouteGuards: false }
      }
      if (data) return { profile: mapProfileRow(data), applyRouteGuards: true }
    } catch (e) {
      console.warn('[proxy] profiles (service) exception:', e)
      return { profile: null, applyRouteGuards: false }
    }
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, sede_id')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[proxy] profiles (anon):', error.message)
      return { profile: null, applyRouteGuards: false }
    }
    return {
      profile: data ? mapProfileRow(data) : null,
      applyRouteGuards: true,
    }
  } catch (e) {
    console.warn('[proxy] profiles (anon) exception:', e)
    return { profile: null, applyRouteGuards: false }
  }
}

/** Rotte accessibili senza autenticazione */
const PUBLIC_PATHS = [
  '/login',
  '/api/solleciti',
  '/api/lookup-name',
  '/api/scan-emails',
  '/sede-lock',
  '/manifest.json',
  '/sw.js',
  '/offline',
] as const

const SEDE_LOCK_EXEMPT = ['/api/sede-lock']

/** Pagine riservate al solo Admin Master (non confondere con `/sedi` lista: vedi sotto). */
function isMasterAdminOnlyPath(pathname: string): boolean {
  if (pathname.startsWith('/impostazioni/fornitori')) return true
  return false
}

function isLogPath(pathname: string): boolean {
  return pathname === '/log' || pathname.startsWith('/log/')
}

/** Sotto-route `/sedi/[id]/…` (non la lista `/sedi`). */
function sedeDetailPathSedeId(pathname: string): string | null {
  if (!pathname.startsWith('/sedi/')) return null
  const rest = pathname.slice('/sedi/'.length)
  const id = rest.split('/')[0]?.trim()
  return id || null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next({ request })

  /** Bookmark / vecchi link: normalizza prima dell’auth così le regole sotto valgono per `/log` e `/sedi/...`. */
  if (pathname === '/email-log' || pathname.startsWith('/email-log/')) {
    const url = request.nextUrl.clone()
    url.pathname = `/log${pathname === '/email-log' ? '' : pathname.slice('/email-log'.length)}`
    return NextResponse.redirect(url)
  }
  if (pathname.startsWith('/gestisci/')) {
    const rest = pathname.slice('/gestisci/'.length)
    const id = rest.split('/')[0]?.trim()
    if (id) {
      const url = request.nextUrl.clone()
      url.pathname = `/sedi/${rest}`
      return NextResponse.redirect(url)
    }
  }

  const isApi = pathname.startsWith('/api/')

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: authData, error: getUserError } = await supabase.auth.getUser()
  let user = authData?.user ?? null

  /** Solo refresh token invalido → signOut; altri errori non forzano logout. */
  if (getUserError && isInvalidRefreshTokenError(getUserError)) {
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    user = null
  }

  /** Redirect /login solo senza utente autenticato; mai per errori sul profilo. */
  if (!user) {
    if (isApi) return supabaseResponse
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/login') {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    return NextResponse.redirect(homeUrl)
  }

  const { profile, applyRouteGuards } = await resolveProfileForProxy(user.id, supabase)

  if (applyRouteGuards) {
    const role = profile?.role ?? ''
    const isMasterAdmin = isMasterAdminRole(role)
    const isBranchStaff = isBranchSedeStaffRole(role)

    if (isMasterAdminOnlyPath(pathname)) {
      if (!isMasterAdmin) {
        if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const homeUrl = request.nextUrl.clone()
        homeUrl.pathname = '/'
        return NextResponse.redirect(homeUrl)
      }
    }

    /** Lista `/sedi`: master (tutte) oppure admin_sede con sede assegnata (solo la propria, via API). */
    if (pathname === '/sedi') {
      const allowed = isMasterAdmin || (isBranchStaff && !!profile?.sede_id)
      if (!allowed) {
        if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const homeUrl = request.nextUrl.clone()
        homeUrl.pathname = '/'
        return NextResponse.redirect(homeUrl)
      }
    }

    const sedeFromPath = sedeDetailPathSedeId(pathname)
    if (sedeFromPath) {
      if (isMasterAdmin) {
        // ok
      } else if (isBranchStaff && profile?.sede_id && sedeFromPath === profile.sede_id) {
        // ok: responsabile/tecnico solo della propria sede
      } else {
        if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const homeUrl = request.nextUrl.clone()
        homeUrl.pathname = '/'
        return NextResponse.redirect(homeUrl)
      }
    }

    if (isLogPath(pathname)) {
      if (!isMasterAdmin && !isBranchStaff) {
        if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        const homeUrl = request.nextUrl.clone()
        homeUrl.pathname = '/'
        return NextResponse.redirect(homeUrl)
      }
    }

    const isSedeExempt = SEDE_LOCK_EXEMPT.some((p) => pathname.startsWith(p))
    /** Gate nome+PIN in sessione: deve essere raggiungibile prima del blocco codice sede (navigazione full-page). */
    const isBranchSessionPath = pathname === '/accesso' || pathname.startsWith('/accesso/')
    if (
      !isSedeExempt &&
      !isMasterAdmin &&
      profile?.sede_id &&
      pathname !== '/sede-lock' &&
      !isBranchSessionPath
    ) {
      const verifiedCookie = request.cookies.get('sede-verified')?.value
      if (verifiedCookie !== profile.sede_id) {
        try {
          const { data: sede } = await supabase
            .from('sedi')
            .select('access_password')
            .eq('id', profile.sede_id)
            .single()

          if (sede?.access_password) {
            const lockUrl = request.nextUrl.clone()
            lockUrl.pathname = '/sede-lock'
            return NextResponse.redirect(lockUrl)
          }
        } catch (e) {
          console.warn('[proxy] sede-lock lookup exception:', e)
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|png)$).*)',
  ],
}
