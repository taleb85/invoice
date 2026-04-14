'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileText, Home, Plus, Scan, User, Users } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { resolvedOperatorDockDisplay } from '@/lib/operator-dock-display'
import {
  fornitoreIdFromProfilePath,
  isFornitoreProfileRoute,
  normalizeAppPath,
} from '@/lib/mobile-hub-routes'

/**
 * Glass dock — allineato a `.app-card` (globals): vetro scuro, blur forte, ombra.
 * Padding basso: 2rem (≈ pb-8) + safe-area per ergonomia sopra la gesture bar.
 */
const navShell =
  'app-glass-dock fixed z-[100] bottom-0 left-0 right-0 mx-2 flex max-w-[100%] items-stretch rounded-t-2xl border border-white/15 border-b-0 bg-slate-900/70 shadow-2xl shadow-black/45 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] backdrop-saturate-150 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-3 sm:mx-4 md:hidden'

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
    <div className="w-full shrink-0 border-b border-white/10 pb-2">
      <button
        type="button"
        onClick={() => openSwitchModal()}
        className="flex w-full min-h-[44px] touch-manipulation items-center gap-2 rounded-xl border border-cyan-500/35 bg-slate-800/45 px-2 py-1.5 text-left transition-all active:scale-[0.99] hover:border-cyan-400/55 hover:bg-slate-800/75"
        aria-label={aria}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-200">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
            {t.ui.operatorLabel}
          </p>
          <p className="truncate text-xs font-semibold text-slate-100">{name}</p>
        </div>
        <span className="inline-flex min-h-[32px] min-w-[3.25rem] shrink-0 items-center justify-center rounded-md bg-cyan-500/15 px-1.5 text-[9px] font-bold uppercase tracking-wide text-cyan-300 ring-1 ring-inset ring-cyan-500/25">
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
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[9px] font-bold text-cyan-200 sm:h-6 sm:w-6 sm:text-[10px]">
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
  const router = useRouter()
  const t = useT()
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const masterAdminNoOperator = Boolean(me?.is_admin && !activeOperator)
  const fid = fornitoreIdFromProfilePath(normalized)
  const nuovaBollaHref = fid ? `/bolle/new?fornitore_id=${encodeURIComponent(fid)}` : '/bolle/new'

  return (
    <nav className={navClsFornitore} aria-label={BOTTOM_NAV_ARIA_FORNITORE}>
      {!masterAdminNoOperator && <BottomNavOperatorRow />}
      <div className={fornitoreIconsRow}>
        <button type="button" onClick={() => router.back()} className={itemCls(false)}>
          <ArrowLeft className="h-6 w-6 shrink-0" aria-hidden />
          <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.bottomNavBackToSede}</span>
        </button>
        <Link href={nuovaBollaHref} className={itemCls(false)} prefetch={false}>
          <Plus className="h-6 w-6 shrink-0" aria-hidden />
          <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.addNewDelivery}</span>
        </Link>
        <a href="https://rekki.com" target="_blank" rel="noopener noreferrer" className={itemCls(false)}>
          <ExternalLink className="h-6 w-6 shrink-0" aria-hidden />
          <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.openRekki}</span>
        </a>
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

  /** Voce compatta: Dashboard, Fornitori, Scanner, Bolle, Profilo */
  const itemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-[10px] font-semibold leading-tight sm:gap-1 sm:px-1 sm:text-xs touch-manipulation transition-colors ${
      active
        ? 'text-cyan-400'
        : 'text-slate-300 hover:bg-white/5 hover:text-white active:bg-white/10'
    } ${active ? 'bg-cyan-500/10' : ''}`

  /** Tre colonne uguali sulla scheda fornitore (niente max-w 25%). */
  const fornitoreItemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium touch-manipulation transition-colors ${
      active
        ? 'text-cyan-400'
        : 'text-slate-300 hover:bg-white/5 hover:text-white active:bg-white/10'
    } ${active ? 'bg-cyan-500/10' : ''}`

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
        <Link href="/bolle/new" className={itemCls(isActive('/bolle/new'))} prefetch={false}>
          <Scan className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bottomNavScannerAi}</span>
        </Link>
        <Link href="/bolle" className={itemCls(isActive('/bolle'))} prefetch={false}>
          <FileText className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bolle}</span>
        </Link>
        <Link href="/impostazioni" className={itemCls(isActive('/impostazioni'))} prefetch={false}>
          <User className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bottomNavProfile}</span>
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
        <Link href="/bolle/new" className={itemCls(isActive('/bolle/new'))} prefetch={false}>
          <Scan className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bottomNavScannerAi}</span>
        </Link>
        <OperatorHubNavItem itemCls={itemCls} />
        <Link href="/impostazioni" className={itemCls(isActive('/impostazioni'))} prefetch={false}>
          <User className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
          <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bottomNavProfile}</span>
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
