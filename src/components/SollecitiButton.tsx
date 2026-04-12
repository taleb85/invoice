'use client'

import { useState } from 'react'
import { useT } from '@/lib/use-t'

interface Props {
  /** Fornitori con bolle «in attesa» in scadenza (stessa logica di POST /api/solleciti). */
  fornitoriInScadenza?: number
}

export default function SollecitiButton({ fornitoriInScadenza = 0 }: Props) {
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

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-500 px-3.5 py-0 text-xs font-semibold text-white transition-colors hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 whitespace-nowrap touch-manipulation"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {t.dashboard.sending}
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{t.dashboard.sendReminders}</span>
            {/* Badge con conteggio */}
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/20 px-0.5 text-[10px] font-bold tabular-nums text-orange-200">
              {fornitoriInScadenza > 9 ? '9+' : fornitoriInScadenza}
            </span>
          </>
        )}
      </button>

      {toast && (
        <p className={`text-xs font-medium px-2 py-1 rounded-lg max-w-[220px] text-right ${
          toast.type === 'ok' ? 'bg-slate-800/90 text-green-300' : 'bg-slate-800/90 text-red-300'
        }`}>
          {toast.text}
        </p>
      )}
    </div>
  )
}
