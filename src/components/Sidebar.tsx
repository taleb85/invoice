'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useRef, useState } from 'react'
import { LOCALES } from '@/lib/translations'
import { GlyphGlobe, LocaleCodeChip } from '@/components/ui/glyph-icons'
import { useMe } from '@/lib/me-context'
import { useLocale } from '@/lib/locale-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { getAssociatedSedeNome, navGestisciSediLabel } from '@/lib/gestisci-sede-label'
import { resolvedOperatorDockDisplay } from '@/lib/operator-dock-display'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { effectiveIsAdminSedeUi, profileCanAccessSediListPage } from '@/lib/effective-operator-ui'
import { fornitoreDisplayLabel, fornitoreDisplayLabelUppercase } from '@/lib/fornitore-display'
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
  const [footerOpen, setFooterOpen] = useState(false)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  /** Cookie `admin-sede-id` può cambiare senza aggiornare `me` — niente memo. */
  const gestisciSediLinkLabel = navGestisciSediLabel(t, getAssociatedSedeNome(me, getCookie))

  // Close tablet overlay only when the user genuinely navigates to a different path.
  // Using a ref instead of mounting flag so same-path router.refresh() calls are ignored.
  const openPathRef = useRef(pathname)
  useEffect(() => {
    if (pathname === openPathRef.current) return
    openPathRef.current = pathname
    onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: close on nav, not on onClose identity change
  }, [pathname])

  useEffect(() => {
    if (!me) return

    const actingAsStaff = Boolean(me.is_admin && activeOperator)
    if (actingAsStaff && activeOperator) {
      setSedeNome(activeOperator.sede_nome ?? me.sede_nome)
    } else {
      setSedeNome(me.sede_nome)
    }

    if (!me.is_admin) {
      setAllSedi([])
      setActiveSede(null)
    } else {
      const list = me.all_sedi ?? []
      setAllSedi(list)
      if (list.length === 0) {
        document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
        setActiveSede(null)
      } else {
        const savedSede = getCookie('admin-sede-id')
        if (savedSede && !list.some((s) => s.id === savedSede)) {
          document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
          setActiveSede(null)
        } else {
          setActiveSede(savedSede || null)
        }
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

  const clearSede = () => {
    document.cookie = 'admin-sede-id=; path=/; Max-Age=0; SameSite=Strict'
    document.cookie = 'fluxo-acting-role=; path=/; Max-Age=0; SameSite=Strict'
    setActiveSede(null)
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
      iconColor: icon.home,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: t.nav.fornitori,
      href: '/fornitori',
      iconColor: icon.fornitori,
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
    iconColor: icon.emailSync,
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
  }, [isMasterAdmin, isAdminSede])

  const analyticsNavItem = {
    label: t.nav.analytics,
    href: '/analytics',
    iconColor: icon.analytics,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
  }

  const approvazioniNavItem = {
    label: t.nav.approvazioni,
    href: '/approvazioni',
    count: pendingApprovalCount,
    iconColor: icon.approvazioni,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
      </svg>
    ),
  }

  const attivitaNavItem = {
    label: t.nav.attivita,
    href: '/attivita',
    iconColor: icon.analytics,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
    ),
  }

  const backupNavItem = {
    label: t.nav.backup,
    href: '/backup',
    iconColor: icon.settingsTools,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4-8 4s8 1.79 8 4"/>
      </svg>
    ),
  }

  const consumiAiNavItem = {
    label: t.nav.consumiAi,
    href: '/consumi-ai',
    iconColor: icon.analytics,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  }

  const adminNavItems = [
    {
      label: t.nav.dashboard,
      href: '/',
      iconColor: icon.home,
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
      iconColor: icon.fornitori,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    logEmailNavItem,
    backupNavItem,
  ]

  // Gestionale senza cookie sede: in rail solo ciò che serve al portale (dashboard, backup).
  // Analytics, approvazioni, attività, log: solo con sede attiva (`admin-sede-id`).
  // consumiAiNavItem è renderizzato direttamente subito dopo Dashboard, non entra in navItems.
  const masterOnlyItems = [adminNavItems[0], adminNavItems[6]]
  const masterWithSedeItems = [...adminNavItems]
  const navItems = isMasterAdmin
    ? (activeSede ? masterWithSedeItems : masterOnlyItems)
    : isAdminSede
      ? [operatoreNavItems[0], analyticsNavItem, approvazioniNavItem, attivitaNavItem, logEmailNavItem, ...operatoreNavItems.slice(1)]
      : operatoreNavItems

  /** Portale globale: Portale + Consumi AI + Backup restano in testa (non scrollano con sedi/fornitori). */
  const portaleLinksFixedBackup = isMasterAdmin && !activeSede

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
    `flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${
      isActive
        ? 'border-l-2 border-app-cyan-400/90 bg-gradient-to-r from-app-line-15 to-app-a-20 pl-[10px] text-app-fg shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]'
        : 'border-l-2 border-transparent bg-transparent pl-[10px] text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
    }`

  return (
    <div
      suppressHydrationWarning
      className="app-shell-rail-panel flex min-h-0 min-w-0 flex-1 flex-col px-2.5 lg:px-3"
    >
        <nav className="app-shell-rail-panel relative z-0 flex min-h-0 flex-1 flex-col text-app-fg">
          <div className="app-shell-rail-panel shrink-0 space-y-0.5 border-b border-app-line-22 bg-slate-950/75 py-2 backdrop-blur-md">
          {/* Dashboard / Portale Gestionale */}
          {navItems.slice(0, 1).map((item) => {
            const isActive = pathname === '/'
            const iconColor = (item as { iconColor?: string }).iconColor
            // In gestionale puro (nessuna sede), il link principale diventa "Portale Gestionale"
            // e al click ripulisce anche il cookie sede per sicurezza.
            const isGestionalePuro = isMasterAdmin && !activeSede
            const label = isGestionalePuro ? t.sedi.adminRole : item.label
            const handleClick = () => {
              if (isGestionalePuro) clearSede()
              onClose?.()
              router.push(item.href)
            }
            return (
              <Link key={item.href} href={item.href} onClick={handleClick} className={navLink(isActive)}>
                <span className={`shrink-0 ${isActive ? (iconColor ?? 'text-app-cyan-300') : (iconColor ? `${iconColor}/75` : 'text-app-fg-muted')}`}>
                  {item.icon}
                </span>
                <span className="truncate">{label}</span>
              </Link>
            )
          })}

          {/* Consumi AI — solo gestionale, subito dopo Dashboard */}
          {isMasterAdmin && (() => {
            const item = consumiAiNavItem
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { onClose?.(); router.push(item.href) }}
                className={`${navLink(isActive)} relative min-w-0`}
              >
                <span className={`shrink-0 ${isActive ? (item.iconColor ?? 'text-app-cyan-300') : `${item.iconColor}/75`}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })()}

          {portaleLinksFixedBackup &&
            (() => {
              const item = backupNavItem
              const isActive = pathname.startsWith(item.href)
              const iconColor = item.iconColor
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    onClose?.()
                    router.push(item.href)
                  }}
                  className={`${navLink(isActive)} relative min-w-0`}
                >
                  <span className={`shrink-0 ${isActive ? (iconColor ?? 'text-app-cyan-300') : `${iconColor}/75`}`}>
                    {item.icon}
                  </span>
                  <span className="truncate flex-1 min-w-0">{item.label}</span>
                </Link>
              )
            })()}
          </div>

          <div className="app-shell-rail-panel min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-2 pb-3">
          {/* Admin sede: stessa pagina gestione operatori / IMAP / PIN (vista solo propria sede). */}
          {isAdminSede &&
            !isMasterAdmin &&
            me?.sede_id &&
            sessionCanNavigateSediList && (
            <Link href="/sedi" onClick={onClose} className={navLink(pathname === '/sedi')}>
              <svg className={`w-4 h-4 shrink-0 ${icon.fornitori}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="truncate">{gestisciSediLinkLabel}</span>
            </Link>
          )}

          {/* Main flat nav items — rendered before Fornitori expandable.
              In portale globale master le voci sono limitate da `masterOnlyItems`. */}
          {navItems
            .slice(1)
            .filter(
              (item) =>
                (isMasterAdmin || item.href !== '/fornitori') &&
                !(portaleLinksFixedBackup && item.href === '/backup'),
            )
            .map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              const hasBadge = (item as { badge?: boolean }).badge
              const itemCount = (item as { count?: number }).count
              const iconColor = (item as { iconColor?: string }).iconColor
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    onClose?.()
                    router.push(item.href)
                  }}
                  className={`${navLink(isActive)} relative min-w-0`}
                >
                  <span className={`shrink-0 ${isActive ? (iconColor ?? 'text-app-cyan-300') : (iconColor ? `${iconColor}/75` : 'text-app-fg-muted')}`}>
                    {item.icon}
                  </span>
                  <span className="truncate flex-1 min-w-0">{item.label}</span>
                  {hasBadge && <span className="ml-auto shrink-0 w-2 h-2 rounded-full bg-red-500" />}
                  {itemCount != null && itemCount > 0 && (
                    <span className="ml-auto shrink-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold tabular-nums text-white">
                      {itemCount > 99 ? '99+' : itemCount}
                    </span>
                  )}
                </Link>
              )
            })}

          {/* ── Operator: Fornitori expandable section (below main nav items) ── */}
          {!isMasterAdmin && (
            <div className="bg-transparent">
              <button
                onClick={() => setFornitoriOpen(o => !o)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${pathname.startsWith('/fornitori') ? 'border-l-2 border-app-cyan-400/85 bg-app-line-10 pl-[10px] text-app-fg shadow-[inset_0_0_16px_rgba(6,182,212,0.08)]' : 'border-l-2 border-transparent bg-transparent pl-[10px] text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <svg className={`w-4 h-4 shrink-0 ${icon.fornitori}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{t.nav.fornitori}</span>
                  {fornitori.length > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded border border-app-line-25 bg-transparent px-1 text-[10px] font-semibold tabular-nums text-app-fg-muted">
                      {fornitori.length}
                    </span>
                  )}
                </span>
                <svg className={`w-3 h-3 shrink-0 transition-transform ${icon.settingsTools} ${fornitoriOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        className="w-full rounded-md border border-app-line-28 bg-transparent px-2 py-1 text-[11px] text-app-fg placeholder:text-app-fg-placeholder focus:outline-none focus:ring-2 focus:ring-app-a-35"
                      />
                    </div>
                  )}

                  {/* All suppliers */}
                  <Link href="/fornitori" onClick={onClose}
                    className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${pathname === '/fornitori' ? 'bg-app-line-10 text-app-fg' : 'bg-transparent text-app-fg-subtle hover:bg-app-line-10 hover:text-app-fg'}`}>
                    <svg className={`w-3 h-3 shrink-0 ${icon.fornitori}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="truncate">{t.nav.tuttiFornitori}</span>
                  </Link>

                  {/* Individual links */}
                  {filteredFornitori.map((f) => {
                    const isActive =
                      pathname === `/fornitori/${f.id}` || pathname.startsWith(`/fornitori/${f.id}/`)
                    return (
                      <Link key={f.id} href={`/fornitori/${f.id}`} onClick={onClose}
                        className={`flex items-center gap-2 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${isActive ? 'bg-app-line-10 text-app-fg' : 'bg-transparent text-app-fg-subtle hover:bg-app-line-10 hover:text-app-fg'}`}>
                        <span className={`h-1 w-1 shrink-0 rounded-full ${isActive ? 'bg-app-cyan-400' : 'bg-current opacity-50'}`} />
                        <span className="min-w-0 flex-1 truncate">{fornitoreDisplayLabelUppercase(f)}</span>
                      </Link>
                    )
                  })}

                  {fornitoriSearch && filteredFornitori.length === 0 && (
                    <p className="px-2 py-1.5 text-[10px] text-app-fg-muted">{t.nav.nessunRisultato}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Admin: Sede Switcher + Gestisci sedi — ultimo nella lista nav scrollabile ── */}
          {isMasterAdmin && (
            <>
            <div className="bg-transparent">
              <button
                onClick={() => setBranchesOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <svg className={`w-4 h-4 shrink-0 ${icon.fornitori}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className={`w-3 h-3 shrink-0 transition-transform ${icon.settingsTools} ${branchesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {branchesOpen && (
                <div className="app-shell-rail-panel ml-3 mt-0.5 max-h-[min(45vh,18rem)] overflow-y-auto overflow-x-hidden border-l border-app-line-22 pl-2 overscroll-y-contain">
                  <div className="space-y-0.5 pb-1">
                    {allSedi.map((s) => {
                      const isCurrent = s.id === activeSede
                      return (
                        <div key={s.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { switchSede(s.id); onClose?.() }}
                            title={isCurrent ? t.ui.sidebarSedeActive.replace('{name}', s.nome) : t.ui.sidebarSedeSwitchTo.replace('{name}', s.nome)}
                            className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-semibold transition-colors touch-manipulation ${
                              isCurrent
                                ? 'border border-cyan-500/35 bg-cyan-500/10 text-cyan-100'
                                : 'bg-transparent text-app-fg-subtle hover:bg-app-line-10 hover:text-app-fg'
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
                            title={t.ui.sidebarSedeSettings.replace('{name}', s.nome)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-fg-muted opacity-0 transition-opacity hover:bg-app-line-10 hover:text-app-fg group-hover:opacity-100 focus:opacity-100"
                          >
                            <svg className={`h-3 w-3 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                  {activeSede ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearSede()
                        onClose?.()
                      }}
                      title={t.dashboard.adminPortalGlobalNavHint}
                      className="mt-1.5 flex w-full min-w-0 items-center gap-2 rounded-lg border border-[rgba(34,211,238,0.22)] bg-cyan-500/[0.07] px-2 py-2 text-left text-xs font-semibold text-cyan-100/95 transition-colors hover:bg-cyan-500/12 hover:text-cyan-50"
                    >
                      <svg
                        className="h-4 w-4 shrink-0 text-cyan-400/90"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      <span className="min-w-0 leading-snug">{t.nav.sedeGlobalOverview}</span>
                    </button>
                  ) : null}
                </div>
              )}
            </div>

          <Link
            href="/sedi"
            onClick={onClose}
            className={navLink(pathname === '/sedi')}
          >
            <span className={`shrink-0 ${pathname === '/sedi' ? icon.settingsTools : 'text-slate-400/75'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <span className="truncate">{gestisciSediLinkLabel}</span>
          </Link>
            </>
          )}
          </div>
        </nav>

        {/* ── Footer espandibile: riga contesto + pannello opzionale + riga icone ── */}
        <div className="app-shell-rail-panel relative z-20 mt-auto flex shrink-0 flex-col border-t border-app-line-22 -mx-2.5 px-2.5 py-1.5 text-app-fg lg:-mx-3 lg:px-3">

          {/* Riga 1 — contesto + chevron espandi */}
          <div className="flex items-center gap-1">
            {isMasterAdmin ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-app-fg-subtle">{t.sedi.adminRole}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={openSwitchModal}
                title={operatorDockAria}
                aria-label={operatorDockAria}
                className="group flex min-w-0 flex-1 touch-manipulation items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-app-line-10"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                {sedeNome && (
                  <span className="shrink-0 max-w-[56px] truncate text-[11px] font-medium text-app-fg-subtle">{sedeNome}</span>
                )}
                {sedeNome && <span className="shrink-0 text-[11px] text-app-fg-subtle">·</span>}
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-app-fg-muted">{operatorDockName}</span>
                <svg className={`ml-1 h-3 w-3 shrink-0 ${icon.settingsTools} transition-colors group-hover:opacity-80`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
            )}
            {/* Chevron espandi/comprimi */}
            <button
              type="button"
              onClick={() => setFooterOpen(o => !o)}
              title={footerOpen ? t.ui.collapseSidebar : t.ui.expandSidebar}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-app-fg-subtle transition-colors hover:bg-app-line-10 hover:text-app-fg-muted"
            >
              <svg className={`h-3 w-3 transition-transform ${icon.settingsTools} ${footerOpen ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Pannello espanso */}
          {footerOpen && (
            <div className="mt-1.5 space-y-0.5 border-t border-app-line-18 pt-1.5">
              {/* Ruolo */}
              {isMasterAdmin && (
                <div className="flex items-center gap-2 rounded-lg border border-app-line-25 bg-transparent px-2 py-1">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]" />
                  <span className="text-[11px] font-semibold text-app-fg-subtle text-balance">{t.sedi.adminRole}</span>
                </div>
              )}
              {!isMasterAdmin && isAdminSede && (
                <div className="flex items-center gap-2 rounded-lg border border-app-line-25 bg-transparent px-2 py-1">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]" />
                  <span className="text-[11px] font-semibold text-app-fg-subtle">{t.sedi.adminSedeRole}</span>
                </div>
              )}
              {!isMasterAdmin && sedeNome && (
                <div className="flex items-center gap-2 rounded-lg border border-app-line-25 bg-transparent px-2 py-1 text-xs font-bold text-app-fg">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-cyan-400/90" />
                  <span className="min-w-0 truncate">{sedeNome}</span>
                </div>
              )}
              {/* Settings */}
              <Link
                href="/impostazioni"
                onClick={() => setFooterOpen(false)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${pathname === '/impostazioni' ? 'text-app-fg bg-app-line-10' : 'text-app-fg-subtle hover:bg-app-line-10 hover:text-app-fg'}`}
              >
                <svg className={`h-3.5 w-3.5 shrink-0 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{t.nav.impostazioni}</span>
              </Link>
              <Link
                href="/strumenti/centro-operazioni"
                title={t.strumentiCentroOperazioni.pageTitle}
                onClick={() => setFooterOpen(false)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                  pathname?.startsWith('/strumenti') ? 'text-app-fg bg-app-line-10' : 'text-app-fg-subtle hover:bg-app-line-10 hover:text-app-fg'
                }`}
              >
                <svg className={`h-3.5 w-3.5 shrink-0 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm8 9a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM6 17a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm14-11a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                </svg>
                <span className="truncate">{t.nav.strumenti}</span>
              </Link>
              {/* Help */}
              <Link
                href="/guida"
                onClick={() => setFooterOpen(false)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${pathname === '/guida' ? 'text-app-fg bg-app-line-10' : 'text-app-fg-subtle hover:bg-app-line-10 hover:text-app-fg'}`}
              >
                <svg className={`h-3.5 w-3.5 shrink-0 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="truncate">{t.nav.guida}</span>
              </Link>
              {/* Sign out */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-app-fg-subtle transition-colors hover:bg-red-500/8 hover:text-red-400"
              >
                <svg className={`h-3.5 w-3.5 shrink-0 ${icon.destructive}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="truncate">{t.nav.esci}</span>
              </button>
            </div>
          )}

          {/* Riga 2 — icone azioni in fila (nascosta quando il pannello è espanso) */}
          <div className={`flex items-center gap-0.5 pt-0.5 ${footerOpen ? 'hidden' : ''}`}>
            {/* Lingua */}
            <div className="relative z-[80]">
              <button
                onClick={() => setLangOpen(o => !o)}
                title={LOCALES.find(l => l.code === locale)?.label ?? locale}
                className="flex h-7 w-7 items-center justify-center rounded-md text-base leading-none text-app-fg-subtle transition-colors hover:bg-app-line-10 hover:text-app-fg"
              >
                {LOCALES.find(l => l.code === locale)?.code ? (
                  <LocaleCodeChip code={LOCALES.find(l => l.code === locale)!.code} className="h-6 min-w-[1.5rem] px-1 text-[9px]" />
                ) : (
                  <GlyphGlobe className="h-4 w-4 text-app-fg-subtle" aria-hidden />
                )}
              </button>
              {langOpen && (
                <div className="app-sidebar-locale-menu absolute bottom-full left-0 z-[120] mb-1 w-40 max-h-[min(240px,calc(100vh-6rem))] overflow-y-auto overflow-x-hidden rounded-lg border border-app-line-28 app-workspace-surface-elevated text-app-fg shadow-[0_16px_40px_-8px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-app-line-15">
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
                      <LocaleCodeChip code={l.code} className="h-6 min-w-[1.5rem] px-1 text-[9px]" />
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

            {/* Settings */}
            <Link
              href="/impostazioni"
              title={t.nav.impostazioni}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-app-line-10 text-app-fg-subtle hover:text-app-fg"
            >
              <svg className={`h-4 w-4 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            <Link
              href="/strumenti/centro-operazioni"
              title={t.strumentiCentroOperazioni.pageTitle}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-app-line-10 ${pathname?.startsWith('/strumenti') ? 'text-cyan-300' : 'text-app-fg-subtle hover:text-app-fg'}`}
            >
              <svg className={`h-4 w-4 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm8 9a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM6 17a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm14-11a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
              </svg>
            </Link>

            {/* Help */}
            <Link
              href="/guida"
              title={t.nav.guida}
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-app-line-10 text-app-fg-subtle hover:text-app-fg"
            >
              <svg className={`h-4 w-4 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>

            {/* Sign out */}
            <button
              type="button"
              onClick={handleLogout}
              title={t.nav.esci}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-app-fg-subtle transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <svg className={`h-4 w-4 ${icon.destructive}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
    </div>
  )
}
