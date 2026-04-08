import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotte accessibili senza autenticazione
const PUBLIC_PATHS = ['/login', '/api/solleciti']

// Rotte riservate agli operatori (admin bloccato)
const OPERATORE_ONLY_PREFIXES = [
  '/fornitori',
  '/bolle',
  '/fatture',
  '/archivio',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lascia passare rotte pubbliche e risorse statiche
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next({ request })

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
          // Propaga i cookie aggiornati sia nella request che nella response
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Recupera l'utente dalla sessione (non usare getSession: può essere falsificata)
  const { data: { user } } = await supabase.auth.getUser()

  // Utente non autenticato → redirect a /login
  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Utente autenticato sulla pagina di login → redirect alla dashboard
  if (pathname === '/login') {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    return NextResponse.redirect(homeUrl)
  }

  // Protezione rotte operative: admin non può accedere a fornitori/bolle/fatture/archivio
  const isOperativoPath = OPERATORE_ONLY_PREFIXES.some((p) => pathname.startsWith(p))
  if (isOperativoPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      const sediUrl = request.nextUrl.clone()
      sediUrl.pathname = '/sedi'
      return NextResponse.redirect(sediUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
