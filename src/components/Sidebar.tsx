'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { getTranslations, type Locale } from '@/lib/translations'

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [locale, setLocale] = useState<Locale>('it')
  const [sedeNome, setSedeNome] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    setLocale((getCookie('app-locale') as Locale) || 'it')

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('role, sedi(nome)')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return
          setIsAdmin(data.role === 'admin')
          const sede = (Array.isArray(data.sedi) ? data.sedi[0] : data.sedi) as { nome: string } | null
          setSedeNome(sede?.nome ?? null)
        })
    })
  }, [supabase])

  const t = getTranslations(locale)

  const operatoreNavItems = [
    {
      label: t.nav.dashboard,
      href: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: t.nav.fornitori,
      href: '/fornitori',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: t.nav.bolle,
      href: '/bolle',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: t.nav.fatture,
      href: '/fatture',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: t.nav.archivio,
      href: '/archivio',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      label: t.nav.logEmail,
      href: '/log',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ]

  const adminNavItems = [
    {
      label: t.nav.dashboard,
      href: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: t.nav.sedi,
      href: '/sedi',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: t.nav.logEmail,
      href: '/log',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ]

  const navItems = isAdmin ? adminNavItems : operatoreNavItems

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-[#1a3050] flex flex-col min-h-screen">
      {/* Logo */}
      <div className="relative border-b border-white/10">
        <svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <defs>
            <linearGradient id="sb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6"/>
              <stop offset="100%" stopColor="#22d3ee"/>
            </linearGradient>
            <linearGradient id="sb-textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60a5fa"/>
              <stop offset="100%" stopColor="#67e8f9"/>
            </linearGradient>
          </defs>
          <g transform="translate(76,20)">
            <rect x="0" y="20" width="50" height="50" rx="12" fill="url(#sb-grad)" opacity="0.25"/>
            <path d="M10 45 C20 25, 40 25, 50 45 S80 65, 90 45"
                  stroke="url(#sb-grad)" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="10" cy="45" r="4" fill="#3b82f6"/>
            <circle cx="50" cy="45" r="4" fill="#22d3ee"/>
            <circle cx="90" cy="45" r="4" fill="#3b82f6"/>
          </g>
          <text x="184" y="68" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="42" fill="url(#sb-textGrad)">FLUXO</text>
          <text x="186" y="96" fontFamily="Arial, Helvetica, sans-serif" fontWeight="400" fontSize="18" fill="rgba(255,255,255,0.85)">Invoice Management</text>
        </svg>
      </div>

      {/* Navigazione */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Ruolo / Sede */}
      {(isAdmin || sedeNome) && (
        <div className="px-4 pb-3">
          {isAdmin ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-amber-300/80">Admin</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
              <span className="text-xs text-white/40 truncate">{sedeNome}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10 space-y-2">
        {!isAdmin && (
          <Link
            href="/bolle/new"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white text-[#1a3050] hover:bg-white/90 text-sm font-semibold rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.nav.nuovaBolla}
          </Link>
        )}

        <Link
          href="/impostazioni"
          className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            pathname === '/impostazioni'
              ? 'bg-white/15 text-white'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t.nav.impostazioni}
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t.nav.esci}
        </button>
      </div>
    </aside>
  )
}
