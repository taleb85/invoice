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
import { clearSessionOperatorGate } from '@/lib/session-operator-gate'
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
  const [allSedi, setAllSedi] = useState<{ id: string; nome: string }[]>([])
  const [branchesOpen, setBranchesOpen] = useState(true)
  const [activeSede, setActiveSede] = useState<string | null>(null)
  const [fornitori, setFornitori] = useState<{ id: string; nome: string; display_name: string | null }[]>([])
  const [fornitoriOpen, setFornitoriOpen] = useState(true)
  const [fornitoriSearch, setFornitoriSearch] = useState('')
  const [langOpen, setLangOpen] = useState(false)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

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
        setActiveSede(null)
      } else {
        setActiveSede(savedSede || null)
      }
    }
  }, [me, activeOperator])

  const switchSede = (sedeId: string) => {
    document.cookie = 'fluxo-acting-role=; path=/; Max-Age=0; SameSite=Strict'
    document.cookie = `admin-sede-id=${encodeURIComponent(sedeId)}; path=/; SameSite=Strict`
    setActiveSede(sedeId)
    router.push('/')
    router.refresh()
  }

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
  ]

  const fornitoriSearchLower = fornitoriSearch.toLowerCase()
  const filteredFornitori = fornitori.filter((f) => {
    if (!fornitoriSearchLower) return true
    const label = fornitoreDisplayLabel(f).toLowerCase()
    const nome = (f.nome ?? '').toLowerCase()
    const alias = (f.display_name ?? '').toLowerCase()
    return label.includes(fornitoriSearchLower) || nome.includes(fornitoriSearchLower) || alias.includes(fornitoriSearchLower)
  })

  const { displayName: operatorDockName } = resolvedOperatorDockDisplay(
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

  // Fetch pending approvals count for admin/admin_sede badge
  useEffect(() => {
    if (!isMasterAdmin && !isAdminSede) return
    let cancelled = false
    const fetchCount = () => {
      fetch('/api/fatture/pending-approval')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { count?: number } | null) => {
          if (!cancelled && d?.count != null) setPendingApprovalCount(d.count)
        })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60_000) // refresh every minute
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMasterAdmin, isAdminSede])

  const analyticsNavItem = {
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  }

  const approvazioniNavItem = {
    label: 'Approvazioni',
    href: '/approvazioni',
    count: pendingApprovalCount,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }

  const attivitaNavItem = {
    label: 'Attività',
    href: '/attivita',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    analyticsNavItem,
    approvazioniNavItem,
    attivitaNavItem,
    {
      label: t.nav.fornitori,
      href: '/fornitori',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    logEmailNavItem,
  ]

  const navItems = isMasterAdmin
    ? adminNavItems
    : isAdminSede
      ? [operatoreNavItems[0], analyticsNavItem, approvazioniNavItem, attivitaNavItem, logEmailNavItem, ...operatoreNavItems.slice(1)]
      : operatoreNavItems

  const handleLogout = async () => {
    try {
      localStorage.removeItem('fluxo-active-operator')
      localStorage.removeItem('fluxo-active-operator-user')
    } catch {
      /* ignore */
    }
    clearSessionOperatorGate()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Shared icon-link style helpers
  const navLink = (isActive: boolean) =>
    `flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap overflow-hidden ${
      isActive
        ? 'border-l-2 border-app-cyan-400/90 bg-gradient-to-r from-app-line-15 to-app-a-20 pl-[7px] text-app-fg shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]'
        : 'border-l-2 border-transparent bg-transparent pl-[7px] text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
    }`

  return (
    <div
      suppressHydrationWarning
      className="app-shell-rail-panel flex min-h-0 min-w-0 flex-1 flex-col px-2.5 lg:px-3"
    >
        <nav className="app-shell-rail-panel relative z-0 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-hidden text-app-fg">
          <div className="app-shell-rail-panel min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto py-2.5">
          {/* Dashboard */}
          {navItems.slice(0, 1).map((item) => {
            const isActive = pathname === '/'
            return (
              <Link key={item.href} href={item.href} onClick={onClose} className={navLink(isActive)}>
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}

          {/* ── Admin: Sede Switcher ── */}
          {isMasterAdmin && (
            <div className="bg-transparent">
              <button
                onClick={() => setBranchesOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="min-w-0 truncate">
                    {activeSede
                      ? (allSedi.find(s => s.id === activeSede)?.nome ?? t.nav.sediNavGroupMaster)
                      : t.nav.sediNavGroupMaster}
                  </span>
                  {activeSede && (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" aria-hidden />
                  )}
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${branchesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {branchesOpen && (
                <div className="app-shell-rail-panel ml-3 mt-0.5 space-y-0.5 border-l border-app-line-22 pl-2">
                  {/* Sede items: click = attiva sede, gear = gestisci */}
                  {allSedi.map((s) => {
                    const isCurrent = s.id === activeSede
                    return (
                      <div key={s.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { switchSede(s.id); onClose?.() }}
                          title={isCurrent ? `Sede attiva: ${s.nome}` : `Passa a: ${s.nome}`}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-colors touch-manipulation ${
                            isCurrent
                              ? 'border border-cyan-500/35 bg-cyan-500/10 text-cyan-100'
                              : 'bg-transparent text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${isCurrent ? 'bg-cyan-400' : 'bg-current opacity-40'}`} aria-hidden />
                          <span className="min-w-0 truncate">{s.nome}</span>
                          {isCurrent && (
                            <svg className="ml-auto h-3 w-3 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <Link
                          href={`/sedi/${s.id}`}
                          onClick={onClose}
                          title={`Impostazioni ${s.nome}`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-fg-muted opacity-0 transition-opacity hover:bg-app-line-10 hover:text-app-fg group-hover:opacity-100 focus:opacity-100"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </Link>
                      </div>
                    )
                  })}
                  <Link href="/sedi" onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${pathname === '/sedi' ? 'bg-app-line-10 text-app-fg' : 'bg-transparent text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'}`}>
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

          {/* Admin sede: stessa pagina gestione operatori / IMAP / PIN (vista solo propria sede). */}
          {isAdminSede &&
            !isMasterAdmin &&
            me?.sede_id &&
            sessionCanNavigateSediList && (
            <Link href="/sedi" onClick={onClose} className={navLink(pathname === '/sedi')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="truncate">{gestisciSediLinkLabel}</span>
            </Link>
          )}

          {/* ── Operator: Fornitori section ── */}
          {!isMasterAdmin && (
            <div className="bg-transparent">
              <button
                onClick={() => setFornitoriOpen(o => !o)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${pathname.startsWith('/fornitori') ? 'border-l-2 border-app-cyan-400/85 bg-app-line-10 pl-[7px] text-app-fg shadow-[inset_0_0_16px_rgba(6,182,212,0.08)]' : 'border-l-2 border-transparent bg-transparent pl-[7px] text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{t.nav.fornitori}</span>
                  {fornitori.length > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded border border-app-line-25 bg-transparent px-1 text-[10px] font-semibold tabular-nums text-app-fg-muted">
                      {fornitori.length}
                    </span>
                  )}
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${fornitoriOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {fornitoriOpen && (
                <div className="app-shell-rail-panel ml-3 mt-0.5 space-y-0.5 border-l border-app-line-22 pl-2">
                  {/* Search */}
                  {fornitori.length > 5 && (
                    <div className="px-1 py-1">
                      <input
                        type="text"
                        value={fornitoriSearch}
                        onChange={e => setFornitoriSearch(e.target.value)}
                        placeholder={t.nav.cerca}
                        className="w-full rounded-md border border-app-line-28 bg-transparent px-2 py-1 text-[11px] text-app-fg placeholder:text-app-fg-muted focus:outline-none focus:ring-2 focus:ring-app-a-35"
                      />
                    </div>
                  )}

                  {/* All suppliers */}
                  <Link href="/fornitori" onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${pathname === '/fornitori' ? 'bg-app-line-10 text-app-fg' : 'bg-transparent text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'}`}>
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
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${isActive ? 'bg-app-line-10 text-app-fg' : 'bg-transparent text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'}`}>
                        <span className={`h-1 w-1 shrink-0 rounded-full ${isActive ? 'bg-app-cyan-400' : 'bg-current opacity-50'}`} />
                        <span className="min-w-0 flex-1 truncate">{fornitoreDisplayLabel(f)}</span>
                      </Link>
                    )
                  })}

                  {filteredFornitori.length > 30 && (
                    <p className="px-2 py-1 text-[10px] text-app-fg-muted">
                      +{filteredFornitori.length - 30} {t.nav.altriRisultati}
                    </p>
                  )}
                  {fornitoriSearch && filteredFornitori.length === 0 && (
                    <p className="px-2 py-1.5 text-[10px] text-app-fg-muted">{t.nav.nessunRisultato}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Resto voci piatte. Fornitori: solo per master — operatori/admin sede hanno già il blocco espandibile sopra (o l’icona se sidebar compatta). */}
          {navItems
            .slice(1)
            .filter((item) => isMasterAdmin || item.href !== '/fornitori')
            .map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              const hasBadge = (item as { badge?: boolean }).badge
              const itemCount = (item as { count?: number }).count
              return (
                <Link key={item.href} href={item.href} onClick={onClose} className={`${navLink(isActive)} relative`}>
                  {item.icon}
                  <span className="truncate flex-1">{item.label}</span>
                  {hasBadge && <span className="ml-auto shrink-0 w-2 h-2 rounded-full bg-red-500" />}
                  {itemCount != null && itemCount > 0 && (
                    <span className="ml-auto shrink-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold tabular-nums text-white">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* ── Stesso canvas dell’aside: solo separatore + padding (contesto, lingua, utilità) ── */}
        <div className="app-shell-rail-panel relative z-0 mt-auto flex shrink-0 flex-col gap-2 border-t border-app-line-22 -mx-2.5 px-2.5 py-2.5 text-app-fg lg:-mx-3 lg:px-3">
          <div className="app-shell-rail-panel space-y-1.5">
            {isMasterAdmin ? (
              <div className="flex items-center gap-2 rounded-lg border border-app-line-25 bg-transparent px-2 py-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                <span className="text-[11px] font-semibold leading-snug text-app-fg-muted text-balance">{t.sedi.adminRole}</span>
              </div>
            ) : null}

            {!isMasterAdmin ? (
              <div className="app-shell-rail-panel space-y-1.5">
                {isAdminSede ? (
                  <div className="flex items-center gap-2 rounded-lg border border-app-line-25 bg-transparent px-2 py-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-app-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.38)]" />
                    <span className="text-[11px] font-semibold text-app-fg-muted">{t.sedi.adminSedeRole}</span>
                  </div>
                ) : null}
                {sedeNome ? (
                  <div className="flex items-center gap-1.5 rounded-lg border border-app-line-25 bg-transparent px-3 py-2 text-xs font-bold text-app-fg">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-app-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.32)]" />
                    <span className="min-w-0 truncate">{sedeNome}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={openSwitchModal}
                  title={operatorDockAria}
                  aria-label={operatorDockAria}
                  className="flex w-full touch-manipulation items-center gap-1.5 rounded-lg border border-app-line-25 bg-transparent px-3 py-2 text-left text-xs font-bold text-app-fg transition-colors hover:bg-app-line-10"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-app-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.32)]" />
                  <span className="min-w-0 flex-1 truncate">{operatorDockName}</span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-app-fg-muted">
                    {t.ui.changeOperatorShort}
                  </span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="app-shell-rail-panel space-y-1 border-t border-app-line-22 pt-2">
          {/* Language switcher */}
            <div className="relative z-10 bg-transparent">
              <button
                onClick={() => setLangOpen(o => !o)}
                className="group flex w-full items-center gap-2 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[11px] text-app-fg-muted transition-colors hover:border-app-line-30 hover:bg-app-line-10"
              >
                <span className="text-sm leading-none">{LOCALES.find(l => l.code === locale)?.flag ?? '🌐'}</span>
                <span className="min-w-0 flex-1 truncate text-left font-medium text-app-fg group-hover:text-app-fg">
                  {LOCALES.find(l => l.code === locale)?.label ?? locale}
                </span>
                <svg
                  className={`ml-auto h-3 w-3 shrink-0 text-app-fg-muted transition-transform group-hover:text-app-fg-muted ${langOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {langOpen && (
                <div className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-[min(240px,calc(100vh-6rem))] overflow-y-auto overflow-x-hidden rounded-xl border border-app-line-28 app-workspace-surface-elevated text-app-fg shadow-[0_16px_40px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-app-line-15 backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)] backdrop-saturate-150">
                  {LOCALES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => {
                        if (l.code === locale) { setLangOpen(false); return }
                        setLocale(l.code)
                        setLangOpen(false)
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors ${
                        locale === l.code
                          ? 'bg-app-a-25 text-app-fg'
                          : 'text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
                      }`}
                    >
                      <span className="text-sm">{l.flag}</span>
                      <span>{l.label}</span>
                      {locale === l.code && (
                        <svg className="ml-auto h-3 w-3 text-app-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

              <Link
                href="/impostazioni"
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                  pathname === '/impostazioni'
                    ? 'border-l-2 border-app-cyan-400/85 bg-app-line-10 pl-[7px] text-app-fg'
                    : 'border-l-2 border-transparent bg-transparent pl-[7px] text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
                }`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{t.nav.impostazioni}</span>
              </Link>

              <Link
                href="/guida"
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                  pathname === '/guida'
                    ? 'border-l-2 border-app-cyan-400/85 bg-app-line-10 pl-[7px] text-app-fg'
                    : 'border-l-2 border-transparent bg-transparent pl-[7px] text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
                }`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">{t.nav.guida}</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-xs font-semibold text-app-fg-muted transition-colors hover:border-app-line-25 hover:bg-app-line-10 hover:text-app-fg"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="truncate">{t.nav.esci}</span>
              </button>
          </div>
        </div>
    </div>
  )
}
