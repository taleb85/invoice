'use client'

import Link from 'next/link'
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
import HubScannerIcon from '@/components/HubScannerIcon'

/**
 * Glass dock — vetro cyan/slate come `.app-card`: bordo cyan, gradiente scuro, alone leggero, blur forte.
 * Padding basso: 2rem (≈ pb-8) + safe-area per ergonomia sopra la gesture bar.
 */
const navShell =
  'app-glass-dock fixed bottom-0 left-1/2 z-[100] flex w-[min(100vw-1rem,var(--app-layout-max-width))] max-w-[var(--app-layout-max-width)] -translate-x-1/2 items-stretch rounded-t-2xl border border-app-line-25 border-b-0 text-app-fg shadow-[0_-24px_48px_-14px_rgba(0,0,0,0.55),0_0_36px_-14px_rgba(34,211,238,0.14)] ring-1 ring-inset ring-white/10 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] backdrop-saturate-150 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-3 ps-[max(0.25rem,env(safe-area-inset-left,0px))] pe-[max(0.25rem,env(safe-area-inset-right,0px))] md:hidden'

const navClsFornitore = `${navShell} flex-col gap-2 px-2 sm:gap-3 sm:px-4`
const navClsHub = `${navShell} flex-col gap-2 px-2 sm:px-2`

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
}: {
  normalized: string
  itemCls: (active: boolean) => string
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

  return (
    <nav className={navClsFornitore} aria-label={BOTTOM_NAV_ARIA_FORNITORE}>
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

  const role: 'admin' | 'admin_sede' | 'operatore' | null = me?.role ?? null

  const normalized = normalizeAppPath(pathname)

  if (loading) {
    return null
  }

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
    if (href === '/bolle/new') return pathname === '/bolle/new'
    if (href === '/impostazioni') return pathname === '/impostazioni' || pathname.startsWith('/impostazioni/')
    return pathname === href
  }

  /** Voce compatta: Dashboard, Fornitori, Scanner, Bolle, Impostazioni */
  const itemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-[10px] font-semibold leading-tight sm:gap-1 sm:px-1 sm:text-xs touch-manipulation transition-colors ${
      active
        ? 'text-app-fg-muted'
        : 'text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15'
    } ${active ? 'bg-app-line-15 ring-1 ring-inset ring-app-a-20' : ''}`

  /** Scanner AI — stesso filo del CTA dashboard (gradiente cyan/viola, alone). */
  const scannerNavItemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-2 text-[10px] font-semibold leading-tight sm:gap-1 sm:px-1 sm:text-xs touch-manipulation transition-all active:scale-[0.98] ${
      active
        ? 'border-app-a-50 bg-gradient-to-b from-app-line-30 to-violet-500/15 text-app-fg shadow-[0_0_22px_-8px_rgba(6,182,212,0.55)]'
        : 'border-app-line-35 bg-gradient-to-b from-app-line-15 to-violet-500/10 text-app-fg-muted shadow-[0_0_20px_-10px_rgba(6,182,212,0.42)] hover:border-app-a-45 hover:from-app-line-25 hover:to-violet-500/15 hover:text-white'
    }`

  /** Tre colonne uguali sulla scheda fornitore (niente max-w 25%). */
  const fornitoreItemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium touch-manipulation transition-colors ${
      active
        ? 'text-app-fg-muted'
        : 'text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15'
    } ${active ? 'bg-app-line-15 ring-1 ring-inset ring-app-a-20' : ''}`

  if (isFornitoreProfileRoute(normalized)) {
    return <FornitoreProfileBottomNav normalized={normalized} itemCls={fornitoreItemCls} />
  }

  const adminHubNav = () => (
    <nav className={navClsHub} aria-label={BOTTOM_NAV_ARIA_ADMIN}>
      <div className={hubIconsRow}>
        <Link href="/" className={itemCls(isActive('/'))} prefetch={false}>
          <Home className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.dashboard}</span>
        </Link>
        <Link href="/fornitori" className={itemCls(isActive('/fornitori'))} prefetch={false}>
          <Users className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.fornitori}</span>
        </Link>
        <Link href="/bolle/new" className={scannerNavItemCls(isActive('/bolle/new'))} prefetch={false}>
          <HubScannerIcon className="h-5 w-5 shrink-0 text-app-fg-muted drop-shadow-[0_0_10px_rgba(34,211,238,0.45)] sm:h-6 sm:w-6" />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bottomNavScannerAi}</span>
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
      <div className={hubIconsRow}>
        <Link href="/" className={itemCls(isActive('/'))} prefetch={false}>
          <Home className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.dashboard}</span>
        </Link>
        <Link href="/fornitori" className={itemCls(isActive('/fornitori'))} prefetch={false}>
          <Users className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.fornitori}</span>
        </Link>
        <Link href="/bolle/new" className={scannerNavItemCls(isActive('/bolle/new'))} prefetch={false}>
          <HubScannerIcon className="h-5 w-5 shrink-0 text-app-fg-muted drop-shadow-[0_0_10px_rgba(34,211,238,0.45)] sm:h-6 sm:w-6" />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bottomNavScannerAi}</span>
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
