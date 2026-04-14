'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { LOCALES } from '@/lib/translations'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { getAssociatedSedeNome, navGestisciSediLabel } from '@/lib/gestisci-sede-label'
import { resolvedOperatorDockDisplay } from '@/lib/operator-dock-display'
import { effectiveIsAdminSedeUi, profileCanAccessSediListPage } from '@/lib/effective-operator-ui'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

interface SidebarProps {
  /** Optional; still invoked on route change (legacy hook for parents). */
  onClose?: () => void
  collapsed: boolean
  onCollapsedChange: (next: boolean) => void
}

export default function Sidebar({ onClose, collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { me } = useMe()
  const { locale, t, setLocale } = useLocale()
  const { activeOperator, openSwitchModal } = useActiveOperator()
  const [sedeNome, setSedeNome] = useState<string | null>(null)
  const [allSedi, setAllSedi] = useState<{ id: string; nome: string }[]>([])
  const [branchesOpen, setBranchesOpen] = useState(true)
  const [fornitori, setFornitori] = useState<{ id: string; nome: string; display_name: string | null }[]>([])
  const [fornitoriOpen, setFornitoriOpen] = useState(true)
  const [fornitoriSearch, setFornitoriSearch] = useState('')
  const [langOpen, setLangOpen] = useState(false)

  /** Cookie `admin-sede-id` può cambiare senza aggiornare `me` — niente memo. */
  const gestisciSediLinkLabel = navGestisciSediLabel(t, getAssociatedSedeNome(me, getCookie))

  /** Legacy: parent may reset state on navigation (mobile drawer removed). */
  useEffect(() => {
    onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on pathname; onClose is parent setState(false)
  }, [pathname])

  useEffect(() => {
    if (!me) return

    const actingAsStaff = Boolean(me.is_admin && activeOperator)
    if (actingAsStaff && activeOperator) {
      setSedeNome(activeOperator.sede_nome ?? me.sede_nome)
    } else {
      setSedeNome(me.sede_nome)
    }

    if (me.is_admin && me.all_sedi?.length > 0) {
      setAllSedi(me.all_sedi)
      const savedSede = getCookie('admin-sede-id')
      if (savedSede && !me.all_sedi.some((s) => s.id === savedSede)) {
        document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
      }
    }
  }, [me, activeOperator])

  useEffect(() => {
    if (!me) {
      setFornitori([])
      return
    }

    const actingAsStaff = Boolean(me.is_admin && activeOperator)
    const sedeForFornitori =
      actingAsStaff && activeOperator?.sede_id
        ? activeOperator.sede_id
        : !me.is_admin
          ? me.sede_id ?? null
          : null

    let cancelled = false

    const loadFornitori = () => {
      if (!sedeForFornitori) {
        setFornitori([])
        return
      }
      createClient()
        .from('fornitori')
        .select('id, nome, display_name')
        .eq('sede_id', sedeForFornitori)
        .order('nome')
        .then(({ data: rows }: { data: { id: string; nome: string; display_name: string | null }[] | null }) => {
          if (!cancelled) setFornitori(rows ?? [])
        })
    }

    loadFornitori()

    const onVisible = () => {
      if (document.visibilityState === 'visible') loadFornitori()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [me, activeOperator, pathname])


  const listinoNavIcon = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
    </svg>
  )

  const listinoNavItem = {
    label: t.fornitori.tabListino,
    href: '/listino',
    icon: listinoNavIcon,
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
    listinoNavItem,
  ]

  const fornitoriSearchLower = fornitoriSearch.toLowerCase()
  const filteredFornitori = fornitori.filter((f) => {
    if (!fornitoriSearchLower) return true
    const label = fornitoreDisplayLabel(f).toLowerCase()
    const nome = (f.nome ?? '').toLowerCase()
    const alias = (f.display_name ?? '').toLowerCase()
    return label.includes(fornitoriSearchLower) || nome.includes(fornitoriSearchLower) || alias.includes(fornitoriSearchLower)
  })

  const { displayName: operatorDockName, avatarLetter: operatorDockInitial } = resolvedOperatorDockDisplay(
    me,
    activeOperator,
    t.ui.noOperator,
  )
  const operatorDockAria =
    operatorDockName !== t.ui.noOperator
      ? `${t.ui.changeOperator}: ${operatorDockName}`
      : t.ui.selectOperator

  /** Admin master: vista “piano” solo senza operatore PIN; con operatore attivo la UI segue il suo ruolo. */
  const actingAsStaff = Boolean(me?.is_admin && activeOperator)
  const isMasterAdmin = Boolean(me?.is_admin && !actingAsStaff)
  const isAdminSede = effectiveIsAdminSedeUi(me, activeOperator)
  const sessionCanNavigateSediList = profileCanAccessSediListPage(me)

  // Admin flat nav items — Branches is rendered as a custom expandable section inline.
  const logEmailNavItem = {
    label: t.nav.logEmail,
    href: '/log',
    badge: false,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  }

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
    listinoNavItem,
    logEmailNavItem,
  ]

  const navItems = isMasterAdmin
    ? adminNavItems
    : isAdminSede
      ? [operatoreNavItems[0], logEmailNavItem, ...operatoreNavItems.slice(1)]
      : operatoreNavItems

  const handleLogout = async () => {
    try {
      localStorage.removeItem('fluxo-active-operator')
      localStorage.removeItem('fluxo-active-operator-user')
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Shared icon-link style helpers
  const navLink = (isActive: boolean) =>
    `flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap overflow-hidden ${
      isActive
        ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[7px]'
        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[7px]'
    }`

  const iconOnly = (isActive: boolean) =>
    `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
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
          'hidden md:flex md:h-full md:min-h-0 md:flex-col md:relative md:z-auto md:shrink-0 md:overflow-visible',
          collapsed ? 'md:w-14' : 'md:w-56',
          'bg-slate-950',
          'transition-[width] duration-[600ms] ease-[cubic-bezier(0.08,0.82,0.17,1)]',
          'shadow-[4px_0_32px_rgba(0,0,0,0.45)]',
        ].join(' ')}
      >
        {/* ── Navigation: area voci scrollabile + riga Comprimi in fondo al nav */}
        <nav
          className={`flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-hidden ${collapsed ? 'px-1.5' : 'px-2'}`}
        >
          <div className="min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto py-2.5">
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
          {isMasterAdmin && !collapsed && (
            <div>
              <button
                onClick={() => setBranchesOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="truncate">{t.nav.sediNavGroupMaster}</span>
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${branchesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {branchesOpen && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2">
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
                    <span className="truncate">{gestisciSediLinkLabel}</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Admin collapsed: Branches icon → /sedi */}
          {isMasterAdmin && collapsed && (
            <Link href="/sedi" onClick={onClose} title={t.appStrings.sidebarSediTitle}
              className={iconOnly(pathname.startsWith('/sedi'))}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </Link>
          )}

          {/* Admin sede: stessa pagina gestione operatori / IMAP / PIN (vista solo propria sede). */}
          {isAdminSede &&
            !isMasterAdmin &&
            me?.sede_id &&
            sessionCanNavigateSediList &&
            !collapsed && (
            <Link href="/sedi" onClick={onClose} className={navLink(pathname === '/sedi')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="truncate">{gestisciSediLinkLabel}</span>
            </Link>
          )}
          {isAdminSede && !isMasterAdmin && me?.sede_id && sessionCanNavigateSediList && collapsed && (
            <Link
              href="/sedi"
              onClick={onClose}
              title={gestisciSediLinkLabel}
              className={iconOnly(pathname === '/sedi')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </Link>
          )}

          {/* ── Operator: Fornitori section ── */}
          {!isMasterAdmin && !collapsed && (
            <div>
              <button
                onClick={() => setFornitoriOpen(o => !o)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${pathname.startsWith('/fornitori') ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[7px]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[7px]'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{t.nav.fornitori}</span>
                  {fornitori.length > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded border border-cyan-500/35 bg-cyan-500/15 px-1 text-[10px] font-medium tabular-nums text-cyan-200">
                      {fornitori.length}
                    </span>
                  )}
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${fornitoriOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fornitoriOpen && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2">
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
                    const isActive =
                      pathname === `/fornitori/${f.id}` || pathname.startsWith(`/fornitori/${f.id}/`)
                    return (
                      <Link key={f.id} href={`/fornitori/${f.id}`} onClick={onClose}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${isActive ? 'bg-cyan-500/15 text-white' : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-100'}`}>
                        <span className={`w-1 h-1 rounded-full shrink-0 ${isActive ? 'bg-cyan-400' : 'bg-current opacity-50'}`} />
                        <span className="min-w-0 flex-1 truncate">{fornitoreDisplayLabel(f)}</span>
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

          {/* Operator collapsed: Listino + Fornitori */}
          {!isMasterAdmin && collapsed && (
            <>
              <Link
                href="/listino"
                onClick={onClose}
                title={t.fornitori.tabListino}
                className={iconOnly(pathname.startsWith('/listino'))}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                </svg>
              </Link>
              <Link href="/fornitori" onClick={onClose} title={t.nav.fornitori}
                className={iconOnly(pathname.startsWith('/fornitori'))}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </>
          )}

          {/* Resto voci piatte. Fornitori: solo per master — operatori/admin sede hanno già il blocco espandibile sopra (o l’icona se sidebar compatta). */}
          {navItems
            .slice(1)
            .filter((item) => isMasterAdmin || item.href !== '/fornitori')
            .map((item) => {
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
          </div>

          <div
            className="flex w-full shrink-0 justify-center border-t border-slate-800/40 py-2"
          >
            <button
              type="button"
              onClick={() => onCollapsedChange(!collapsed)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-cyan-400/70 shadow-sm transition-[background-color,color,box-shadow] duration-[600ms] ease-[cubic-bezier(0.08,0.82,0.17,1)] hover:bg-slate-800/70 hover:text-cyan-300 hover:shadow-md hover:shadow-cyan-500/10 active:bg-slate-700/70 active:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              title={collapsed ? t.ui.expandSidebar : t.ui.collapseSidebar}
              aria-label={collapsed ? t.ui.expandSidebar : t.ui.collapseSidebar}
            >
              {collapsed ? (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              ) : (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {/* ── Role / Sede badge (espansa: card testo; compatta: icone centrate + title) ── */}
        {(isMasterAdmin || sedeNome || isAdminSede) && collapsed ? (
            <div className="flex shrink-0 flex-col items-center gap-1 px-1 pb-1.5">
              {isMasterAdmin ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10"
                  title={t.sedi.adminRole}
                  role="status"
                  aria-label={t.sedi.adminRole}
                >
                  <svg className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
              ) : null}
              {!isMasterAdmin && isAdminSede ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10"
                  title={t.sedi.adminSedeRole}
                  role="status"
                  aria-label={t.sedi.adminSedeRole}
                >
                  <svg className="h-4 w-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </span>
              ) : null}
              {!isMasterAdmin && sedeNome ? (
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80"
                  title={sedeNome}
                  role="status"
                  aria-label={sedeNome}
                >
                  <svg className="h-4 w-4 text-cyan-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              ) : null}
            </div>
          ) : null}

        {!collapsed && isMasterAdmin ? (
          <div className="px-2 pb-2">
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="text-[11px] font-semibold leading-snug text-amber-300/80 text-balance">{t.sedi.adminRole}</span>
            </div>
          </div>
        ) : null}

        {/* ── Sede + operatore (stessa riga compatta: bordo slate, py-1.5, testo 11px) ── */}
        {!collapsed && !isMasterAdmin ? (
          <div className="px-2 pb-2">
            <div className="space-y-1.5">
              {isAdminSede ? (
                <div className="flex items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-violet-200 shadow-[0_0_10px_rgba(196,181,253,0.75),0_0_22px_rgba(139,92,246,0.45)]" />
                  <span className="text-[11px] font-semibold text-violet-200/90">{t.sedi.adminSedeRole}</span>
                </div>
              ) : null}
              {sedeNome ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.75),0_0_22px_rgba(6,182,212,0.45)]" />
                  <span className="min-w-0 truncate">{sedeNome}</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={openSwitchModal}
                title={operatorDockAria}
                aria-label={operatorDockAria}
                className="flex w-full touch-manipulation items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-left text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/25"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.75),0_0_22px_rgba(6,182,212,0.45)]" />
                <span className="min-w-0 flex-1 truncate">{operatorDockName}</span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-50 [text-shadow:0_0_12px_rgba(103,232,249,0.7),0_0_24px_rgba(6,182,212,0.35)]">
                  {t.ui.changeOperatorShort}
                </span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Collapsed: switch icon */}
        {!isMasterAdmin && collapsed && (
          <div className="px-1 pb-1">
            <button
              type="button"
              onClick={openSwitchModal}
              title={operatorDockAria}
              aria-label={operatorDockAria}
              className="relative mx-auto flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-cyan-300"
            >
              <span className="text-xs font-bold text-cyan-300">
                {operatorDockInitial}
              </span>
              {operatorDockName !== t.ui.noOperator && (
                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-slate-900 bg-cyan-400" />
              )}
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div
          className={`border-t border-slate-800 ${collapsed ? 'space-y-0.5 px-1 py-2' : 'space-y-1 px-2 py-2.5'}`}
        >

          {/* Language switcher */}
          {!collapsed && (
            <div className="relative z-[100]">
              <button
                onClick={() => setLangOpen(o => !o)}
                className="group w-full flex items-center gap-2 px-2 py-1.5 text-slate-500 hover:bg-slate-800/60 rounded-lg transition-colors text-[11px]"
              >
                <span className="text-sm leading-none">{LOCALES.find(l => l.code === locale)?.flag ?? '🌐'}</span>
                <span className="font-medium text-cyan-50 [text-shadow:0_0_12px_rgba(103,232,249,0.7),0_0_24px_rgba(6,182,212,0.35)] group-hover:text-cyan-100 group-hover:[text-shadow:0_0_14px_rgba(103,232,249,0.85),0_0_28px_rgba(6,182,212,0.4)]">
                  {LOCALES.find(l => l.code === locale)?.label ?? locale}
                </span>
                <svg className={`w-3 h-3 ml-auto transition-transform ${langOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {langOpen && (
                <div className="absolute bottom-full mb-1 left-0 right-0 z-[100] max-h-[min(240px,calc(100vh-6rem))] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
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
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100'
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
            <div className="relative z-[100]">
              <button
                onClick={() => setLangOpen(o => !o)}
                title={t.ui.languageTooltip}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm text-slate-600 transition-colors hover:bg-slate-800/70 hover:text-slate-300"
              >
                {LOCALES.find(l => l.code === locale)?.flag ?? '🌐'}
              </button>
              {langOpen && (
                <div className="absolute bottom-0 left-full z-[100] ml-2 max-h-[min(240px,calc(100vh-6rem))] w-40 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
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
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100'
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
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800/70 hover:text-slate-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/impostazioni"
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  pathname === '/impostazioni' ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[7px]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[7px]'
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
                className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  pathname === '/guida' ? 'bg-cyan-500/15 text-white border-l-2 border-cyan-500 pl-[7px]' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border-l-2 border-transparent pl-[7px]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">{t.nav.guida}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 text-xs font-medium rounded-lg transition-colors"
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
