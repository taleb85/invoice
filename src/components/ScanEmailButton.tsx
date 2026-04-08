'use client'

import { useState } from 'react'
import { useT } from '@/lib/use-t'

export default function ScanEmailButton() {
  const [loading, setLoading] = useState(false)
  const t = useT()

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scan-emails', { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        alert(`Errore: ${json.error ?? 'Si è verificato un problema.'}`)
        return
      }

      alert(json.messaggio ?? 'Sincronizzazione completata.')
    } catch {
      alert('Errore di rete. Controlla la connessione e riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          {t.dashboard.syncing}
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t.dashboard.syncEmail}
        </>
      )}
    </button>
  )
}
