'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/use-t'
import { APP_SECTION_DIVIDE_ROWS } from '@/lib/app-shell-layout'

export type DashboardKpiListItem = {
  id: string
  href: string
  title: string
  subtitle?: string | null
  /** Riga stile “bolle recenti” mobile: pill stato a destra */
  statusPill?: 'completato' | 'in attesa'
}

type Props = {
  count: number
  label: string
  icon: ReactNode
  bgClass: string
  layout: 'mobile' | 'desktop'
  sheetTitle: string
  items: DashboardKpiListItem[]
  emptyText: string
  viewAllHref: string
  /** Bordo sinistro colorato (es. KPI scheda fornitore mobile). */
  tileAccentHex?: string
  /** Valore grande sul tile (es. totale in £); altrimenti si usa `count`. */
  tileValue?: ReactNode
  /** Solo `layout="mobile"`: titolo / lista / link del foglio (tile KPI invariata). */
  mobileSheetOverride?: {
    sheetTitle: string
    items: DashboardKpiListItem[]
    emptyText: string
    viewAllHref: string
    /** Intestazione come card dashboard + lista con pill (no footer “vedi tutte” duplicato) */
    chrome?: 'dialog' | 'recentCard'
  }
}

export default function DashboardKpiListSheet({
  count,
  label,
  icon,
  bgClass,
  layout,
  sheetTitle,
  items,
  emptyText,
  viewAllHref,
  mobileSheetOverride,
  tileAccentHex,
  tileValue,
}: Props) {
  const t = useT()
  const useMobileOverride = layout === 'mobile' && mobileSheetOverride != null
  const dialogTitle = useMobileOverride ? mobileSheetOverride.sheetTitle : sheetTitle
  const dialogItems = useMobileOverride ? mobileSheetOverride.items : items
  const dialogEmpty = useMobileOverride ? mobileSheetOverride.emptyText : emptyText
  const dialogViewAll = useMobileOverride ? mobileSheetOverride.viewAllHref : viewAllHref
  const recentCardChrome =
    useMobileOverride && mobileSheetOverride.chrome === 'recentCard'
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const dialogId = useId()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    queueMicrotask(() => panelRef.current?.querySelector<HTMLElement>('a,button')?.focus())
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const inner =
    layout === 'mobile' ? (
      <>
        <div className="flex items-center gap-3 p-4">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bgClass}`}>{icon}</div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">{label}</p>
            <p className="text-2xl font-bold tabular-nums text-app-fg">{tileValue ?? count}</p>
          </div>
        </div>
      </>
    ) : (
      <>
        <div className="flex items-center gap-4 p-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgClass}`}>{icon}</div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-app-fg-muted">{label}</p>
            <p className="mt-0.5 text-3xl font-bold leading-tight tabular-nums text-app-fg">{tileValue ?? count}</p>
          </div>
        </div>
      </>
    )

  return (
    <>
      <button
        type="button"
        className={`app-card block w-full cursor-pointer touch-manipulation text-left transition-all hover:border-app-line-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-line-40 ${
          tileAccentHex ? 'border-l-[3px]' : ''
        }`}
        style={tileAccentHex ? { borderLeftColor: tileAccentHex } : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(true)}
      >
        {inner}
      </button>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                className="absolute inset-0 app-workspace-inset-bg backdrop-blur-sm"
                aria-label={t.ui.closeMenu}
                onClick={close}
              />
              <div
                id={dialogId}
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="app-card relative z-[211] mx-auto flex w-full max-w-lg max-h-[min(78vh,32rem)] flex-col overflow-hidden rounded-xl border-app-line-22 shadow-2xl shadow-black/50"
              >
                {recentCardChrome ? (
                  <div className="flex items-center justify-between gap-3 border-b border-app-line-22 px-5 py-3.5">
                    <h2 id={titleId} className="min-w-0 text-sm font-semibold text-app-fg">
                      {dialogTitle}
                    </h2>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={dialogViewAll}
                        onClick={close}
                        className="text-xs font-semibold text-app-cyan-500 transition-colors hover:text-app-fg-muted hover:underline"
                      >
                        {t.dashboard.viewAll}
                      </Link>
                      <button
                        type="button"
                        onClick={close}
                        className="rounded-lg p-2 text-app-fg-muted transition-colors hover:bg-black/18 hover:text-white"
                        aria-label={t.ui.closeMenu}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 border-b border-app-line-22 px-4 py-3 sm:px-5">
                    <h2 id={titleId} className="text-sm font-semibold text-app-fg">
                      {dialogTitle}
                    </h2>
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-lg p-2 text-app-fg-muted transition-colors hover:bg-black/18 hover:text-white"
                      aria-label={t.ui.closeMenu}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <div
                  className={
                    recentCardChrome
                      ? `min-h-0 flex-1 overflow-y-auto overscroll-contain ${APP_SECTION_DIVIDE_ROWS} pb-[max(0.75rem,env(safe-area-inset-bottom))]`
                      : 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-3'
                  }
                >
                  {dialogItems.length === 0 ? (
                    <p className="px-5 py-12 text-center text-sm text-app-fg-muted">{dialogEmpty}</p>
                  ) : recentCardChrome ? (
                    <ul className="list-none">
                      {dialogItems.map((row) => (
                        <li key={row.id}>
                          <Link
                            href={row.href}
                            onClick={close}
                            className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-black/12"
                          >
                            <div className="min-w-0 pr-3">
                              <p className="truncate text-sm font-semibold text-app-fg">{row.title}</p>
                              {row.subtitle ? (
                                <p className="mt-0.5 truncate text-xs text-app-fg-muted">{row.subtitle}</p>
                              ) : null}
                            </div>
                            {row.statusPill ? (
                              <span
                                className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  row.statusPill === 'completato'
                                    ? 'bg-green-500/20 text-green-300'
                                    : 'bg-amber-500/20 text-amber-200'
                                }`}
                              >
                                {row.statusPill === 'completato' ? t.status.completato : t.status.inAttesa}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-0.5">
                      {dialogItems.map((row) => (
                        <li key={row.id}>
                          <Link
                            href={row.href}
                            onClick={close}
                            className="block rounded-lg px-3 py-3 text-left transition-colors hover:bg-black/12"
                          >
                            <span className="block truncate text-sm font-medium text-app-fg hover:text-app-fg-muted">
                              {row.title}
                            </span>
                            {row.subtitle ? (
                              <span className="mt-0.5 block truncate text-xs text-app-fg-muted">{row.subtitle}</span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {!recentCardChrome ? (
                  <div className="border-t border-app-line-22 px-4 py-3 sm:px-5">
                    <Link
                      href={dialogViewAll}
                      onClick={close}
                      className="block text-center text-sm font-semibold text-app-cyan-500 transition-colors hover:text-app-fg-muted"
                    >
                      {t.dashboard.viewAll}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
