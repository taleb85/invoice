'use client'

import { useState } from 'react'
import { useT } from '@/lib/use-t'

interface Props {
  /** Numero di bolle senza fattura. Se 0 o undefined il pulsante non viene mostrato. */
  bolleInAttesa?: number
}

export default function SollecitiButton({ bolleInAttesa = 0 }: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const t = useT()

  // Non mostrare nulla se non ci sono bolle in attesa
  if (bolleInAttesa === 0) return null

  const handleClick = async () => {
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch('/api/solleciti', { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        setToast({ type: 'error', text: json.error ?? 'Errore durante l\'invio.' })
      } else if (json.inviati === 0) {
        setToast({ type: 'ok', text: 'Nessun sollecito da inviare (fornitori senza email?).' })
      } else {
        setToast({ type: 'ok', text: `${json.inviati} sollecit${json.inviati === 1 ? 'o inviato' : 'i inviati'} su ${json.totale}.` })
      }
    } catch {
      setToast({ type: 'error', text: 'Errore di rete. Riprova.' })
    } finally {
      setLoading(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
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
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="hidden md:inline">{t.dashboard.sendReminders}</span>
            {/* Badge con conteggio */}
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-white text-orange-600 rounded-full shrink-0">
              {bolleInAttesa > 9 ? '9+' : bolleInAttesa}
            </span>
          </>
        )}
      </button>

      {toast && (
        <p className={`text-xs font-medium px-2 py-1 rounded-lg max-w-[220px] text-right ${
          toast.type === 'ok' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
        }`}>
          {toast.text}
        </p>
      )}
    </div>
  )
}
