'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { getTranslations, type Locale } from '@/lib/translations'
import { useMe } from '@/lib/me-context'

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { me } = useMe()
  const [mounted, setMounted] = useState(false)
  const [locale, setLocale] = useState<Locale>('it')
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

  // Body scroll lock when mobile drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Populate state from shared UserContext (no direct /api/me fetch)
  useEffect(() => {
    setMounted(true)
    setLocale((getCookie('app-locale') as Locale) || 'it')
  }, [])

  useEffect(() => {
    if (!me) return
    setIsAdmin(me.is_admin)
    setSedeNome(me.sede_nome)
    setSedeId(me.sede_id ?? null)

    if (me.is_admin && me.all_sedi?.length > 0) {
      setAllSedi(me.all_sedi)
      const savedSede = getCookie('admin-sede-id')
      if (savedSede) {
        setAdminSedeId(savedSede)
      } else {
        setAdminSedeId(me.all_sedi[0].id)
        document.cookie = `admin-sede-id=${me.all_sedi[0].id}; path=/; SameSite=Strict`
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

  const handleAdminSedeChange = (sedeId: string) => {
    setAdminSedeId(sedeId)
    document.cookie = `admin-sede-id=${sedeId}; path=/; SameSite=Strict`
    router.refresh()
  }

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
      label: t.nav.logEmail,
      href: '/log',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ]

  const filteredFornitori = fornitori.filter(f =>
    f.nome.toLowerCase().includes(fornitoriSearch.toLowerCase())
  )

  // Admin has only Dashboard and Log Email as flat items;
  // Branches is rendered as a custom expandable section inline.
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

  // Shared icon-link style helpers
  const navLink = (isActive: boolean) =>
    `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap overflow-hidden ${
      isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
    }`

  const iconOnly = (isActive: boolean) =>
    `flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
      isActive ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
    }`

  return (
    <>
      {/* Mobile backdrop — also prevents body scroll while drawer is open */}
      {mounted && open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        suppressHydrationWarning
        className={[
          /* mobile: adaptive-width overlay slide-in */
          'fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[280px]',
          /* desktop: inline, width controlled by collapsed state */
          'md:relative md:z-auto md:translate-x-0 md:shrink-0',
          collapsed ? 'md:w-14' : 'md:w-52',
          'bg-[#1a3050] flex flex-col min-h-screen',
          /* smooth width + slide transitions */
          'transition-all duration-200 ease-in-out',
          /* soft right shadow instead of a hard border */
          'shadow-[4px_0_24px_rgba(0,0,0,0.25)]',
          mounted && open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Mobile close button — large tap target */}
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 p-2.5 text-white/60 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-xl transition-colors touch-manipulation"
          aria-label="Chiudi menu"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        {/* ── Logo / collapse toggle ── */}
        <div className="relative border-b border-white/10 flex items-center">
          {collapsed ? (
            /* Mini logo — just the wave mark */
            <button
              onClick={() => setCollapsed(false)}
              className="w-full flex items-center justify-center py-3.5 hover:bg-white/5 transition-colors"
              title="Espandi sidebar"
            >
              <svg viewBox="0 0 100 60" className="w-7 h-auto" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="sb-grad-c" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6"/>
                    <stop offset="100%" stopColor="#22d3ee"/>
                  </linearGradient>
                </defs>
                <rect x="5" y="5" width="40" height="40" rx="10" fill="url(#sb-grad-c)" opacity="0.25"/>
                <path d="M5 30 C15 15, 30 15, 45 30 S75 45, 90 30"
                      stroke="url(#sb-grad-c)" strokeWidth="4" fill="none" strokeLinecap="round"/>
                <circle cx="5"  cy="30" r="4" fill="#3b82f6"/>
                <circle cx="45" cy="30" r="4" fill="#22d3ee"/>
                <circle cx="90" cy="30" r="4" fill="#3b82f6"/>
              </svg>
            </button>
          ) : (
            /* Full logo + collapse button */
            <div className="flex-1 relative">
              <svg
                viewBox="0 0 420 100"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-auto md:cursor-pointer"
                onClick={() => { if (window.innerWidth >= 768) window.location.reload() }}
              >
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
                <g transform="translate(52,10)">
                  <rect x="0" y="15" width="42" height="42" rx="10" fill="url(#sb-grad)" opacity="0.25"/>
                  <path d="M8 37 C17 20, 33 20, 42 37 S67 54, 76 37"
                        stroke="url(#sb-grad)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
                  <circle cx="8"  cy="37" r="3.5" fill="#3b82f6"/>
                  <circle cx="42" cy="37" r="3.5" fill="#22d3ee"/>
                  <circle cx="76" cy="37" r="3.5" fill="#3b82f6"/>
                </g>
                <text x="148" y="52" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="36" fill="url(#sb-textGrad)">FLUXO</text>
                <text x="150" y="76" fontFamily="Arial, Helvetica, sans-serif" fontWeight="400" fontSize="15" fill="rgba(255,255,255,0.65)">Gestione Fatture</text>
              </svg>

              {/* Desktop collapse toggle */}
              <button
                onClick={() => setCollapsed(true)}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-2 items-center justify-center w-6 h-6 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                title="Comprimi sidebar"
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
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="truncate">Sedi</span>
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${branchesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {branchesOpen && (
                <div className="ml-3.5 mt-0.5 space-y-0.5 border-l border-white/10 pl-2.5">
                  {allSedi.map((s) => {
                    const isActive = pathname.startsWith(`/sedi/${s.id}`)
                    return (
                      <Link key={s.id} href={`/sedi/${s.id}`} onClick={onClose}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}>
                        <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
                        <span className="truncate">{s.nome}</span>
                      </Link>
                    )
                  })}
                  <Link href="/sedi" onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${pathname === '/sedi' ? 'bg-white/15 text-white' : 'text-white/35 hover:bg-white/10 hover:text-white/70'}`}>
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">Gestisci Sedi</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Admin collapsed: Branches icon → /sedi */}
          {isAdmin && collapsed && (
            <Link href="/sedi" onClick={onClose} title="Sedi"
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
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${pathname.startsWith('/fornitori') ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{t.nav.fornitori}</span>
                  {fornitori.length > 0 && (
                    <span className="text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full shrink-0">
                      {fornitori.length}
                    </span>
                  )}
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${fornitoriOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fornitoriOpen && (
                <div className="ml-3.5 mt-0.5 space-y-0.5 border-l border-white/10 pl-2.5">
                  {/* Search */}
                  {fornitori.length > 5 && (
                    <div className="px-1 py-1">
                      <input
                        type="text"
                        value={fornitoriSearch}
                        onChange={e => setFornitoriSearch(e.target.value)}
                        placeholder="Cerca…"
                        className="w-full text-[11px] bg-white/5 border border-white/10 text-white/70 placeholder-white/25 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400/40"
                      />
                    </div>
                  )}

                  {/* All suppliers */}
                  <Link href="/fornitori" onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${pathname === '/fornitori' ? 'bg-white/15 text-white' : 'text-white/35 hover:bg-white/10 hover:text-white/70'}`}>
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="truncate">Tutti i fornitori</span>
                  </Link>

                  {/* Individual links */}
                  {filteredFornitori.slice(0, 30).map((f) => {
                    const isActive = pathname === `/fornitori/${f.id}`
                    return (
                      <Link key={f.id} href={`/fornitori/${f.id}`} onClick={onClose}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/10 hover:text-white'}`}>
                        <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-50" />
                        <span className="truncate">{f.nome}</span>
                      </Link>
                    )
                  })}

                  {filteredFornitori.length > 30 && (
                    <p className="px-2 py-1 text-[10px] text-white/25">
                      +{filteredFornitori.length - 30} altri — cerca sopra
                    </p>
                  )}
                  {fornitoriSearch && filteredFornitori.length === 0 && (
                    <p className="px-2 py-1.5 text-[10px] text-white/25">Nessun risultato</p>
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
        </nav>

        {/* ── Role / Sede badge ── */}
        {!collapsed && (isAdmin || sedeNome) && (
          <div className="px-3 pb-2">
            {isAdmin ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-amber-300/80">Admin</span>
                </div>
                {allSedi.length > 0 && (
                  <select
                    value={adminSedeId}
                    onChange={(e) => handleAdminSedeChange(e.target.value)}
                    className="w-full text-[11px] bg-white/5 border border-white/10 text-white/60 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400/40 cursor-pointer"
                  >
                    {allSedi.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#1a3050] text-white">
                        {s.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                <span className="text-[11px] text-white/40 truncate">{sedeNome}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className={`border-t border-white/10 ${collapsed ? 'px-2 py-3 space-y-1' : 'px-3 py-3 space-y-1'}`}>
          {!isAdmin && !collapsed && (
            <Link
              href="/bolle/new"
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-white text-[#1a3050] hover:bg-white/90 text-xs font-semibold rounded-lg transition-colors"
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
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors mx-auto">
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
              <button onClick={handleLogout} title={t.nav.esci}
                className="flex items-center justify-center w-9 h-9 rounded-lg mx-auto text-white/50 hover:text-white hover:bg-white/10 transition-colors">
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
                  pathname === '/impostazioni' ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{t.nav.impostazioni}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 text-white/55 hover:text-white hover:bg-white/10 text-xs font-medium rounded-lg transition-colors"
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
