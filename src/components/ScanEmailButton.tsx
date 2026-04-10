'use client'

import { useState, useEffect, useRef } from 'react'
import { useT } from '@/lib/use-t'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'

interface Props {
  /** Se true mostra sempre il testo (non solo su desktop) */
  alwaysShowLabel?: boolean
  /**
   * When provided (e.g. from /sedi/[sede_id]/page.tsx URL params), the scan is
   * scoped to this specific branch — skips the /api/me lookup entirely.
   */
  sedeId?: string
}

export default function ScanEmailButton({ alwaysShowLabel = false, sedeId: propSedeId }: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const fallbackSedeIdRef = useRef<string | null>(null)
  const t = useT()
  const router = useRouter()
  const { me } = useMe()

  // Populate fallback sede_id from shared context — no extra /api/me fetch
  useEffect(() => {
    if (propSedeId) return
    if (me?.sede_id) fallbackSedeIdRef.current = me.sede_id
  }, [propSedeId, me])

  const handleClick = async () => {
    setLoading(true)
    setToast(null)
    try {
      const effectiveSedeId = propSedeId ?? fallbackSedeIdRef.current
      const payload = effectiveSedeId
        ? {
            user_sede_id: effectiveSedeId,
            // filter_sede_id tells the API to restrict the IMAP scan to this branch only
            filter_sede_id: propSedeId ?? undefined,
          }
        : undefined
      const body = payload ? JSON.stringify(payload) : undefined
      const res = await fetch('/api/scan-emails', {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      })
      const json = await res.json()

      if (!res.ok) {
        setToast({ type: 'error', text: json.error ?? 'Errore durante la scansione.' })
      } else {
        // Avvisi IMAP (configurazione errata) mostrati in arancione
        const tipo = json.avvisi?.length ? 'warn' : 'ok'
        setToast({ type: tipo, text: json.messaggio ?? 'Sincronizzazione completata.' })
        router.refresh()
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
        className="flex items-center gap-2 px-3 py-2.5 bg-accent hover:bg-accent-hover active:bg-cyan-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
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
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className={alwaysShowLabel ? '' : 'hidden md:inline'}>{t.dashboard.syncEmail}</span>
          </>
        )}
      </button>

      {toast && (
        <p className={`text-xs font-medium px-2 py-1 rounded-lg max-w-[220px] text-right ${
          toast.type === 'ok' ? 'text-green-700 bg-green-50' :
          toast.type === 'warn' ? 'text-amber-700 bg-amber-50' :
          'text-red-600 bg-red-50'
        }`}>
          {toast.text}
        </p>
      )}
    </div>
  )
}
