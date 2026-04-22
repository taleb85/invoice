'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import LoginBrandedShell from '@/components/LoginBrandedShell'

const INTERVAL_MS = 5000

async function probeApp(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  try {
    const ac = new AbortController()
    const to = window.setTimeout(() => ac.abort(), 4000)
    const r = await fetch('/api/me', { method: 'GET', cache: 'no-store', signal: ac.signal })
    window.clearTimeout(to)
    // 401/404 = server raggiungibile (non sessione valida o profilo assente); solo assenza risposta = offline.
    return r.ok || r.status === 401 || r.status === 404
  } catch {
    return false
  }
}

export default function OfflinePage() {
  const router = useRouter()
  const busyRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const attempt = async () => {
      if (cancelled || busyRef.current) return
      busyRef.current = true
      try {
        const ok = await probeApp()
        if (cancelled) return
        if (ok) {
          router.replace('/')
          return
        }
      } finally {
        busyRef.current = false
      }
    }

    void attempt()
    const id = window.setInterval(() => void attempt(), INTERVAL_MS)
    const onOnline = () => void attempt()
    window.addEventListener('online', onOnline)
    return () => {
      cancelled = true
      window.clearInterval(id)
      window.removeEventListener('online', onOnline)
    }
  }, [router])

  return (
    <LoginBrandedShell>
      <div className="flex w-full max-w-md flex-col items-center px-6 text-center">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#0f2a4a] shadow-[0_0_48px_rgba(34,211,238,0.25)] ring-2 ring-[#22d3ee]/20">
        <svg width="52" height="52" viewBox="0 0 40 40" fill="none" aria-hidden>
          <path d="M4 20 L16 8 L16 15 L28 15 L28 20" stroke="#22d3ee" strokeWidth="3.8" strokeLinejoin="round" strokeLinecap="round"/>
          <path d="M36 20 L24 32 L24 25 L12 25 L12 20" stroke="#5b7cf9" strokeWidth="3.8" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </div>

      <h1 className="app-page-title mb-2 text-2xl font-bold">Sei offline</h1>
      <p className="max-w-sm text-sm text-app-fg-muted">
        Connettiti a internet per accedere a Smart Pair. Riproveremo automaticamente ogni {INTERVAL_MS / 1000} secondi quando la
        connessione torna, oppure appena il browser segnala di essere di nuovo online.
      </p>
      <p className="mt-3 max-w-sm text-xs text-app-fg-muted">
        Le pagine già visitate possono restare disponibili dalla cache del browser o della PWA.
      </p>

      <button
        type="button"
        onClick={() => {
          window.location.reload()
        }}
        className="mt-8 rounded-xl bg-gradient-to-r from-app-cyan-500 to-app-cyan-400 px-6 py-3 text-sm font-semibold text-cyan-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition-opacity hover:opacity-95"
      >
        Riprova ora
      </button>
      </div>
    </LoginBrandedShell>
  )
}
