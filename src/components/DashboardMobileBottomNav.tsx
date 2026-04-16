'use client'

import Link from 'next/link'
import { useLayoutEffect, useState } from 'react'
import { FileText, Home, Plus, Settings, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { resolvedOperatorDockDisplay } from '@/lib/operator-dock-display'
import {
  fornitoreIdFromProfilePath,
  isFornitoreProfileRoute,
  normalizeAppPath,
} from '@/lib/mobile-hub-routes'
import { useMobileSupplierReadOnly } from '@/lib/use-mobile-supplier-read-only'
import DashboardHomeScannerDockCta from '@/components/DashboardHomeScannerDockCta'

/** Sotto al dock c’è ancora contenuto scrollabile (non sei a fondo pagina). */
const DOCK_OVER_CONTENT_EPS_PX = 28

/**
 * Dock mobile “pill”: margini da bordo schermo, angoli pieni, ombra esterna.
 * Trasparente di default; con contenuto sotto si applica `app-glass-dock-opaque` + blur (`globals.css`).
 */
const NAV_SHELL_BASE =
  'app-glass-dock fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[100] flex w-[min(calc(100vw-1.75rem),var(--app-layout-max-width))] max-w-[var(--app-layout-max-width)] -translate-x-1/2 items-stretch overflow-hidden rounded-3xl border border-app-line-35 text-app-fg shadow-[0_14px_44px_-12px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.07),0_0_26px_-14px_rgba(34,211,238,0.12)] ring-1 ring-inset ring-app-a-35 pb-4 pt-3 ps-[max(0.375rem,env(safe-area-inset-left,0px))] pe-[max(0.375rem,env(safe-area-inset-right,0px))] md:hidden'

const NAV_SHELL_OPAQUE_GLASS =
  'app-glass-dock-opaque backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] backdrop-saturate-150'

const NAV_SHELL_CLEAR_GLASS =
  'backdrop-blur-none [-webkit-backdrop-filter:none] [backdrop-filter:none] backdrop-saturate-100'

function glassDockNavShellClass(opaque: boolean, layout: string) {
  return `${NAV_SHELL_BASE} ${opaque ? NAV_SHELL_OPAQUE_GLASS : NAV_SHELL_CLEAR_GLASS} ${layout}`
}

function useGlassDockOverContent(): boolean {
  const [over, setOver] = useState(false)

  useLayoutEffect(() => {
    const main = document.getElementById('app-main')
    if (!main) {
      setOver(false)
      return
    }
    const tick = () => {
      const gap = main.scrollHeight - main.scrollTop - main.clientHeight
      setOver(gap > DOCK_OVER_CONTENT_EPS_PX)
    }
    tick()
    main.addEventListener('scroll', tick, { passive: true })
    window.addEventListener('resize', tick)
    const ro = new ResizeObserver(tick)
    ro.observe(main)
    return () => {
      main.removeEventListener('scroll', tick)
      window.removeEventListener('resize', tick)
      ro.disconnect()
    }
  }, [])

  return over
}

const hubIconsRow =
  'flex w-full min-h-[48px] flex-1 items-stretch justify-between gap-0.5 sm:justify-around sm:gap-1'
const fornitoreIconsRow = 'flex w-full min-h-[48px] flex-1 items-stretch justify-between gap-3 sm:gap-4'

/** Landmark `aria-label` fissi (allineati a `lang="it"`); evita mismatch SSR/client su `t.nav.*`. */
const BOTTOM_NAV_ARIA_MAIN = 'Navigazione principale'
const BOTTOM_NAV_ARIA_ADMIN = 'Navigazione amministratore'
const BOTTOM_NAV_ARIA_FORNITORE = 'Navigazione fornitore'

function BottomNavOperatorRow() {
  const t = useT()
  const { me } = useMe()
  const { activeOperator, openSwitchModal } = useActiveOperator()
  const { displayName: name, avatarLetter: initial } = resolvedOperatorDockDisplay(me, activeOperator, t.ui.noOperator)
  const aria =
    name !== t.ui.noOperator ? `${t.ui.changeOperator}: ${name}` : t.ui.selectOperator

  return (
    <div className="w-full shrink-0 border-b border-app-line-15 pb-2">
      <button
        type="button"
        onClick={() => openSwitchModal()}
        className="flex w-full min-h-[44px] touch-manipulation items-center gap-2 rounded-xl border border-app-line-35 app-workspace-inset-bg-soft px-2 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all active:scale-[0.99] hover:border-app-a-50 hover:bg-black/12"
        aria-label={aria}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-line-20 text-xs font-bold text-app-fg-muted ring-1 ring-inset ring-app-a-25">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-semibold uppercase leading-tight tracking-wide text-app-cyan-500 opacity-70">
            {t.ui.operatorLabel}
          </p>
          <p className="truncate text-xs font-semibold text-app-fg">{name}</p>
        </div>
        <span className="inline-flex min-h-[32px] min-w-[3.25rem] shrink-0 items-center justify-center rounded-md bg-app-line-15 px-1.5 text-[9px] font-bold uppercase tracking-wide text-app-fg-muted ring-1 ring-inset ring-app-line-25">
          {t.ui.changeOperatorShort}
        </span>
      </button>
    </div>
  )
}

/** Voce hub operatore: stessa griglia delle altre icone, al posto del link Rekki. */
function OperatorHubNavItem({ itemCls }: { itemCls: (active: boolean) => string }) {
  const t = useT()
  const { me } = useMe()
  const { activeOperator, openSwitchModal } = useActiveOperator()
  const { displayName: name, avatarLetter: initial } = resolvedOperatorDockDisplay(me, activeOperator, t.ui.noOperator)
  const aria =
    name !== t.ui.noOperator ? `${t.ui.changeOperator}: ${name}` : t.ui.selectOperator
  const short =
    name === t.ui.noOperator
      ? t.ui.changeOperatorShort
      : (name.split(/\s+/)[0] ?? name).slice(0, 10)

  return (
    <button
      type="button"
      onClick={() => openSwitchModal()}
      className={itemCls(false)}
      aria-label={aria}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-app-line-20 text-[9px] font-bold text-app-fg-muted ring-1 ring-inset ring-app-line-20 sm:h-6 sm:w-6 sm:text-[10px]">
        {initial}
      </div>
      <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{short}</span>
    </button>
  )
}

function FornitoreProfileBottomNav({
  normalized,
  itemCls,
  dockOpaque,
}: {
  normalized: string
  itemCls: (active: boolean) => string
  dockOpaque: boolean
}) {
  const pathname = usePathname() ?? ''
  const t = useT()
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const masterAdminNoOperator = Boolean(me?.is_admin && !activeOperator)
  const fid = fornitoreIdFromProfilePath(normalized)
  const nuovaBollaHref = fid ? `/bolle/new?fornitore_id=${encodeURIComponent(fid)}` : '/bolle/new'
  const supplierReadOnlyMobile = useMobileSupplierReadOnly()
  const dashboardActive = pathname === '/' || pathname === ''

  const navCls = glassDockNavShellClass(dockOpaque, 'flex-col gap-2 px-2 sm:gap-3 sm:px-4')

  return (
    <nav className={navCls} aria-label={BOTTOM_NAV_ARIA_FORNITORE}>
      {masterAdminNoOperator ? <BottomNavOperatorRow /> : null}
      <div className={fornitoreIconsRow}>
        <Link href="/fornitori" className={itemCls(false)} prefetch={false}>
          <Users className="h-6 w-6 shrink-0" aria-hidden />
          <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.fornitori}</span>
        </Link>
        <Link href="/" className={itemCls(dashboardActive)} prefetch={false}>
          <Home className="h-6 w-6 shrink-0" aria-hidden />
          <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.dashboard}</span>
        </Link>
        {!supplierReadOnlyMobile ? (
        <Link href={nuovaBollaHref} className={itemCls(false)} prefetch={false}>
          <Plus className="h-6 w-6 shrink-0" aria-hidden />
          <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.addNewDelivery}</span>
        </Link>
        ) : null}
        {!masterAdminNoOperator ? <OperatorHubNavItem itemCls={itemCls} /> : null}
      </div>
    </nav>
  )
}

