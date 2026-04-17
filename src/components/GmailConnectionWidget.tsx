'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface GmailConnectionStatus {
  configured: boolean  // API credentials in .env
  connected: boolean   // User has authorized
  emailAddress: string | null
  lastChecked: Date
}

export default function GmailConnectionWidget() {
  const [status, setStatus] = useState<GmailConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/auth/google/status', {
        credentials: 'include',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Errore durante il controllo dello stato')
        setLoading(false)
        return
      }
      
      setStatus({
        ...data,
        lastChecked: new Date(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    
    try {
      const res = await fetch('/api/auth/google/setup', {
        credentials: 'include',
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        if (data.instructions) {
          setError(`${data.error || 'Errore'} - Vedi: ${data.instructions}`)
        } else {
          setError(data.error || 'Errore durante la configurazione')
        }
        setConnecting(false)
        return
      }
      
      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di connessione')
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnettere Gmail? Dovrai riautorizzare per usare le funzioni automatiche.')) {
      return
    }
    
    try {
      const res = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        credentials: 'include',
      })
      
      if (res.ok) {
        await checkStatus()
      } else {
        const data = await res.json()
        setError(data.error || 'Errore durante la disconnessione')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di connessione')
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-app-line-15 bg-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-app-fg-muted border-t-transparent" />
          <span className="text-sm text-app-fg-muted">Controllo stato Gmail...</span>
        </div>
      </div>
    )
  }

  // Not configured at all
  if (status && !status.configured) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-200">Gmail API non configurato</h4>
            <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
              Per attivare lo scanner automatico email Rekki, configura Gmail API.
            </p>
            <a
              href="/INSTRUCTIONS_GOOGLE_API.md"
              target="_blank"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"
            >
              📖 Leggi le istruzioni setup
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Configured but not connected
  if (status && status.configured && !status.connected) {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-blue-200">Connetti il tuo account Gmail</h4>
              <p className="mt-1 text-xs leading-relaxed text-blue-200/80">
                Autorizza l'app ad accedere alla tua casella Gmail per lo scanner automatico Rekki.
              </p>
              {error && (
                <div className="mt-2 rounded-md bg-red-500/20 px-2 py-1.5 text-xs text-red-200">
                  {error}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {connecting ? 'Connessione...' : 'Connetti Gmail'}
          </button>
        </div>
      </div>
    )
  }

  // Connected successfully
  if (status && status.configured && status.connected) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-emerald-200">Gmail connesso</h4>
              <p className="mt-1 text-xs leading-relaxed text-emerald-200/80">
                Account: <span className="font-mono">{status.emailAddress || '(verifica in corso...)'}</span>
              </p>
              <p className="mt-1 text-xs text-emerald-300/60">
                Lo scanner automatico Rekki è attivo e controlla nuove email ogni 15 minuti.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            className="shrink-0 rounded-lg border border-app-line-22 bg-app-line-10 px-3 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-15"
          >
            Disconnetti
          </button>
        </div>
      </div>
    )
  }

  return null
}
