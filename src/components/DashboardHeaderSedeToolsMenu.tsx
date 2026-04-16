'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '@/lib/locale-context'
import DashboardDuplicateFattureButton from '@/components/DashboardDuplicateFattureButton'
import SollecitiButton from '@/components/SollecitiButton'
import ScanEmailButton from '@/components/ScanEmailButton'

const MENU_TRIGGER_CLS =
  'inline-flex h-7 min-h-7 max-h-7 shrink-0 items-center justify-center gap-1 rounded-md border border-app-line-35 app-workspace-inset-bg px-2 text-[10px] font-bold leading-none text-app-fg shadow-sm transition-colors hover:border-app-a-45 hover:shadow-[0_0_18px_-6px_rgba(34,211,238,0.28)] hover:brightness-110 active:brightness-95 whitespace-nowrap touch-manipulation sm:px-2.5 sm:text-[11px]'

const DUPLICATE_IN_PANEL_CLS =
  'flex h-9 w-full min-w-0 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-500/40 bg-amber-950/35 px-3.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-400/55 hover:bg-amber-950/55'

type PanelRect = { top: number; left: number; width: number }

/**
 * Dashboard desktop: un solo pulsante apre un pannello con duplicati, solleciti e sync email.
 * Il pannello è in `document.body` (fixed): il wrapper della header ha `overflow-x-auto` e taglierebbe un popover assoluto.
 */
export default function DashboardHeaderSedeToolsMenu({ fornitoriInScadenza = 0 }: { fornitoriInScadenza?: number }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const updatePanelRect = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const width = Math.min(320, Math.max(200, window.innerWidth - 16))
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const top = rect.bottom + 6
    setPanelRect({ top, left, width })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelRect(null)
      return
    }
    updatePanelRect()
    const onWin = () => updatePanelRect()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open, updatePanelRect])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node
      if (triggerRef.current?.contains(node) || panelRef.current?.contains(node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerLabel = t.dashboard.desktopHeaderSedeToolsMenuTrigger
  const remindersBadge = fornitoriInScadenza > 0
  const triggerAriaLabel = remindersBadge
    ? `${triggerLabel}. ${t.dashboard.desktopHeaderSedeToolsMenuTriggerAriaReminders.replace(/\{n\}/g, String(fornitoriInScadenza))}`
    : undefined

  const panel =
    open && panelRect != null ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={t.dashboard.desktopHeaderSedeToolsMenuAria}
        style={{
          position: 'fixed',
          top: panelRect.top,
          left: panelRect.left,
          width: panelRect.width,
          zIndex: 500,
        }}
        className="rounded-xl border border-app-line-25 app-workspace-surface-elevated shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65)] backdrop-blur-md"
      >
        <div className="flex max-h-[min(70vh,26rem)] w-full flex-col items-stretch gap-4 overflow-y-auto overflow-x-visible p-3">
          <DashboardDuplicateFattureButton alwaysShowLabel className={DUPLICATE_IN_PANEL_CLS} />
          {fornitoriInScadenza > 0 ? (
            <SollecitiButton fornitoriInScadenza={fornitoriInScadenza} stackedInPanel />
          ) : null}
          <div className="flex w-full min-w-0 flex-col gap-2 border-t border-app-line-25 pt-4">
            <ScanEmailButton placement="desktopHeader" stackedHeaderTrigger />
          </div>
        </div>
      </div>
    ) : null

  return (
    <>
      <div className="relative flex shrink-0 items-center">
        <button
          ref={triggerRef}
          type="button"
          className={MENU_TRIGGER_CLS}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? panelId : undefined}
          aria-label={triggerAriaLabel}
          onClick={() => setOpen((o) => !o)}
        >
          <svg className="h-3.5 w-3.5 shrink-0 text-cyan-300/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
          <span {...(remindersBadge ? { 'aria-hidden': true as const } : {})}>{triggerLabel}</span>
          {remindersBadge ? (
            <span
              aria-hidden
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-sky-500/40 bg-sky-500/20 px-0.5 text-[9px] font-bold tabular-nums leading-none text-sky-100 sm:text-[10px]"
            >
              {fornitoriInScadenza > 9 ? '9+' : fornitoriInScadenza}
            </span>
          ) : null}
          <svg
            className={`h-3 w-3 shrink-0 text-app-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </>
  )
}