export default function DashboardMobileBottomNav() {
  const pathname: string = usePathname() ?? ''
  const t = useT()
  const { me, loading } = useMe()
  const { activeOperator } = useActiveOperator()
  const dockOver = useGlassDockOverContent()

  const role: 'admin' | 'admin_sede' | 'operatore' | null = me?.role ?? null

  const normalized = normalizeAppPath(pathname)

  if (loading) {
    return null
  }

  const navClsHub = glassDockNavShellClass(dockOver, 'flex-col gap-2 px-2 sm:px-2')

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === ''
    if (href === '/bolle') {
      if (pathname === '/bolle/new') return false
      return pathname === '/bolle' || pathname.startsWith('/bolle/')
    }
    if (href === '/fornitori') {
      if (pathname === '/fornitori/import') return true
      return pathname === '/fornitori' || pathname.startsWith('/fornitori/')
    }
    if (href === '/impostazioni') return pathname === '/impostazioni' || pathname.startsWith('/impostazioni/')
    return pathname === href
  }

  /** Voce compatta: Dashboard, Fornitori, Bolle, Impostazioni (scanner: CTA in dashboard mobile). */
  const itemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-[10px] font-semibold leading-tight sm:gap-1 sm:px-1 sm:text-xs touch-manipulation transition-colors ${
      active
        ? 'text-app-fg-muted'
        : 'text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15'
    } ${active ? 'bg-app-line-15 ring-1 ring-inset ring-app-a-20' : ''}`

  /** Tre colonne uguali sulla scheda fornitore (niente max-w 25%). */
  const fornitoreItemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium touch-manipulation transition-colors ${
      active
        ? 'text-app-fg-muted'
        : 'text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15'
    } ${active ? 'bg-app-line-15 ring-1 ring-inset ring-app-a-20' : ''}`

  if (isFornitoreProfileRoute(normalized)) {
    return (
      <FornitoreProfileBottomNav
        normalized={normalized}
        itemCls={fornitoreItemCls}
        dockOpaque={dockOver}
      />
    )
  }

  const adminHubNav = () => (
    <nav className={navClsHub} aria-label={BOTTOM_NAV_ARIA_ADMIN}>
      <DashboardHomeScannerDockCta />
      <div className={hubIconsRow}>
        <Link href="/" className={itemCls(isActive('/'))} prefetch={false}>
          <Home className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.dashboard}</span>
        </Link>
        <Link href="/fornitori" className={itemCls(isActive('/fornitori'))} prefetch={false}>
          <Users className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.fornitori}</span>
        </Link>
        <Link href="/bolle" className={itemCls(isActive('/bolle'))} prefetch={false}>
          <FileText className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bolle}</span>
        </Link>
        <Link href="/impostazioni" className={itemCls(isActive('/impostazioni'))} prefetch={false}>
          <Settings className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.impostazioni}</span>
        </Link>
      </div>
    </nav>
  )

  /** Mobile operatore: azioni urgenti (fornitori/bolle estesi restano su desktop / griglia KPI). */
  const operatorHubNav = () => (
    <nav className={navClsHub} aria-label={BOTTOM_NAV_ARIA_MAIN}>
      <DashboardHomeScannerDockCta />
      <div className={hubIconsRow}>
        <Link href="/" className={itemCls(isActive('/'))} prefetch={false}>
          <Home className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.dashboard}</span>
        </Link>
        <Link href="/fornitori" className={itemCls(isActive('/fornitori'))} prefetch={false}>
          <Users className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.fornitori}</span>
        </Link>
        <OperatorHubNavItem itemCls={itemCls} />
        <Link href="/impostazioni" className={itemCls(isActive('/impostazioni'))} prefetch={false}>
          <Settings className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.impostazioni}</span>
        </Link>
      </div>
    </nav>
  )

  /** Hub “admin completo” solo senza operatore attivo; con PIN si usa la stessa shell operatore. */
  if (role === 'admin' && !activeOperator) {
    return adminHubNav()
  }

  return operatorHubNav()
}
