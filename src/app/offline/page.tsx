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
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="mb-8 h-24 w-24">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f2a3f" />
          </linearGradient>
          <linearGradient id="flow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="90" height="90" rx="22" fill="url(#bg)" />
        <text
          x="50"
          y="52"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="20"
          fontWeight="700"
          fill="url(#flow)"
          letterSpacing="1"
        >
          FLUXO
        </text>
        <path
          d="M20 65 C30 50, 50 50, 60 65 S80 80, 85 65"
          stroke="url(#flow)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="20" cy="65" r="3" fill="#3b82f6" />
        <circle cx="60" cy="65" r="3" fill="#22d3ee" />
        <circle cx="85" cy="65" r="3" fill="#3b82f6" />
      </svg>

      <h1 className="app-page-title mb-2 text-2xl font-bold">Sei offline</h1>
      <p className="max-w-sm text-sm text-app-fg-muted">
        Connettiti a internet per accedere a FLUXO. Riproveremo automaticamente ogni {INTERVAL_MS / 1000} secondi quando la
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
