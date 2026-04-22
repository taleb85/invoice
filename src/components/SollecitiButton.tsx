'use client'

import { useState } from 'react'
import { useT } from '@/lib/use-t'

interface Props {
  /** Fornitori con bolle «in attesa» in scadenza (stessa logica di POST /api/solleciti). */
  fornitoriInScadenza?: number
  /**
   * Striscia desktop header: h-7 allineato a Sincronizza Email, toast in absolute (non allarga la barra).
   */
  toolbarStrip?: boolean
  /** Menu dashboard: pulsante a tutta larghezza in colonna con duplicati / sync. */
  stackedInPanel?: boolean
}

export default function SollecitiButton({
  fornitoriInScadenza = 0,
  toolbarStrip = false,
  stackedInPanel = false,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const t = useT()

  if (fornitoriInScadenza === 0) return null

  const handleClick = async () => {
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch('/api/solleciti', { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        setToast({ type: 'error', text: json.error ?? t.ui.reminderError })
      } else if (json.inviati === 0) {
        setToast({ type: 'ok', text: t.ui.noReminders })
      } else {
        const tpl = json.inviati === 1 ? t.ui.remindersSentOne : t.ui.remindersSentMany
        setToast({
          type: 'ok',
          text: tpl.replace(/\{n\}/g, String(json.inviati)).replace(/\{total\}/g, String(json.totale)),
        })
      }
    } catch {
      setToast({ type: 'error', text: t.ui.networkError })
    } finally {
      setLoading(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  const wrapCls = toolbarStrip
    ? 'relative flex shrink-0 items-center'
    : stackedInPanel
      ? 'relative flex w-full min-w-0 flex-col items-stretch gap-2'
      : 'flex shrink-0 flex-col items-end gap-1.5'
  /** Toolbar: come sync header. Altrimenti: arancio (anche a tutta larghezza nel menu Strumenti). */
  const btnCls = toolbarStrip
    ? 'inline-flex h-7 min-h-7 max-h-7 shrink-0 items-center justify-center gap-0.5 rounded-md border border-app-line-35 app-workspace-inset-bg px-2 text-[10px] font-bold leading-none text-app-fg shadow-sm transition-colors hover:brightness-110 active:brightness-95 whitespace-nowrap sm:gap-1 sm:rounded-lg sm:px-2.5 sm:text-[11px] disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation'
    : stackedInPanel
      ? 'flex h-9 w-full min-w-0 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-orange-500 px-3.5 py-0 text-xs font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 touch-manipulation'
      : 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3.5 py-0 text-xs font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 whitespace-nowrap touch-manipulation'
  const iconCls = toolbarStrip ? 'h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4' : 'w-4 h-4'

  return (
    <div className={wrapCls}>
      <button onClick={handleClick} disabled={loading} className={btnCls}>
        {loading ? (
          <>
            <svg
              className={`${toolbarStrip ? 'h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4' : iconCls} animate-spin shrink-0`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {t.dashboard.sending}
          </>
        ) : (
          <>
            <svg className={`${iconCls}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{t.dashboard.sendReminders}</span>
            {/* Badge con conteggio */}
            <span
              className={
                toolbarStrip
                  ? 'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm border border-[rgba(34,211,238,0.15)] bg-sky-500/20 px-0.5 text-[9px] font-bold tabular-nums leading-none text-sky-100 sm:text-[10px]'
                  : 'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm border border-[rgba(34,211,238,0.15)] bg-sky-500/20 px-0.5 text-[9px] font-bold tabular-nums text-sky-100'
              }
            >
              {fornitoriInScadenza > 9 ? '9+' : fornitoriInScadenza}
            </span>
          </>
        )}
      </button>

      {toast ? (
        <p
          className={
            toolbarStrip
              ? `absolute right-0 top-[calc(100%+6px)] z-[220] max-w-[min(18rem,calc(100vw-2rem))] rounded-lg px-2 py-1 text-left text-[11px] font-medium shadow-lg ${
                  toast.type === 'ok'
                    ? 'app-workspace-surface-elevated text-green-300 ring-1 ring-app-line-35'
                    : 'app-workspace-surface-elevated text-red-300 ring-1 ring-app-line-35'
                }`
              : stackedInPanel
                ? `mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium ${
                    toast.type === 'ok' ? 'app-workspace-surface-elevated text-green-300' : 'app-workspace-surface-elevated text-red-300'
                  }`
                : `text-xs font-medium px-2 py-1 rounded-lg max-w-[220px] text-right ${
                    toast.type === 'ok' ? 'app-workspace-surface-elevated text-green-300' : 'app-workspace-surface-elevated text-red-300'
                  }`
          }
        >
          {toast.text}
        </p>
      ) : null}
    </div>
  )
}
