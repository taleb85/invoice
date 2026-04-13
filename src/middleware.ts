import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

/** Solo amministratori (configurazione sedi, log sync globali, discovery IMAP, ecc.) */
function isAdminOnlyPath(pathname: string): boolean {
  if (pathname === '/sedi' || pathname.startsWith('/sedi/')) return true
  if (pathname === '/log' || pathname.startsWith('/log/')) return true
  if (pathname.startsWith('/impostazioni/fornitori')) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next({ request })

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  if (!isAdmin && isAdminOnlyPath(pathname)) {
    if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    return NextResponse.redirect(homeUrl)
  }

  const isSedeExempt = SEDE_LOCK_EXEMPT.some((p) => pathname.startsWith(p))
  if (!isSedeExempt && !isAdmin && profile?.sede_id && pathname !== '/sede-lock') {
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
