'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import ManualDeliveryMobilePanel from '@/components/DashboardManualDeliveryMobile'

/** Solo su `/` mobile: azioni nel main scrollabile, non nella barra fissa (evita sovrapposizioni su errori / contenuto). */
export default function DashboardHubQuickActions() {
  const pathname = usePathname()
  const normalized = normalizeAppPath(pathname ?? '')
  const onDash = normalized === '/' || normalized === ''
  const { me, loading } = useMe()
  const { activeOperator } = useActiveOperator()
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

  const isAdminUser = effectiveIsMasterAdminPlane(me, activeOperator)

  /** Solo operatore: tile «Ricevuto» (Scanner è il CTA in cima in `page.tsx`). */
  if (!onDash || (loading && !me) || isAdminUser) return null

  const receiptSheet =
    receiptOpen ? (
      <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="absolute inset-0 bg-slate-700/45 backdrop-blur-sm"
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
              className="rounded-lg p-2 text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-slate-200"
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

  /** Allineato al CTA «Scanner AI» in cima al dashboard operatore (`page.tsx`). */
  const ricevutoTileCls = `${tileBase} border border-cyan-500/35 bg-gradient-to-r from-cyan-500/15 to-violet-500/10 text-sm font-bold text-cyan-100 shadow-[0_0_24px_-8px_rgba(6,182,212,0.45)] hover:border-cyan-400/50 hover:from-cyan-500/25`

  return (
    <>
      <div className="grid grid-cols-1 gap-3 border-t border-slate-700/50 pt-4 pb-0 md:hidden">
        <button
          type="button"
          onClick={() => setReceiptOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={receiptOpen}
          aria-controls={receiptOpen ? receiptDialogId : undefined}
          className={ricevutoTileCls}
          aria-label={t.dashboard.digitalizzaRicevuto}
          title={t.dashboard.digitalizzaRicevuto}
        >
          <svg className="h-7 w-7 shrink-0 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="line-clamp-2 [overflow-wrap:anywhere]">{t.nav.ricevuto}</span>
        </button>
      </div>
      {typeof document !== 'undefined' && receiptSheet
        ? createPortal(receiptSheet, document.body)
        : null}
    </>
  )
}
