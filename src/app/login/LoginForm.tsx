'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Message = { type: 'error' | 'success'; text: string }

const EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com',
  'live.it', 'live.com', 'yahoo.com', 'yahoo.it', 'icloud.com',
  'libero.it', 'virgilio.it', 'aruba.it', 'proton.me', 'protonmail.com',
]

const PIN_LENGTH = 4

export default function LoginForm() {
  const router   = useRouter()
  const supabase = createClient()

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
    if (!n.trim()) { setSedeNome(null); setNameReady(false); resolvedEmail.current = null; return }
    setLookingUp(true)
    const res  = await fetch('/api/lookup-name', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n.trim() }),
    })
    const data = await res.json()
    setLookingUp(false)
    if (res.ok) {
      setSedeNome(data.sede_nome ?? null)
      resolvedEmail.current = data.email ?? null
      setNameReady(true)
      /* se il PIN era già completo, prova il login */
      if (pin.join('').length === PIN_LENGTH && data.email) {
        doLoginByName(data.email, pin.join(''))
      }
    } else {
      setSedeNome(null)
      setNameReady(false)
      resolvedEmail.current = null
    }
  }

  /* ─── login operatore ─────────────────────────────── */
  const doLoginByName = useCallback(async (internalEmail: string, pinStr: string) => {
    if (loading) return
    setLoading(true); setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email: internalEmail, password: pinStr })
    if (error) {
      setMessage({ type: 'error', text: 'PIN non corretto. Riprova.' })
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

  /* ─── login admin ─────────────────────────────────── */
  const handleLoginByEmail = async () => {
    if (!email || !adminPw) return
    setLoading(true); setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: adminPw })
    if (error) { setMessage({ type: 'error', text: 'Credenziali non valide.' }); setLoading(false); return }
    router.push('/'); router.refresh()
  }

  const inputCls = 'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a3050] focus:border-transparent bg-white placeholder:text-gray-300 transition'

  const pinFilled = pin.join('').length === PIN_LENGTH

  return (
    <div className="w-full max-w-sm">

      {/* Logo */}
      <div className="flex flex-col items-center mb-8 -mt-8">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" className="w-24 h-14 shrink-0">
            <defs>
              <linearGradient id="lg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#22d3ee"/>
              </linearGradient>
            </defs>
            <rect x="0" y="5" width="50" height="50" rx="12" fill="url(#lg-grad)" opacity="0.2"/>
            <path d="M5 35 C20 15, 45 15, 55 35 S80 55, 95 35" stroke="url(#lg-grad)" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="5"  cy="35" r="4" fill="#3b82f6"/>
            <circle cx="55" cy="35" r="4" fill="#22d3ee"/>
            <circle cx="95" cy="35" r="4" fill="#3b82f6"/>
          </svg>
          <div>
            <h1 className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent leading-none">FLUXO</h1>
            <p className="text-sm text-white/60 tracking-wide mt-1">Gestione Fatture</p>
          </div>
        </div>
        <p className="text-sm text-white/50 mt-8">
          {mode === 'name' ? 'Inserisci nome e PIN per accedere' : 'Accesso amministratore'}
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">

        {mode === 'name' ? (
          /* ── OPERATORE: Nome + PIN a 4 cifre ── */
          <div className="space-y-5">

            {/* Nome */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nome</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Mario Rossi"
                value={name}
                onChange={e => { setName(e.target.value); setSedeNome(null); setNameReady(false); resolvedEmail.current = null }}
                onBlur={() => lookupSede(name)}
                className={inputCls}
                autoFocus
                disabled={loading}
              />
              {/* Badge sede */}
              <div className="mt-2 h-6 flex items-center">
                {lookingUp && (
                  <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Ricerca sede…
                  </span>
                )}
                {!lookingUp && sedeNome && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                    {sedeNome}
                  </span>
                )}
                {!lookingUp && !sedeNome && name.trim().length > 1 && !nameReady && (
                  <span className="text-xs text-gray-400">Inserisci il tuo nome completo e premi Tab</span>
                )}
              </div>
            </div>

            {/* PIN a 4 caselle */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-3">
                PIN
                <span className="ml-1.5 font-normal text-gray-400">(4 cifre)</span>
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
                        ? 'border-gray-100 bg-gray-50 text-gray-300'
                        : pin[idx]
                          ? 'border-[#1a3050] bg-[#1a3050]/5 text-[#1a3050]'
                          : nameReady
                            ? 'border-gray-200 bg-white focus:border-[#1a3050]'
                            : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed',
                    ].join(' ')}
                  />
                ))}
              </div>

              {/* Indicatore auto-login */}
              {pinFilled && !loading && (
                <p className="text-center text-xs text-blue-500 mt-3 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Accesso in corso…
                </p>
              )}
              {loading && (
                <p className="text-center text-xs text-blue-500 mt-3 flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Verifica credenziali…
                </p>
              )}
            </div>

            {message && <FeedbackMsg msg={message} />}
          </div>

        ) : (
          /* ── ADMIN: Email + Password ── */
          <form onSubmit={e => { e.preventDefault(); handleLoginByEmail() }} className="space-y-4">

            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
              <input
                type="email" autoComplete="email" placeholder="admin@azienda.it"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                className={inputCls} autoFocus
              />
              {showSugg && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden text-sm">
                  {suggestions.map(s => {
                    const at = s.indexOf('@')
                    return (
                      <li key={s}>
                        <button type="button" onMouseDown={() => { setEmail(s); setSuggestions([]); setShowSugg(false) }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-1">
                          <span className="text-gray-400">{s.slice(0, at + 1)}</span>
                          <span className="text-gray-800 font-medium">{s.slice(at + 1)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="Minimo 6 caratteri" value={adminPw}
                  onChange={e => setAdminPw(e.target.value)} className={inputCls + ' pr-11'}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
              className="w-full py-3 bg-[#1a3050] hover:bg-[#122238] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
              }
              Accedi
            </button>
          </form>
        )}
      </div>

      {/* Toggle admin (discreto) */}
      <div className="text-center mt-5">
        {mode === 'name' ? (
          <button type="button" onClick={() => { setMode('admin'); setMessage(null) }}
            className="text-[11px] text-white/25 hover:text-white/50 transition-colors">
            Accesso amministratore →
          </button>
        ) : (
          <button type="button" onClick={() => { setMode('name'); setMessage(null) }}
            className="text-[11px] text-white/25 hover:text-white/50 transition-colors">
            ← Accesso operatore
          </button>
        )}
      </div>
    </div>
  )
}

function FeedbackMsg({ msg }: { msg: Message }) {
  return (
    <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
      msg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'
    }`}>
      {msg.type === 'error'
        ? <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        : <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      }
      {msg.text}
    </div>
  )
}
