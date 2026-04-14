'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { normalizeOperatorLoginName } from '@/lib/operator-login-name'
import {
  branchSessionGateRequiredRole,
  isSessionOperatorGateOk,
  markSessionOperatorGateOk,
} from '@/lib/session-operator-gate'

const PIN_LENGTH = 4

function safeNextPath(raw: string | null): string {
  const p = (raw ?? '/').trim() || '/'
  if (!p.startsWith('/') || p.startsWith('//')) return '/'
  return p
}

export default function AccessoPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  const supabase = createClient()
  const { t } = useLocale()
  const { me, loading: meLoading } = useMe()

  const [booting, setBooting] = useState(true)
  const [name, setName] = useState('')
  const [sedeNome, setSedeNome] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [nameReady, setNameReady] = useState(false)
  const resolvedEmail = useRef<string | null>(null)
  const [pin, setPin] = useState<string[]>(() => Array(PIN_LENGTH).fill(''))
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (meLoading) return
    if (!me?.user) {
      router.replace('/login')
      return
    }
    if (!branchSessionGateRequiredRole(me.role)) {
      router.replace('/')
      return
    }
    if (isSessionOperatorGateOk()) {
      router.replace(nextPath)
      return
    }
    setBooting(false)
  }, [meLoading, me?.user, me?.role, router, nextPath])

  const lookupSede = async (n: string) => {
    const token = normalizeOperatorLoginName(n)
    if (!token) {
      setSedeNome(null)
      setNameReady(false)
      resolvedEmail.current = null
      return
    }
    setLookingUp(true)
    setMessage(null)
    const ac = new AbortController()
    const abortTimer = window.setTimeout(() => ac.abort(), 18_000)
    try {
      const res = await fetch('/api/lookup-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: token }),
        signal: ac.signal,
      })
      const data = (await res.json().catch(() => ({}))) as { email?: string; sede_nome?: string }
      if (res.ok) {
        const emailNorm = (data.email ?? '').trim().toLowerCase()
        const sessionEmail = (me?.user?.email ?? '').trim().toLowerCase()
        if (emailNorm && sessionEmail && emailNorm !== sessionEmail) {
          setSedeNome(null)
          setNameReady(false)
          resolvedEmail.current = null
          setMessage(t.login.sessionGateWrongUser)
          return
        }
        setSedeNome(data.sede_nome ?? null)
        resolvedEmail.current = data.email ?? null
        setNameReady(true)
        const full = pin.join('')
        if (full.length === PIN_LENGTH && data.email) {
          void confirmPin(data.email, full)
        }
      } else {
        setSedeNome(null)
        setNameReady(false)
        resolvedEmail.current = null
        setMessage(t.login.notFound)
      }
    } catch {
      setSedeNome(null)
      setNameReady(false)
      resolvedEmail.current = null
      setMessage(t.ui.networkError)
    } finally {
      window.clearTimeout(abortTimer)
      setLookingUp(false)
    }
  }

  const confirmPin = useCallback(
    async (internalEmail: string, pinStr: string) => {
      if (loading) return
      setLoading(true)
      setMessage(null)
      const { error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: pinStr,
      })
      if (error) {
        setMessage(t.login.pinIncorrect)
        setLoading(false)
        setPin(Array(PIN_LENGTH).fill(''))
        window.setTimeout(() => pinRefs.current[0]?.focus(), 50)
        return
      }
      markSessionOperatorGateOk()
      router.replace(nextPath)
      router.refresh()
    },
    [loading, supabase, router, nextPath, t.login.pinIncorrect],
  )

  const handlePinChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...pin]
    next[idx] = digit
    setPin(next)
    setMessage(null)
    if (digit) {
      if (idx < PIN_LENGTH - 1) {
        pinRefs.current[idx + 1]?.focus()
      } else {
        pinRefs.current[idx]?.blur()
        const full = next.join('')
        if (full.length === PIN_LENGTH && resolvedEmail.current) {
          void confirmPin(resolvedEmail.current, full)
        }
      }
    }
  }

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (pin[idx]) {
        const next = [...pin]
        next[idx] = ''
        setPin(next)
      } else if (idx > 0) {
        pinRefs.current[idx - 1]?.focus()
        const next = [...pin]
        next[idx - 1] = ''
        setPin(next)
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      pinRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < PIN_LENGTH - 1) {
      pinRefs.current[idx + 1]?.focus()
    }
  }

  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (!text) return
    e.preventDefault()
    const next = Array(PIN_LENGTH).fill('')
    text.split('').forEach((c, i) => {
      next[i] = c
    })
    setPin(next)
    const lastFilled = Math.min(text.length, PIN_LENGTH) - 1
    pinRefs.current[lastFilled]?.focus()
    if (text.length === PIN_LENGTH && resolvedEmail.current) {
      void confirmPin(resolvedEmail.current, text)
    }
  }

  useEffect(() => {
    if (booting || !nameReady) return
    if (pin.every((d) => d === '')) {
      pinRefs.current[0]?.focus()
    }
  }, [booting, nameReady, pin])

  const inputCls =
    'w-full px-4 py-3 text-sm border border-slate-600/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 bg-slate-700/70 text-slate-100 placeholder:text-slate-500 transition'

  if (booting) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="text-sm text-slate-300">{t.common.loading}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-50">{t.login.sessionGateTitle}</h1>
        <p className="mt-2 text-sm leading-snug text-slate-300">{t.login.sessionGateSubtitle}</p>
      </div>

      <div className="app-card-login overflow-hidden">
        <div className="app-card-bar shrink-0" aria-hidden />
        <div className="space-y-5 p-6 text-center">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cyan-400/80">
              {t.login.nameLabel}
            </label>
            <input
              type="text"
              name="fluxo-session-gate-name"
              autoComplete="off"
              placeholder={t.login.namePlaceholder}
              value={name}
              onChange={(e) => {
                setName(e.target.value.toUpperCase())
                setSedeNome(null)
                setNameReady(false)
                resolvedEmail.current = null
                setMessage(null)
              }}
              onBlur={() => {
                const token = normalizeOperatorLoginName(name)
                setName(token)
                void lookupSede(token)
              }}
              className={`${inputCls} text-center uppercase`}
              autoFocus
              disabled={loading}
            />
            <div className="mt-2 flex h-6 min-h-6 items-center justify-center">
              {lookingUp && (
                <span className="flex items-center gap-1.5 text-xs text-slate-200">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {t.login.lookingUp}
                </span>
              )}
              {!lookingUp && sedeNome && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">
                  {sedeNome}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-cyan-400/80">
              <span>{t.login.pinLabel}</span>
              <span className="font-normal normal-case text-gray-400"> {t.login.pinDigits}</span>
            </label>
            <div className="flex justify-center gap-3" onPaste={handlePinPaste}>
              {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    pinRefs.current[idx] = el
                  }}
                  type="password"
                  name={`fluxo-session-pin-${idx}`}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={2}
                  value={pin[idx]}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  disabled={loading || (!nameReady && idx === 0 ? false : !nameReady)}
                  className={[
                    'h-14 w-14 rounded-xl border-2 text-center text-xl font-bold transition-all',
                    'focus:outline-none focus:ring-0',
                    loading
                      ? 'cursor-not-allowed border-slate-700 bg-slate-700/50 text-slate-600'
                      : pin[idx]
                        ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200 shadow-sm shadow-cyan-500/20'
                        : nameReady
                          ? 'border-slate-600 bg-slate-700/60 text-slate-100 hover:border-cyan-500/50 focus:border-cyan-400 focus:bg-cyan-500/10'
                          : 'cursor-not-allowed border-slate-700/50 bg-slate-700/30 text-slate-600',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          {message && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
              {message}
            </div>
          )}

          {(loading || pin.join('').length === PIN_LENGTH) && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-cyan-400/90">
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {loading ? t.login.verifying : t.login.accessing}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
