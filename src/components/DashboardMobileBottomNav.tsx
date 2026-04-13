'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileText, Home, Plus, Scan, User, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
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
  'app-glass-dock fixed z-[100] bottom-0 left-0 right-0 mx-2 flex max-w-[100%] items-stretch rounded-t-2xl border border-white/15 border-b-0 bg-slate-900/70 shadow-2xl shadow-black/45 backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] backdrop-saturate-150 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-3 sm:mx-4 lg:hidden'

const navClsFornitore = `${navShell} justify-between gap-3 px-2 sm:gap-4 sm:px-4`
const navClsHub = `${navShell} justify-between gap-0.5 px-1 sm:justify-around sm:gap-1 sm:px-2`

/** Landmark `aria-label` fissi (allineati a `lang="it"`); evita mismatch SSR/client su `t.nav.*`. */
const BOTTOM_NAV_ARIA_MAIN = 'Navigazione principale'
const BOTTOM_NAV_ARIA_ADMIN = 'Navigazione amministratore'
const BOTTOM_NAV_ARIA_FORNITORE = 'Navigazione fornitore'

function FornitoreProfileBottomNav({
  normalized,
  itemCls,
}: {
  normalized: string
  itemCls: (active: boolean) => string
}) {
  const router = useRouter()
  const t = useT()
  const fid = fornitoreIdFromProfilePath(normalized)
  const nuovaBollaHref = fid ? `/bolle/new?fornitore_id=${encodeURIComponent(fid)}` : '/bolle/new'

  return (
    <nav className={navClsFornitore} aria-label={BOTTOM_NAV_ARIA_FORNITORE}>
      <button type="button" onClick={() => router.back()} className={itemCls(false)}>
        <ArrowLeft className="h-6 w-6 shrink-0" aria-hidden />
        <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.bottomNavBackToSede}</span>
      </button>
      <Link
        href={nuovaBollaHref}
        className={itemCls(false)}
        prefetch={false}
      >
        <Plus className="h-6 w-6 shrink-0" aria-hidden />
        <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.addNewDelivery}</span>
      </Link>
      <a
        href="https://rekki.com"
        target="_blank"
        rel="noopener noreferrer"
        className={itemCls(false)}
      >
        <ExternalLink className="h-6 w-6 shrink-0" aria-hidden />
        <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.openRekki}</span>
      </a>
    </nav>
  )
}

export default function DashboardMobileBottomNav() {
  const pathname: string = usePathname() ?? ''
  const t = useT()
  const { me, loading } = useMe()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const role: 'admin' | 'operatore' | null = me?.role ?? null

  const normalized = normalizeAppPath(pathname)

  if (!mounted || loading) {
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
    </nav>
  )

  /** Mobile operatore: azioni urgenti (fornitori/bolle estesi restano su desktop / griglia KPI). */
  const operatorHubNav = () => (
    <nav className={navClsHub} aria-label={BOTTOM_NAV_ARIA_MAIN}>
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
      <a
        href="https://rekki.com"
        target="_blank"
        rel="noopener noreferrer"
        className={itemCls(false)}
      >
        <ExternalLink className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
        <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.openRekki}</span>
      </a>
      <Link href="/impostazioni" className={itemCls(isActive('/impostazioni'))} prefetch={false}>
        <User className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden />
        <span className="line-clamp-2 max-w-full text-center [overflow-wrap:anywhere]">{t.nav.bottomNavProfile}</span>
      </Link>
    </nav>
  )

  if (role === 'admin') {
    return adminHubNav()
  }

  return operatorHubNav()
}
