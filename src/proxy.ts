import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js'
import { isInvalidRefreshTokenError } from '@/lib/auth-refresh-error'
import { NextResponse, type NextRequest } from 'next/server'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'

/** Stesso motivo di `getProfile()` lato server: RLS sulla sessione utente può non esporre `profiles` (es. master senza `sede_id`). */
async function fetchProfileRoleAndSedeIdForMiddleware(userId: string): Promise<{
  role: string | null
  sede_id: string | null
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return Promise.resolve(null)
  }
  const service = createSupabaseServiceClient(url, serviceKey)
  const { data } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', userId)
    .maybeSingle()
  return data
    ? {
        role: (data as { role?: string | null }).role ?? null,
        sede_id: (data as { sede_id?: string | null }).sede_id ?? null,
      }
    : null
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

  const { data, error: getUserError } = await supabase.auth.getUser()
  if (getUserError && isInvalidRefreshTokenError(getUserError)) {
    await supabase.auth.signOut()
  }
  const user =
    getUserError && isInvalidRefreshTokenError(getUserError) ? null : (data.user ?? null)

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

  let profile: { role: string | null; sede_id: string | null } | null =
    await fetchProfileRoleAndSedeIdForMiddleware(user.id)
  if (!profile) {
    const { data } = await supabase
      .from('profiles')
      .select('role, sede_id')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
      ? {
          role: (data as { role?: string | null }).role ?? null,
          sede_id: (data as { sede_id?: string | null }).sede_id ?? null,
        }
      : null
  }

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
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|png)$).*)',
  ],
}
