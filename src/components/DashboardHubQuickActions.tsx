'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import ManualDeliveryMobilePanel from '@/components/DashboardManualDeliveryMobile'

/** Solo su `/` mobile: azioni nel main scrollabile, non nella barra fissa (evita sovrapposizioni su errori / contenuto). */
export default function DashboardHubQuickActions() {
  const pathname = usePathname()
  const normalized = normalizeAppPath(pathname ?? '')
  const onDash = normalized === '/' || normalized === ''
  const { me, loading } = useMe()
  const t = useT()
  const [receiptOpen, setReceiptOpen] = useState(false)
  const receiptPanelRef = useRef<HTMLDivElement>(null)
  const receiptDialogId = useId()
  const receiptTitleId = useId()

  useEffect(() => {
    if (!receiptOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReceiptOpen(false)
    }
    document.addEventListener('keydown', onKey)
    queueMicrotask(() => receiptPanelRef.current?.querySelector<HTMLElement>('select,button,a')?.focus())
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [receiptOpen])

  const closeReceipt = useCallback(() => setReceiptOpen(false), [])

  const isAdminUser = !!(me?.is_admin || me?.role === 'admin')
  const onNuovaBollaHub = normalized === '/bolle/new'

  if (!onDash || (loading && !me)) return null

  const receiptSheet =
    receiptOpen && !isAdminUser ? (
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          aria-label={t.ui.closeMenu}
          onClick={closeReceipt}
        />
        <div
          id={receiptDialogId}
          ref={receiptPanelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={receiptTitleId}
          className="app-card relative z-[211] mx-auto flex w-full max-w-lg max-h-[min(85vh,36rem)] flex-col overflow-hidden rounded-xl border-slate-700/50 shadow-2xl shadow-black/50"
        >
          <div className="app-card-bar" aria-hidden />
          <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 px-4 py-3 sm:px-5">
            <h2 id={receiptTitleId} className="text-sm font-semibold text-slate-100">
              {t.dashboard.digitalizzaRicevuto}
            </h2>
            <button
              type="button"
              onClick={closeReceipt}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200"
              aria-label={t.ui.closeMenu}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
            <ManualDeliveryMobilePanel />
          </div>
        </div>
      </div>
    ) : null

  const tileBase =
    'flex min-h-[72px] min-w-0 touch-manipulation flex-col items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-xs font-semibold leading-snug transition-colors active:scale-[0.99] sm:min-h-[76px] sm:text-sm'

  return (
    <>
      <div
        className={`mt-8 grid gap-3 border-t border-slate-700/50 pt-6 pb-1 md:hidden ${
          isAdminUser ? 'grid-cols-1' : 'grid-cols-2'
        }`}
      >
        <Link
          href="/bolle/new"
          className={`app-glow-cyan text-white shadow-lg shadow-cyan-900/20 ${tileBase} ${
            onNuovaBollaHub
              ? 'bg-cyan-600 ring-2 ring-white/30 ring-offset-2 ring-offset-slate-900'
              : 'bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700'
          }`}
          aria-current={onNuovaBollaHub ? 'page' : undefined}
        >
          <svg className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="line-clamp-2 [overflow-wrap:anywhere]">{t.bolle.scannerTitle}</span>
        </Link>
        {!isAdminUser ? (
          <button
            type="button"
            onClick={() => setReceiptOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={receiptOpen}
            aria-controls={receiptOpen ? receiptDialogId : undefined}
            className={`border border-slate-600/80 bg-slate-800/90 text-slate-100 shadow-lg shadow-black/20 hover:bg-slate-800 active:bg-slate-800/95 ${tileBase}`}
            aria-label={t.dashboard.digitalizzaRicevuto}
            title={t.dashboard.digitalizzaRicevuto}
          >
            <svg className="h-7 w-7 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="line-clamp-2 text-slate-200 [overflow-wrap:anywhere]">{t.nav.ricevuto}</span>
          </button>
        ) : null}
        {!isAdminUser ? (
          <a
            href="https://rekki.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`col-span-2 border border-violet-500/30 bg-violet-950/40 text-violet-100 shadow-lg shadow-violet-950/30 hover:bg-violet-950/55 active:bg-violet-950/65 ${tileBase}`}
            aria-label={t.dashboard.rekkiOrder}
          >
            <ExternalLink className="h-7 w-7 shrink-0 text-violet-300" aria-hidden />
            <span className="line-clamp-2 [overflow-wrap:anywhere]">{t.dashboard.rekkiOrder}</span>
          </a>
        ) : null}
      </div>
      {typeof document !== 'undefined' && receiptSheet
        ? createPortal(receiptSheet, document.body)
        : null}
    </>
  )
}
