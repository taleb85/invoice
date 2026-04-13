'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { LOCALES } from '@/lib/translations'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import { useActiveOperator } from '@/lib/active-operator-context'

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

interface SidebarProps {
  /** Optional; still invoked on route change (legacy hook for parents). */
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { me } = useMe()
  const { locale, t, setLocale } = useLocale()
  const { activeOperator, openSwitchModal } = useActiveOperator()
  const [sedeNome, setSedeNome] = useState<string | null>(null)
  const [sedeId, setSedeId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allSedi, setAllSedi] = useState<{ id: string; nome: string }[]>([])
  const [adminSedeId, setAdminSedeId] = useState<string>('')
  const [branchesOpen, setBranchesOpen] = useState(true)
  const [fornitori, setFornitori] = useState<{ id: string; nome: string }[]>([])
  const [fornitoriOpen, setFornitoriOpen] = useState(true)
  const [fornitoriSearch, setFornitoriSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  /** Legacy: parent may reset state on navigation (mobile drawer removed). */
  useEffect(() => {
    onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on pathname; onClose is parent setState(false)
  }, [pathname])

  useEffect(() => {
    if (!me) return
    setIsAdmin(me.is_admin)
    setSedeNome(me.sede_nome)
    setSedeId(me.sede_id ?? null)

    if (me.is_admin && me.all_sedi?.length > 0) {
      setAllSedi(me.all_sedi)
      const savedSede = getCookie('admin-sede-id')
      if (savedSede && !me.all_sedi.some((s) => s.id === savedSede)) {
        document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
        setAdminSedeId('')
      } else {
        setAdminSedeId(savedSede || '')
      }
    }

    // Load suppliers for operators (filtered by their sede)
    if (!me.is_admin) {
      const supabaseClient = createClient()
      let q = supabaseClient.from('fornitori').select('id, nome').order('nome')
      if (me.sede_id) q = q.eq('sede_id', me.sede_id) as typeof q
      q.then(({ data: rows }: { data: { id: string; nome: string }[] | null }) => setFornitori(rows ?? []))
    }
  }, [me])


  const handleAdminSedeChange = (value: string) => {
    setAdminSedeId(value)
    if (!value) {
      document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
    } else {
      document.cookie = `admin-sede-id=${value}; path=/; SameSite=Strict`
    }
    router.refresh()
  }

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
  ]

  const filteredFornitori = fornitori.filter(f =>
    f.nome.toLowerCase().includes(fornitoriSearch.toLowerCase())
  )

  // Admin flat nav items — Branches is rendered as a custom expandable section inline.
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
      label: t.nav.fornitori,
      href: '/fornitori',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: t.nav.logEmail,
      href: '/log',
      badge: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

  // Shared icon-link style helpers
  const navLink = (isActive: boolean) =>
    `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap overflow-hidden ${
      isActive
        ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[9px]'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[9px]'
    }`

  const iconOnly = (isActive: boolean) =>
    `flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
      isActive
        ? 'bg-cyan-500/20 text-white shadow-[inset_0_0_0_1px_rgba(6,182,212,0.20)]'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
    }`

