'use client'

import { useState, useEffect } from 'react'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { GlyphLightBulb } from '@/components/ui/glyph-icons'

interface GmailSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function GmailSetupModal({ isOpen, onClose, onSuccess }: GmailSetupModalProps) {
  const [step, setStep] = useState<'check' | 'input' | 'connect' | 'success'>('check')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  
  // Status state
  const [, setConfigured] = useState(false)
  const [, setConnected] = useState(false)

  useEffect(() => {
    if (isOpen) {
      checkStatus()
    }
  }, [isOpen])

  const checkStatus = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/auth/google/status', {
        credentials: 'include',
      })
      
      if (!res.ok) {
        throw new Error('Errore durante il controllo dello stato')
      }
      
      const data = await res.json()
      
      setConfigured(data.configured)
      setConnected(data.connected)
      
      // Determine step based on status
      if (!data.configured) {
        setStep('input')
      } else if (!data.connected) {
        setStep('connect')
      } else {
        setStep('success')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di connessione')
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Entrambi i campi sono obbligatori')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Save to backend (we'll create this endpoint)
      const res = await fetch('/api/auth/google/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
        credentials: 'include',
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Errore nel salvataggio')
      }
      
      // Credentials saved, now need to connect
      setStep('connect')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/auth/google/setup', {
        credentials: 'include',
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Errore nella configurazione')
      }
      
      const data = await res.json()
      
      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di connessione')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (step === 'success' && onSuccess) {
      onSuccess()
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 app-aurora-modal-overlay">
      <div className="app-aurora-doc-modal-shell w-full max-w-2xl overflow-hidden rounded-lg shadow-2xl">
        {/* Header */}
        <div className="border-b border-app-line-25 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30">
                <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-app-fg">Configurazione Gmail API</h2>
                <p className="mt-0.5 text-sm text-app-fg-muted">
                  Setup rapido per attivare lo scanner automatico Rekki
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-app-line-22 bg-app-line-10/50 text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg"
            >
              <svg className={`h-4 w-4 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Loading State */}
          {loading && step === 'check' && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-app-line-25 border-t-cyan-500" />
                <p className="text-sm text-app-fg-muted">Controllo configurazione...</p>
              </div>
            </div>
          )}

          {/* Step 1: Input Credentials */}
          {step === 'input' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-blue-500/10 p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-blue-200">
                  <svg className="h-4 w-4 shrink-0 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                  Passaggi Rapidi
                </h3>
                <ol className="mt-3 ml-4 list-decimal space-y-2 text-xs leading-relaxed text-blue-200/80">
                  <li>
                    Vai su{' '}
                    <a
                      href="https://console.cloud.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      Google Cloud Console
                    </a>
                  </li>
                  <li>{'Crea un nuovo progetto (es. "Invoice Rekki App")'}</li>
                  <li>Abilita <span className="font-semibold text-blue-100">Gmail API</span></li>
                  <li>{'Configura OAuth consent screen (tipo "Esterno")'}</li>
                  <li>
                    Aggiungi 3 scopes:
                    <ul className="mt-1 ml-4 list-disc space-y-0.5 text-blue-200/70">
                      <li><code className="rounded bg-blue-500/20 px-1 py-0.5 font-mono text-[10px]">gmail.readonly</code></li>
                      <li><code className="rounded bg-blue-500/20 px-1 py-0.5 font-mono text-[10px]">gmail.modify</code></li>
                      <li><code className="rounded bg-blue-500/20 px-1 py-0.5 font-mono text-[10px]">gmail.labels</code></li>
                    </ul>
                  </li>
                  <li>{'Aggiungi la tua email come "test user"'}</li>
                  <li>
                    Crea <span className="font-semibold text-blue-100">OAuth 2.0 Client ID</span>{' '}
                    {`(tipo "Applicazione web")`}
                  </li>
                  <li>
                    Aggiungi URI di reindirizzamento:
                    <ul className="mt-1 ml-4 list-disc space-y-0.5 text-blue-200/70">
                      <li><code className="rounded bg-blue-500/20 px-1 py-0.5 font-mono text-[10px]">{window.location.origin}/api/auth/google/callback</code></li>
                    </ul>
                  </li>
                  <li>
                    <span className="font-bold text-blue-100">Copia Client ID e Client Secret</span> e incollali qui sotto
                  </li>
                </ol>
                <div className="mt-3 flex gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-xs text-cyan-200">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <span>
                    Per istruzioni dettagliate, consulta{' '}
                  <a
                    href="/INSTRUCTIONS_GOOGLE_API.md"
                    target="_blank"
                    className="font-semibold underline hover:text-cyan-100"
                  >
                    INSTRUCTIONS_GOOGLE_API.md
                  </a>
                  </span>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-app-fg">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="123456789-abcdefg.apps.googleusercontent.com"
                    className="w-full rounded-lg border border-app-line-35 bg-app-line-10/50 px-3.5 py-2.5 font-mono text-sm text-app-fg placeholder:text-app-fg-muted/50 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-app-fg">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                    className="w-full rounded-lg border border-app-line-35 bg-app-line-10/50 px-3.5 py-2.5 font-mono text-sm text-app-fg placeholder:text-app-fg-muted/50 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
                    <div className="flex items-start gap-2">
                      <svg className={`h-4 w-4 shrink-0 ${icon.duplicateAlert}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  disabled={loading || !clientId.trim() || !clientSecret.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <svg className={`h-4 w-4 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Salva e Continua
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Connect Gmail */}
          {step === 'connect' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-emerald-500/10 p-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/40">
                  <svg className="h-8 w-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-bold text-emerald-200">Credenziali salvate!</h3>
                <p className="mt-2 text-sm text-emerald-200/80">
                  Ora collega il tuo account Gmail per attivare lo scanner automatico
                </p>
              </div>

              <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-blue-500/10 p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-blue-200">
                  <svg className="h-4 w-4 shrink-0 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Prossimi passaggi
                </h4>
                <ol className="mt-3 ml-4 list-decimal space-y-2 text-xs leading-relaxed text-blue-200/80">
                  <li>Verrai reindirizzato alla pagina di autorizzazione Google</li>
                  <li>
                    Seleziona l&apos;account Gmail dell&apos;Osteria Basilico
                  </li>
                  <li>
                    Se appare &quot;App non verificata&quot;, clicca{' '}
                    <span className="font-semibold text-blue-100">&quot;Avanzate&quot;</span> →{' '}
                    <span className="font-semibold text-blue-100">
                      &quot;Vai a Invoice Rekki Scanner (non sicuro)&quot;
                    </span>
                  </li>
                  <li>Autorizza tutte le 3 permissioni richieste</li>
                  <li>Verrai riportato qui e la scansione inizierà automaticamente</li>
                </ol>
              </div>

              {error && (
                <div className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
                  <div className="flex items-start gap-2">
                    <svg className={`h-4 w-4 shrink-0 ${icon.duplicateAlert}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleConnect}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Reindirizzamento...
                  </>
                ) : (
                  <>
                    <svg className={`h-5 w-5 ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Connetti Gmail Ora
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="space-y-5 py-4 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 ring-4 ring-emerald-500/40">
                <svg className="h-10 w-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-emerald-200">Tutto pronto!</h3>
                <p className="mt-2 text-sm text-emerald-200/80">
                  Gmail è connesso e lo scanner automatico è attivo
                </p>
              </div>

              <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-emerald-500/10 p-4 text-left">
                <p className="text-xs font-semibold text-emerald-200">Funzionalità attive:</p>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-emerald-200/80">
                  <li>Scanner automatico email Rekki (ogni 15 minuti)</li>
                  <li>Aggiornamento listino prezzi in background</li>
                  <li>Confronto automatico fatture vs ordini</li>
                  <li>Sincronizzazione storico prezzi (disponibile ora!)</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
              >
                <svg className={`h-4 w-4 ${icon.analytics}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Avvia Scansione Storico
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-app-line-25 px-6 py-3">
          <p className="flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-app-fg-muted">
            <GlyphLightBulb className="h-3.5 w-3.5 shrink-0 text-amber-300/90" aria-hidden />
            Configurazione sicura · Tokens crittografati · Revocabile in qualsiasi momento
          </p>
        </div>
      </div>
    </div>
  )
}
