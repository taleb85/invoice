'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { LocaleProvider, useLocale } from '@/lib/locale-context'
import { normalizeOperatorLoginName } from '@/lib/operator-login-name'
import { LOCALES } from '@/lib/translations'

type Message = { type: 'error' | 'success'; text: string }

const EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com',
  'live.it', 'live.com', 'yahoo.com', 'yahoo.it', 'icloud.com',
  'libero.it', 'virgilio.it', 'aruba.it', 'proton.me', 'protonmail.com',
]

const PIN_LENGTH = 4

export default function LoginForm() {
  return (
    <LocaleProvider>
      <LoginFormInner />
    </LocaleProvider>
  )
}

function LoginFormInner() {
  const router   = useRouter()
  const supabase = createClient()
  const { locale, t, setLocale } = useLocale()
  const [langOpen, setLangOpen] = useState(false)

  const [mode, setMode]     = useState<'name' | 'admin'>('name')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  /* ── operatore ─────────────────────────────────────── */
  const [name, setName]         = useState('')
  const [sedeNome, setSedeNome] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [nameReady, setNameReady] = useState(false) // nome trovato nel DB
  const resolvedEmail = useRef<string | null>(null)  // email interna → usata per signIn

  /* PIN: array di 4 cifre */
  const [pin, setPin]   = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const pinRefs         = useRef<(HTMLInputElement | null)[]>([])

  /* ── admin ─────────────────────────────────────────── */
  const [email, setEmail]           = useState('')
  const [adminPw, setAdminPw]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSugg, setShowSugg]     = useState(false)

  /* ─── lookup nome → email interna ─────────────────── */
  const lookupSede = async (n: string) => {
    const token = normalizeOperatorLoginName(n)
    if (!token) { setSedeNome(null); setNameReady(false); resolvedEmail.current = null; return }
    setLookingUp(true)
    const ac = new AbortController()
    const abortTimer = window.setTimeout(() => ac.abort(), 18_000)
    try {
      const res = await fetch('/api/lookup-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: token }),
        signal: ac.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSedeNome(data.sede_nome ?? null)
        resolvedEmail.current = data.email ?? null
        setNameReady(true)
        if (pin.join('').length === PIN_LENGTH && data.email) {
          doLoginByName(data.email, pin.join(''))
        }
      } else {
        setSedeNome(null)
        setNameReady(false)
        resolvedEmail.current = null
        setMessage({ type: 'error', text: t.login.notFound })
      }
    } catch {
      setSedeNome(null)
      setNameReady(false)
      resolvedEmail.current = null
      setMessage({ type: 'error', text: t.ui.networkError })
    } finally {
      window.clearTimeout(abortTimer)
      setLookingUp(false)
    }
  }

  /* ─── login operatore ─────────────────────────────── */
  const doLoginByName = useCallback(async (internalEmail: string, pinStr: string) => {
    if (loading) return
    setLoading(true); setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email: internalEmail, password: pinStr })
    if (error) {
      setMessage({ type: 'error', text: t.login.pinIncorrect })
      setLoading(false)
      /* svuota e rimetti focus sul primo campo */
      setPin(Array(PIN_LENGTH).fill(''))
      setTimeout(() => pinRefs.current[0]?.focus(), 50)
      return
    }
    router.push('/'); router.refresh()
  }, [loading, supabase, router])

  /* ─── gestione digitazione PIN ────────────────────── */
  const handlePinChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1) // solo ultima cifra
    const next  = [...pin]
    next[idx]   = digit
    setPin(next)
    setMessage(null)

    if (digit) {
      if (idx < PIN_LENGTH - 1) {
        pinRefs.current[idx + 1]?.focus()
      } else {
        /* ultimo box compilato */
        pinRefs.current[idx]?.blur()
        const full = next.join('')
        if (full.length === PIN_LENGTH && resolvedEmail.current) {
          doLoginByName(resolvedEmail.current, full)
        } else if (full.length === PIN_LENGTH && !resolvedEmail.current) {
          /* nome non ancora risolto → aspetta lookup */
        }
      }
    }
  }

  const handlePinKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (pin[idx]) {
        const next = [...pin]; next[idx] = ''; setPin(next)
      } else if (idx > 0) {
        pinRefs.current[idx - 1]?.focus()
        const next = [...pin]; next[idx - 1] = ''; setPin(next)
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      pinRefs.current[idx - 1]?.focus()
    } else if (e.key === 'ArrowRight' && idx < PIN_LENGTH - 1) {
      pinRefs.current[idx + 1]?.focus()
    }
  }

  /* gestione incolla (es. "1234" → riempie tutto) */
  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text   = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (!text) return
    e.preventDefault()
    const next = Array(PIN_LENGTH).fill('')
    text.split('').forEach((c, i) => { next[i] = c })
    setPin(next)
    const lastFilled = Math.min(text.length, PIN_LENGTH) - 1
    pinRefs.current[lastFilled]?.focus()
    if (text.length === PIN_LENGTH && resolvedEmail.current) {
      doLoginByName(resolvedEmail.current, text)
    }
  }

  /* sposta focus al PIN appena il nome è risolto */
  useEffect(() => {
    if (nameReady && pin.every(d => d === '')) {
      pinRefs.current[0]?.focus()
    }
  }, [nameReady, pin])

  /* ─── email autocomplete ──────────────────────────── */
  const handleEmailChange = (val: string) => {
    setEmail(val)
    const at = val.indexOf('@')
    if (at !== -1) {
      const local = val.slice(0, at), after = val.slice(at + 1).toLowerCase()
      const hits  = EMAIL_DOMAINS.filter(d => d.startsWith(after) && d !== after).map(d => `${local}@${d}`)
      setSuggestions(hits.slice(0, 5)); setShowSugg(hits.length > 0)
    } else { setSuggestions([]); setShowSugg(false) }
  }

  /* ─── login admin (solo profilo role = admin) ─────── */
  const handleLoginByEmail = async () => {
    if (!email || !adminPw) return
    setLoading(true); setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: adminPw })
    if (error) { setMessage({ type: 'error', text: t.login.invalidCredentials }); setLoading(false); return }

    const { data: { user: signedUser } } = await supabase.auth.getUser()
    if (!signedUser) {
      setMessage({ type: 'error', text: t.login.invalidCredentials })
      setLoading(false)
      return
    }
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', signedUser.id).maybeSingle()
    if (String(prof?.role ?? '').toLowerCase() !== 'admin') {
      await supabase.auth.signOut()
      setMessage({ type: 'error', text: t.login.adminOnlyEmail })
      setLoading(false)
      return
    }

    router.push('/'); router.refresh()
  }

  const inputCls = 'w-full px-4 py-3 text-sm border border-slate-600/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 bg-slate-800/70 text-slate-100 placeholder:text-slate-500 transition'

  const pinFilled = pin.join('').length === PIN_LENGTH

  return (
    <div className="w-full max-w-xs">

      {/* Logo — ingrandito, verticale */}
      <div className="flex flex-col items-center mb-6 -mt-4">
        <svg viewBox="0 0 96 56" xmlns="http://www.w3.org/2000/svg" className="w-28 h-[68px] shrink-0 drop-shadow-[0_6px_24px_rgba(6,182,212,0.45)] mb-4">
          <defs>
            <linearGradient id="lg-card" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f"/>
              <stop offset="100%" stopColor="#172554"/>
            </linearGradient>
            <linearGradient id="lg-wave" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#5b7cf9"/>
              <stop offset="50%"  stopColor="#38bdf8"/>
              <stop offset="100%" stopColor="#22d3ee"/>
            </linearGradient>
          </defs>
          <rect width="56" height="56" rx="13" fill="url(#lg-card)" />
          <path d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28"
                stroke="url(#lg-wave)" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <circle cx="7"  cy="28" r="3.5" fill="#5b7cf9"/>
          <circle cx="48" cy="28" r="3.5" fill="#38bdf8"/>
          <circle cx="88" cy="28" r="3.5" fill="#22d3ee"/>
        </svg>
        <h1 className="text-5xl font-extrabold tracking-widest bg-gradient-to-r from-[#7c9dff] via-[#5dd8ff] to-[#2ee8ff] bg-clip-text text-transparent leading-none drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">FLUXO</h1>
        <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mt-2 bg-gradient-to-r from-[#7c9dff] via-[#5dd8ff] to-[#2ee8ff] bg-clip-text text-transparent opacity-80">Gestione Fatture</p>
        <p className="text-xs text-white/90 mt-6">
          {mode === 'name' ? t.login.subtitle : t.login.adminSubtitle}
        </p>
      </div>

      {/* Card — tema Deep Ocean; shell + barra = globals .app-card-login / .app-card-bar */}
      <div className="app-card-login">
        <div className="app-card-bar" aria-hidden />

        <div className="p-6 space-y-4">

        {mode === 'name' ? (
          /* ── OPERATORE: Nome + PIN a 4 cifre ── */
          <div className="space-y-5">

            {/* Nome */}
            <div>
              <label className="block text-xs font-semibold text-cyan-400/80 mb-1.5 uppercase tracking-wide">{t.login.nameLabel}</label>
              <input
                type="text"
                autoComplete="given-name"
                placeholder={t.login.namePlaceholder}
                value={name}
                onChange={e => {
                  setName(e.target.value.toUpperCase())
                  setSedeNome(null)
                  setNameReady(false)
                  resolvedEmail.current = null
                }}
                onBlur={() => {
                  const token = normalizeOperatorLoginName(name)
                  setName(token)
                  void lookupSede(token)
                }}
                className={inputCls + ' uppercase'}
                autoFocus
                disabled={loading}
              />
              {/* Badge sede */}
              <div className="mt-2 h-6 flex items-center">
                {lookingUp && (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {t.login.lookingUp}
                  </span>
                )}
                {!lookingUp && sedeNome && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/10 text-cyan-300 text-xs font-semibold rounded-lg border border-cyan-500/20">
                    <svg className="w-3 h-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                    {sedeNome}
                  </span>
                )}
                {!lookingUp && !sedeNome && name.trim().length > 1 && !nameReady && (
                  <span className="text-xs text-slate-500">{t.login.enterFirstName}</span>
                )}
              </div>
            </div>

            {/* PIN a 4 caselle */}
            <div>
              <label className="block text-xs font-semibold text-cyan-400/80 mb-3 uppercase tracking-wide">
                {t.login.pinLabel}
                <span className="ml-1.5 font-normal text-gray-400 normal-case">{t.login.pinDigits}</span>
              </label>
              <div className="flex gap-3 justify-center" onPaste={handlePinPaste}>
                {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
                  <input
                    key={idx}
                    ref={el => { pinRefs.current[idx] = el }}
                    type="password"
                    inputMode="numeric"
                    maxLength={2}
                    value={pin[idx]}
                    onChange={e => handlePinChange(idx, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(idx, e)}
                    disabled={loading || (!nameReady && idx === 0 ? false : !nameReady)}
                    className={[
                      'w-14 h-14 text-center text-xl font-bold border-2 rounded-xl transition-all',
                      'focus:outline-none focus:ring-0',
                      loading
                        ? 'border-slate-700 bg-slate-800/50 text-slate-600'
                        : pin[idx]
                          ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200 shadow-sm shadow-cyan-500/20'
                          : nameReady
                            ? 'border-slate-600 bg-slate-800/60 text-slate-100 hover:border-cyan-500/50 focus:border-cyan-400 focus:bg-cyan-500/10'
                            : 'border-slate-700/50 bg-slate-800/30 text-slate-600 cursor-not-allowed',
                    ].join(' ')}
                  />
                ))}
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-2 mt-3">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <span key={i} className={[
                    'w-1.5 h-1.5 rounded-full transition-all duration-200',
                    pin[i] ? 'bg-cyan-400 scale-110 shadow-[0_0_6px_rgba(34,211,238,0.6)]' : 'bg-slate-600',
                  ].join(' ')} />
                ))}
              </div>

              {/* Indicatore auto-login */}
              {(pinFilled || loading) && (
                <p className="text-center text-xs text-blue-500 mt-2 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {loading ? t.login.verifying : t.login.accessing}
                </p>
              )}
            </div>

            {message && <FeedbackMsg msg={message} />}
          </div>

        ) : (
          /* ── ADMIN: Email + Password ── */
          <form onSubmit={e => { e.preventDefault(); handleLoginByEmail() }} className="space-y-4">

            <div className="relative">
              <label className="block text-xs font-semibold text-cyan-400/80 mb-1.5 uppercase tracking-wide">{t.login.emailLabel}</label>
              <input
                type="email" autoComplete="email" placeholder={t.login.emailPlaceholder}
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                className={inputCls} autoFocus
              />
              {showSugg && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-slate-800 border border-slate-600/60 rounded-xl shadow-xl overflow-hidden text-sm">
                  {suggestions.map(s => {
                    const at = s.indexOf('@')
                    return (
                      <li key={s}>
                        <button type="button" onMouseDown={() => { setEmail(s); setSuggestions([]); setShowSugg(false) }}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-700/60 transition-colors flex items-center gap-1">
                          <span className="text-slate-400">{s.slice(0, at + 1)}</span>
                          <span className="text-slate-100 font-medium">{s.slice(at + 1)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-cyan-400/80 mb-1.5 uppercase tracking-wide">{t.login.passwordLabel}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  placeholder={t.login.passwordPlaceholder} value={adminPw}
                  onChange={e => setAdminPw(e.target.value)} className={inputCls + ' pr-11'}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                  {showPw ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {message && <FeedbackMsg msg={message} />}

            <button type="submit" disabled={loading || !email || !adminPw}
              className="app-glow-cyan flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50">
              {loading
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
              }
              {t.login.loginBtn}
            </button>
          </form>
        )}
        </div>{/* fine p-8 */}
      </div>{/* fine card */}

      {/* Toggle admin + language selector row */}
      <div className="flex items-center justify-between mt-5 px-1">
        {mode === 'name' ? (
          <button type="button" onClick={() => { setMode('admin'); setMessage(null) }}
            className="text-[11px] text-white/80 hover:text-white transition-colors">
            {t.login.adminLink}
          </button>
        ) : (
          <button type="button" onClick={() => { setMode('name'); setMessage(null) }}
            className="text-[11px] text-white/50 hover:text-white/80 transition-colors">
            {t.login.operatorLink}
          </button>
        )}

        {/* Compact language switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen(o => !o)}
            className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 transition-colors"
          >
            <span className="text-sm leading-none">{LOCALES.find(l => l.code === locale)?.flag}</span>
            <svg className={`w-2.5 h-2.5 transition-transform ${langOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {langOpen && (
            <div className="absolute bottom-full mb-1 right-0 bg-[#0f2040] border border-white/10 rounded-xl overflow-hidden shadow-xl z-50 w-36">
              {LOCALES.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => { setLocale(l.code); setLangOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors ${
                    locale === l.code ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-sm">{l.flag}</span>
                  <span>{l.label}</span>
                  {locale === l.code && (
                    <svg className="w-3 h-3 ml-auto text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FeedbackMsg({ msg }: { msg: Message }) {
  return (
    <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
      msg.type === 'error' ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-green-500/10 text-green-300 border border-green-500/20'
    }`}>
      {msg.type === 'error'
        ? <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        : <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      }
      {msg.text}
    </div>
  )
}
