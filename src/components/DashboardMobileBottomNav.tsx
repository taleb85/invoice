'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink, FileText, Home, Plus, Receipt, Scan, User } from 'lucide-react'
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
const navClsHub = `${navShell} justify-around px-1`

function FornitoreProfileBottomNav({
  normalized,
  itemCls,
  router,
}: {
  normalized: string
  itemCls: (active: boolean) => string
  router: ReturnType<typeof useRouter>
}) {
  const t = useT()
  const fid = fornitoreIdFromProfilePath(normalized)
  const nuovaBollaHref = fid ? `/bolle/new?fornitore_id=${encodeURIComponent(fid)}` : '/bolle/new'

  return (
    <nav className={navClsFornitore} aria-label={t.nav.ariaFornitore}>
      <button type="button" onClick={() => router.back()} className={itemCls(false)}>
        <ArrowLeft className="h-6 w-6 shrink-0" aria-hidden />
        <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.bottomNavBackToSede}</span>
      </button>
      <Link
        href={nuovaBollaHref}
        className={itemCls(false)}
        aria-label={t.nav.addNewDelivery}
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
        aria-label={t.nav.openRekki}
      >
        <ExternalLink className="h-6 w-6 shrink-0" aria-hidden />
        <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">{t.nav.openRekki}</span>
      </a>
    </nav>
  )
}

export default function DashboardMobileBottomNav() {
  const pathname: string = usePathname() ?? ''
  const router = useRouter()
  const t = useT()
  const { me } = useMe()

  const role: 'admin' | 'operatore' | null = me?.role ?? null

  const normalized = normalizeAppPath(pathname)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === ''
    if (href === '/bolle') {
      if (pathname === '/bolle/new') return false
      return pathname === '/bolle' || pathname.startsWith('/bolle/')
    }
    if (href === '/fatture') {
      return pathname === '/fatture' || pathname.startsWith('/fatture/')
    }
    if (href === '/bolle/new') return pathname === '/bolle/new'
    if (href === '/impostazioni') return pathname === '/impostazioni' || pathname.startsWith('/impostazioni/')
    return pathname === href
  }

  /** Su flusso fatture la terza voce diventa «Fatture» (es. errore /fatture/[id]). */
  const fattureSection = normalized === '/fatture' || normalized.startsWith('/fatture/')

  const itemCls = (active: boolean) =>
    `flex min-h-[48px] min-w-0 max-w-[25%] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-medium touch-manipulation transition-colors ${
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
    return <FornitoreProfileBottomNav normalized={normalized} itemCls={fornitoreItemCls} router={router} />
  }

  if (role === 'admin') {
    return (
      <nav className={navClsHub} aria-label={t.nav.ariaAdmin}>
        <Link href="/" className={itemCls(isActive('/'))}>
          <Home className="h-6 w-6 shrink-0" aria-hidden />
          <span>{t.nav.sediTitle}</span>
        </Link>
        <Link href="/impostazioni" className={itemCls(isActive('/impostazioni'))}>
          <User className="h-6 w-6 shrink-0" aria-hidden />
          <span>{t.nav.bottomNavProfile}</span>
        </Link>
      </nav>
    )
  }

  return (
    <nav className={navClsHub} aria-label={t.nav.ariaMain}>
      <Link href="/" className={itemCls(isActive('/'))}>
        <Home className="h-6 w-6 shrink-0" aria-hidden />
        <span>{t.nav.dashboard}</span>
      </Link>
      <Link href="/bolle/new" className={itemCls(isActive('/bolle/new'))}>
        <Scan className="h-6 w-6 shrink-0" aria-hidden />
        <span>{t.nav.bottomNavScannerAi}</span>
      </Link>
      <Link
        href={fattureSection ? '/fatture' : '/bolle'}
        className={itemCls(fattureSection ? isActive('/fatture') : isActive('/bolle'))}
      >
        {fattureSection ? (
          <Receipt className="h-6 w-6 shrink-0" aria-hidden />
        ) : (
          <FileText className="h-6 w-6 shrink-0" aria-hidden />
        )}
        <span className="line-clamp-2 text-center [overflow-wrap:anywhere]">
          {fattureSection ? t.nav.fatture : t.nav.bolle}
        </span>
      </Link>
      <Link href="/impostazioni" className={itemCls(isActive('/impostazioni'))}>
        <User className="h-6 w-6 shrink-0" aria-hidden />
        <span>{t.nav.bottomNavProfile}</span>
      </Link>
    </nav>
  )
}
