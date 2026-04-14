'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LocaleProvider, useLocale } from '@/lib/locale-context'

const SEDE_ACCESS_PIN_LEN = 4

export default function SedeLockPage() {
  return (
    <LocaleProvider>
      <SedeLockPageInner />
    </LocaleProvider>
  )
}

function SedeLockPageInner() {
  const router = useRouter()
  const { t } = useLocale()
  const a = t.appStrings

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
          setFatalError(data.error)
          setChecking(false)
          return
        }

        const verified = document.cookie.includes(`sede-verified=${data.sede_id}`)
        if (verified) { router.replace('/'); return }

        setSedeName(data.sede_nome ?? '')
        setChecking(false)
      })
      .catch(() => { if (active) { setFatalError(t.ui.networkError); setChecking(false) } })
    return () => { active = false }
  }, [router, t.ui.networkError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = code.replace(/\D/g, '').slice(0, SEDE_ACCESS_PIN_LEN)
    if (digits.length !== SEDE_ACCESS_PIN_LEN) {
      setError(a.sedeLockPinLengthError)
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/sede-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: digits }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Codice non corretto. Riprova.')
      setCode('')
      setLoading(false)
      return
    }

    document.cookie = `sede-verified=${data.sede_id}; path=/; Max-Age=86400; SameSite=Lax`
    window.location.assign('/')
  }

  const shell = (children: ReactNode) => (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800 p-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  )

  const lockDescription = (() => {
    const template = a.sedeLockDescription
    const parts = template.split('{name}')
    if (parts.length < 2) {
      return <span className="text-slate-200">{template}</span>
    }
    return (
      <span className="text-slate-200">
        {parts[0]}
        <strong className="font-semibold text-slate-200">{sedeName}</strong>
        {parts.slice(1).join('{name}')}
      </span>
    )
  })()

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-700">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    )
  }

  if (fatalError) {
    return shell(
      <div className="app-card-login flex flex-col overflow-hidden text-center">
        <div className="app-card-bar shrink-0" aria-hidden />
        <div className="space-y-4 p-8">
        <p className="text-sm font-medium text-red-300">{fatalError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
        >
          {t.statements.btnRefresh}
        </button>
        </div>
      </div>,
    )
  }

  return shell(
    <>
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-700/80 shadow-lg shadow-black/20">
          <svg className="h-8 w-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h1 className="app-page-title text-xl font-bold">{a.sedeLockTitle}</h1>
        <p className="mt-1 text-center text-sm leading-snug">{lockDescription}</p>
      </div>

      <form onSubmit={handleSubmit} className="app-card-login flex flex-col overflow-hidden">
        <div className="app-card-bar shrink-0" aria-hidden />
        <div className="space-y-4 p-8">
        <div>
          <label htmlFor="sede-access-code" className="mb-1.5 block text-sm font-medium text-slate-200">
            {a.sedeLockCodeLabel}
          </label>
          <input
            id="sede-access-code"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            enterKeyHint="done"
            maxLength={SEDE_ACCESS_PIN_LEN}
            value={code}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, SEDE_ACCESS_PIN_LEN)
              setCode(digits)
            }}
            placeholder={a.sedeLockPlaceholder}
            autoFocus
            required
            className="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-3 py-2.5 text-center text-lg tracking-[0.35em] text-slate-100 placeholder:text-slate-500 placeholder:tracking-widest focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
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
          disabled={loading || code.length !== SEDE_ACCESS_PIN_LEN}
          className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t.login.verifying : t.login.loginBtn}
        </button>
        </div>
      </form>
    </>,
  )
}
