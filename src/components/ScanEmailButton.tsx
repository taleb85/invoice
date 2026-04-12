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
        setToast({ type: 'error', text: json.error ?? t.ui.syncError })
      } else {
        const tipo = json.avvisi?.length ? 'warn' : 'ok'
        setToast({ type: tipo, text: json.messaggio ?? t.ui.syncSuccess })
        router.refresh()
      }
    } catch {
      setToast({ type: 'error', text: t.ui.networkError })
    } finally {
      setLoading(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  const labelVis = alwaysShowLabel ? '' : 'hidden md:inline'
  const btnSize = alwaysShowLabel
    ? 'inline-flex h-11 min-h-[44px] shrink-0 items-center justify-center gap-2 px-3.5 py-0'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5'

  return (
    <div className={`flex flex-col gap-1.5 ${alwaysShowLabel ? 'min-w-0 shrink-0' : 'items-end'}`}>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`${btnSize} rounded-lg bg-cyan-500 font-semibold text-xs text-white transition-colors hover:bg-cyan-600 active:bg-cyan-700 disabled:opacity-50 whitespace-nowrap touch-manipulation`}
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className={labelVis}>{t.dashboard.syncing}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className={labelVis}>{t.dashboard.syncEmail}</span>
          </>
        )}
      </button>

      {toast && (
        <p className={`text-xs font-medium px-2 py-1 rounded-lg max-w-[220px] text-right ${
          toast.type === 'ok' ? 'bg-slate-800/90 text-green-300' :
          toast.type === 'warn' ? 'bg-slate-800/90 text-amber-200' :
          'bg-slate-800/90 text-red-300'
        }`}>
          {toast.text}
        </p>
      )}
    </div>
  )
}
