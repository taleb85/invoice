'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const CODE_MAX_LEN = 32

export default function SedeLockPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sedeName, setSedeName] = useState('')
  const [checking, setChecking] = useState(true)
  const [fatalError, setFatalError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/sede-lock')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (data.redirect) { router.replace(data.redirect); return }
        if (data.error) {
          // Sessione non valida: mostra errore invece di fare redirect (evita loop)
          setFatalError(data.error)
          setChecking(false)
          return
        }

        const verified = document.cookie.includes(`sede-verified=${data.sede_id}`)
        if (verified) { router.replace('/'); return }

        setSedeName(data.sede_nome ?? '')
        setChecking(false)
      })
      .catch(() => { if (active) { setFatalError('Errore di connessione. Ricarica la pagina.'); setChecking(false) } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const trimmed = code.replace(/\D/g, '').trim()
    const res = await fetch('/api/sede-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Codice non corretto. Riprova.')
      setCode('')
      setLoading(false)
      return
    }

    document.cookie = `sede-verified=${data.sede_id}; path=/; Max-Age=86400; SameSite=Lax`
    // Navigazione completa: così il cookie viene sempre inviato al middleware sul primo GET (evita race con client router)
    window.location.assign('/')
  }

  const shell = (children: ReactNode) => (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#020817] via-slate-950 to-[#0a1628] p-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  )

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    )
  }

  if (fatalError) {
    return shell(
      <div className="app-card-login space-y-4 p-8 text-center">
        <div className="app-card-bar mb-2" aria-hidden />
        <p className="text-sm font-medium text-red-300">{fatalError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
        >
          Ricarica
        </button>
      </div>
    )
  }

  return shell(
    <>
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-900/80 shadow-lg shadow-black/20">
          <svg className="h-8 w-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-100">Accesso protetto</h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          La sede <strong className="font-semibold text-slate-200">{sedeName}</strong> richiede un codice numerico di accesso
        </p>
      </div>

      <form onSubmit={handleSubmit} className="app-card-login space-y-4 p-8">
        <div className="app-card-bar mb-2" aria-hidden />
        <div>
          <label htmlFor="sede-access-code" className="mb-1.5 block text-sm font-medium text-slate-400">
            Codice accesso (solo numeri)
          </label>
          <input
            id="sede-access-code"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            enterKeyHint="done"
            value={code}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, CODE_MAX_LEN)
              setCode(digits)
            }}
            placeholder="••••••••"
            autoFocus
            required
            className="w-full rounded-lg border border-slate-600/50 bg-slate-950/50 px-3 py-2.5 text-sm tracking-widest text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
          {error && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Verifica…' : 'Accedi'}
        </button>
      </form>
    </>
  )
}
