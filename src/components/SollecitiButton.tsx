'use client'

import { useState } from 'react'
import { useT } from '@/lib/use-t'

export default function SollecitiButton() {
  const [loading, setLoading] = useState(false)
  const t = useT()

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solleciti', { method: 'POST' })
      const json = await res.json()

      if (!res.ok) {
        alert(`Errore: ${json.error ?? 'Si è verificato un problema.'}`)
        return
      }

      if (json.inviati === 0) {
        alert('Nessun sollecito da inviare.')
      } else {
        alert(`Solleciti inviati con successo: ${json.inviati} su ${json.totale}.`)
      }
    } catch {
      alert('Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
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
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {t.dashboard.sendReminders}
        </>
      )}
    </button>
  )
}