  return (
    <>
      <aside
        suppressHydrationWarning
        className={[
          /* Mobile: no sidebar — desktop only */
          'hidden md:flex md:flex-col md:relative md:z-auto md:shrink-0 md:min-h-screen',
          collapsed ? 'md:w-14' : 'md:w-64',
          'bg-slate-950',
          'transition-all duration-200 ease-in-out',
          'shadow-[4px_0_32px_rgba(0,0,0,0.45)]',
        ].join(' ')}
      >
        {/* ── Logo / collapse toggle ── */}
        <div className="relative border-b border-slate-800/60 flex items-center">
          {collapsed ? (
            /* Mini logo — icon card only */
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex items-center justify-center py-3 hover:bg-slate-800/40 transition-colors"
              title={t.ui.expandSidebar}
            >
              <svg viewBox="0 0 56 56" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="fxm-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e3a5f"/>
                    <stop offset="100%" stopColor="#172554"/>
                  </linearGradient>
                  <linearGradient id="fxm-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5b7cf9"/>
                    <stop offset="50%" stopColor="#38bdf8"/>
                    <stop offset="100%" stopColor="#22d3ee"/>
                  </linearGradient>
                </defs>
                <rect width="56" height="56" rx="13" fill="url(#fxm-bg)"/>
                <path d="M7 30 C13 18, 22 18, 29 30 S43 42, 49 30"
                      stroke="url(#fxm-wave)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
                <circle cx="7"  cy="30" r="3" fill="#5b7cf9"/>
                <circle cx="29" cy="30" r="3" fill="#38bdf8"/>
                <circle cx="49" cy="30" r="3" fill="#22d3ee"/>
              </svg>
            </button>
          ) : (
            /* Full logo + collapse button */
            <div className="flex-1 relative px-3 py-2.5">
              {/* Icon + wordmark row */}
              <div
                className="flex items-center gap-3 md:cursor-pointer"
                onClick={() => { if (window.innerWidth >= 768) router.push('/') }}
              >
                {/* Icon card — left half inside card, right half outside */}
                <svg viewBox="0 0 96 56" className="w-12 h-[30px] shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="fx-card-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e3a5f"/>
                      <stop offset="100%" stopColor="#172554"/>
                    </linearGradient>
                    <linearGradient id="fx-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#5b7cf9"/>
                      <stop offset="50%" stopColor="#38bdf8"/>
                      <stop offset="100%" stopColor="#22d3ee"/>
                    </linearGradient>
                  </defs>
                  {/* Card — left 56px */}
                  <rect width="56" height="56" rx="13" fill="url(#fx-card-bg)"/>
                  {/* Wave: starts inside card, exits right side */}
                  <path d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28"
                        stroke="url(#fx-wave)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
                  {/* Dots: left inside, middle near edge, right outside */}
                  <circle cx="7"  cy="28" r="3.5" fill="#5b7cf9"/>
                  <circle cx="48" cy="28" r="3.5" fill="#38bdf8"/>
                  <circle cx="88" cy="28" r="3.5" fill="#22d3ee"/>
                </svg>

                {/* Wordmark */}
                <div className="min-w-0">
                  <svg viewBox="0 0 130 32" className="w-20 h-auto" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="fx-text" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6b8ef5"/>
                        <stop offset="100%" stopColor="#22d3ee"/>
                      </linearGradient>
                    </defs>
                    <text x="0" y="24" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="24" fill="url(#fx-text)">FLUXO</text>
                  </svg>
                  <p className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase -mt-1">{t.ui.tagline}</p>
                </div>
              </div>

              {/* Desktop collapse toggle */}
              <button
                onClick={() => setCollapsed(true)}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-1.5 items-center justify-center w-6 h-6 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800/70 transition-colors"
                title={t.ui.collapseSidebar}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-2.5'}`}>

          {/* Dashboard */}
          {navItems.slice(0, 1).map((item) => {
            const isActive = pathname === '/'
            return collapsed ? (
              <Link key={item.href} href={item.href} onClick={onClose}
                title={item.label} className={iconOnly(isActive)}>
                {item.icon}
              </Link>
            ) : (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={navLink(isActive)}>
                {item.icon}<span className="truncate">{item.label}</span>
              </Link>
            )
          })}

          {/* ── Admin: Branches ── */}
          {isAdmin && !collapsed && (
            <div>
              <button
                onClick={() => setBranchesOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="truncate">{t.nav.sediTitle}</span>
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${branchesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {branchesOpen && (
                <div className="ml-3.5 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2.5">
                  {allSedi.map((s) => {
                    const isActive = pathname.startsWith(`/sedi/${s.id}`)
                    return (
                      <Link key={s.id} href={`/sedi/${s.id}`} onClick={onClose}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${isActive ? 'bg-cyan-500/15 text-white' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-100'}`}>
                        <span className={`w-1 h-1 rounded-full shrink-0 ${isActive ? 'bg-cyan-400' : 'bg-current opacity-60'}`} />
                        <span className="truncate">{s.nome}</span>
                      </Link>
                    )
                  })}
                  <Link href="/sedi" onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${pathname === '/sedi' ? 'bg-cyan-500/15 text-white' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'}`}>
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{t.nav.gestisciSedi}</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Admin collapsed: Branches icon → /sedi */}
          {isAdmin && collapsed && (
            <Link href="/sedi" onClick={onClose} title={t.appStrings.sidebarSediTitle}
              className={iconOnly(pathname.startsWith('/sedi'))}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </Link>
          )}

          {/* ── Operator: Fornitori section ── */}
          {!isAdmin && !collapsed && (
            <div>
              <button
                onClick={() => setFornitoriOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${pathname.startsWith('/fornitori') ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[9px]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[9px]'}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{t.nav.fornitori}</span>
                  {fornitori.length > 0 && (
                    <span className="text-[10px] bg-slate-700/60 text-slate-500 px-1.5 py-0.5 rounded-full shrink-0">
                      {fornitori.length}
                    </span>
                  )}
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${fornitoriOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fornitoriOpen && (
                <div className="ml-3.5 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2.5">
                  {/* Search */}
                  {fornitori.length > 5 && (
                    <div className="px-1 py-1">
                      <input
                        type="text"
                        value={fornitoriSearch}
                        onChange={e => setFornitoriSearch(e.target.value)}
                        placeholder={t.nav.cerca}
                        className="w-full text-[11px] bg-slate-800 border border-slate-700 text-slate-300 placeholder-slate-600 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                      />
                    </div>
                  )}

                  {/* All suppliers */}
                  <Link href="/fornitori" onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${pathname === '/fornitori' ? 'bg-cyan-500/15 text-white' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'}`}>
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="truncate">{t.nav.tuttiFornitori}</span>
                  </Link>

                  {/* Individual links */}
                  {filteredFornitori.slice(0, 30).map((f) => {
                    const isActive = pathname === `/fornitori/${f.id}`
                    return (
                      <Link key={f.id} href={`/fornitori/${f.id}`} onClick={onClose}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${isActive ? 'bg-cyan-500/15 text-white' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-100'}`}>
                        <span className={`w-1 h-1 rounded-full shrink-0 ${isActive ? 'bg-cyan-400' : 'bg-current opacity-50'}`} />
                        <span className="truncate">{f.nome}</span>
                      </Link>
                    )
                  })}

                  {filteredFornitori.length > 30 && (
                    <p className="px-2 py-1 text-[10px] text-slate-600">
                      +{filteredFornitori.length - 30} {t.nav.altriRisultati}
                    </p>
                  )}
                  {fornitoriSearch && filteredFornitori.length === 0 && (
                    <p className="px-2 py-1.5 text-[10px] text-slate-600">{t.nav.nessunRisultato}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Operator collapsed: Fornitori icon → /fornitori */}
          {!isAdmin && collapsed && (
            <Link href="/fornitori" onClick={onClose} title={t.nav.fornitori}
              className={iconOnly(pathname.startsWith('/fornitori'))}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          )}

          {/* Remaining flat nav items (Log email, etc.) */}
          {navItems.slice(1).map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            const hasBadge = (item as { badge?: boolean }).badge
            return collapsed ? (
              <Link key={item.href} href={item.href} onClick={onClose}
                title={item.label} className={`${iconOnly(isActive)} relative`}>
                {item.icon}
                {hasBadge && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-1 ring-slate-950" />
                )}
              </Link>
            ) : (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={`${navLink(isActive)} relative`}>
                {item.icon}
                <span className="truncate flex-1">{item.label}</span>
                {hasBadge && (
                  <span className="ml-auto shrink-0 w-2 h-2 rounded-full bg-red-500" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* ── Role / Sede badge ── */}
        {!collapsed && (isAdmin || sedeNome) && (
          <div className="px-3 pb-2">
            {isAdmin ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-amber-300/80">{t.sedi.adminRole}</span>
                </div>
                {allSedi.length > 0 && (
                  <select
                    value={adminSedeId}
                    onChange={(e) => handleAdminSedeChange(e.target.value)}
                    className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
                  >
                    <option value="" className="bg-slate-950 text-white">
                      {t.nav.sedeGlobalOverview}
                    </option>
                    {allSedi.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-950 text-white">
                        {s.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-800">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 shrink-0" />
                <span className="text-[11px] text-slate-500 truncate">{sedeNome}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Operatore attivo ── */}
        {!collapsed && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-800/50 border border-slate-700/40 group">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-300 shrink-0">
                {activeOperator
                  ? activeOperator.full_name.charAt(0).toUpperCase()
                  : '?'
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-600 leading-none mb-0.5 uppercase tracking-wide font-semibold">{t.ui.operatorLabel}</p>
                <p className="text-[11px] text-slate-300 truncate font-medium leading-none">
                  {activeOperator ? activeOperator.full_name : t.ui.noOperator}
                </p>
              </div>
              <button
                onClick={openSwitchModal}
                title={t.ui.changeOperator}
                className="p-1 text-slate-600 hover:text-cyan-400 hover:bg-slate-700/60 rounded-md transition-colors shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Collapsed: switch icon */}
        {collapsed && (
          <div className="px-2 pb-2">
            <button
              onClick={openSwitchModal}
              title={activeOperator ? `${t.ui.operatorLabel}: ${activeOperator.full_name}` : t.ui.selectOperator}
              className="flex items-center justify-center w-9 h-9 rounded-lg mx-auto text-slate-500 hover:text-cyan-300 hover:bg-slate-800/70 transition-colors relative"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              {activeOperator && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-cyan-400 border border-slate-900" />
              )}
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div className={`border-t border-slate-800 ${collapsed ? 'px-2 py-3 space-y-1' : 'px-3 py-3 space-y-1'}`}>

          {/* Language switcher */}
          {!collapsed && (
            <div className="relative">
              <button
                onClick={() => setLangOpen(o => !o)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors text-[11px]"
              >
                <span className="text-sm leading-none">{LOCALES.find(l => l.code === locale)?.flag ?? '🌐'}</span>
                <span className="font-medium">{LOCALES.find(l => l.code === locale)?.label ?? locale}</span>
                <svg className={`w-3 h-3 ml-auto transition-transform ${langOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {langOpen && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-50">
                  {LOCALES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => {
                        if (l.code === locale) { setLangOpen(false); return }
                        setLocale(l.code)
                        setLangOpen(false)
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors ${
                        locale === l.code
                          ? 'bg-cyan-500/15 text-white'
                          : 'text-slate-500 hover:bg-slate-800/70 hover:text-slate-100'
                      }`}
                    >
                      <span className="text-sm">{l.flag}</span>
                      <span>{l.label}</span>
                      {locale === l.code && (
                        <svg className="w-3 h-3 ml-auto text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collapsed: globe icon → opens lang popover */}
          {collapsed && (
            <div className="relative">
              <button
                onClick={() => setLangOpen(o => !o)}
                title={t.ui.languageTooltip}
                className="flex items-center justify-center w-9 h-9 rounded-lg mx-auto text-slate-600 hover:text-slate-300 hover:bg-slate-800/70 transition-colors text-sm"
              >
                {LOCALES.find(l => l.code === locale)?.flag ?? '🌐'}
              </button>
              {langOpen && (
                <div className="absolute bottom-0 left-full ml-2 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl z-50 w-40">
                  {LOCALES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => {
                        if (l.code === locale) { setLangOpen(false); return }
                        setLocale(l.code)
                        setLangOpen(false)
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors ${
                        locale === l.code
                          ? 'bg-cyan-500/15 text-white'
                          : 'text-slate-500 hover:bg-slate-800/70 hover:text-slate-100'
                      }`}
                    >
                      <span className="text-sm">{l.flag}</span>
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!isAdmin && !collapsed && (
            <Link
              href="/bolle/new"
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg transition-colors shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.nav.nuovaBolla}
            </Link>
          )}

          {/* + icon when collapsed and operator */}
          {!isAdmin && collapsed && (
            <Link href="/bolle/new" onClick={onClose} title={t.nav.nuovaBolla}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors mx-auto shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          )}

          {collapsed ? (
            <>
              <Link href="/impostazioni" onClick={onClose} title={t.nav.impostazioni}
                className={iconOnly(pathname === '/impostazioni') + ' mx-auto'}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <Link href="/guida" onClick={onClose} title={t.nav.guida}
                className={iconOnly(pathname === '/guida') + ' mx-auto'}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Link>
              <button onClick={handleLogout} title={t.nav.esci}
                className="flex items-center justify-center w-9 h-9 rounded-lg mx-auto text-slate-500 hover:text-slate-100 hover:bg-slate-800/70 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/impostazioni"
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  pathname === '/impostazioni' ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[9px]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[9px]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{t.nav.impostazioni}</span>
              </Link>

              <Link
                href="/guida"
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                  pathname === '/guida' ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[9px]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[9px]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">{t.nav.guida}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 text-xs font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="truncate">{t.nav.esci}</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
