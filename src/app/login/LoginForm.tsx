'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Message = { type: 'error' | 'success'; text: string }

const EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.it', 'live.com',
  'yahoo.com', 'yahoo.it',
  'icloud.com', 'me.com',
  'libero.it', 'virgilio.it', 'alice.it', 'tim.it',
  'tiscali.it', 'fastwebnet.it', 'aruba.it',
  'pec.it', 'legalmail.it',
  'proton.me', 'protonmail.com',
]

export default function LoginForm() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'name' | 'email'>('name')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'login' | 'signup' | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [sedeNome, setSedeNome] = useState<string | null>(null)
  const [lookingUpSede, setLookingUpSede] = useState(false)

  const handleEmailChange = (val: string) => {
    setEmail(val)
    const atIdx = val.indexOf('@')
    if (atIdx !== -1) {
      const afterAt = val.slice(atIdx + 1).toLowerCase()
      const local = val.slice(0, atIdx)
      const filtered = EMAIL_DOMAINS
        .filter((d) => d.startsWith(afterAt) && d !== afterAt)
        .map((d) => `${local}@${d}`)
      setSuggestions(filtered.slice(0, 6))
      setShowSuggestions(filtered.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const applySuggestion = (s: string) => {
    setEmail(s)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const lookupSede = async (n: string) => {
    if (!n.trim()) { setSedeNome(null); return }
    setLookingUpSede(true)
    const res = await fetch('/api/lookup-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n.trim() }),
    })
    const data = await res.json()
    setLookingUpSede(false)
    setSedeNome(res.ok ? (data.sede_nome ?? null) : null)
  }

  const handleLoginByName = async () => {
    if (!name.trim() || !password) return
    setLoading('login')
    setMessage(null)

    const res = await fetch('/api/lookup-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error ?? 'Errore durante il login.' })
      setLoading(null)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email: data.email, password })
    if (error) {
      setMessage({ type: 'error', text: 'PIN non corretto.' })
      setLoading(null)
      return
    }

    router.push('/')
    router.refresh()
  }

  const handleLoginByEmail = async () => {
    if (!email || !password) return
    setLoading('login')
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage({ type: 'error', text: 'Credenziali non valide. Controlla email e password.' })
      setLoading(null)
      return
    }

    router.push('/')
    router.refresh()
  }

  const handleSignup = async () => {
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'La password deve essere di almeno 6 caratteri.' })
      return
    }
    setLoading('signup')
    setMessage(null)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase().includes('already')
        ? 'Esiste già un account con questa email. Usa "Accedi" per entrare.'
        : `Errore durante la registrazione: ${signUpError.message}`
      setMessage({ type: 'error', text: msg })
      setLoading(null)
      return
    }

    if (data.session) {
      router.push('/')
      router.refresh()
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setMessage({
        type: 'success',
        text: 'Account creato! Controlla la tua email e clicca sul link di conferma, poi accedi.',
      })
      setLoading(null)
      return
    }

    router.push('/')
    router.refresh()
  }

  const inputCls =
    'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a3050] focus:border-transparent bg-white placeholder:text-gray-300 transition'

  const canSubmit = mode === 'name' ? !!name.trim() && !!password : !!email && !!password

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
            <path d="M5 35 C20 15, 45 15, 55 35 S80 55, 95 35"
                  stroke="url(#lg-grad)" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="5"  cy="35" r="4" fill="#3b82f6"/>
            <circle cx="55" cy="35" r="4" fill="#22d3ee"/>
            <circle cx="95" cy="35" r="4" fill="#3b82f6"/>
          </svg>
          <div className="flex flex-col">
            <h1 className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent leading-none">FLUXO</h1>
            <p className="text-sm text-white tracking-wide mt-1">Invoice Management</p>
          </div>
        </div>
        <p className="text-sm text-white/50 mt-8">
          {mode === 'name' ? 'Accedi con nome e PIN' : 'Accesso amministratore'}
        </p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">

        {mode === 'name' ? (
          /* ── ACCESSO OPERATORE: Nome + PIN ── */
          <form onSubmit={(e) => { e.preventDefault(); handleLoginByName() }}>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nome</label>
              <input
                type="text"
                autoComplete="name"
                placeholder="Mario Rossi"
                value={name}
                onChange={(e) => { setName(e.target.value); setSedeNome(null) }}
                onBlur={() => lookupSede(name)}
                className={inputCls}
                autoFocus
              />
              {/* Badge sede */}
              <div className="mt-2 h-6 flex items-center">
                {lookingUpSede && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Ricerca sede…
                  </span>
                )}
                {!lookingUpSede && sedeNome && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                    </svg>
                    {sedeNome}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">PIN</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="es. 1234"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls + ' pr-11'}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {message && <FeedbackMsg msg={message} />}

            <button
              type="submit"
              disabled={loading !== null || !canSubmit}
              className="mt-4 w-full py-3 bg-[#1a3050] hover:bg-[#122238] active:bg-[#0d1e35] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading === 'login' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              )}
              Accedi
            </button>
          </form>
        ) : (
          /* ── ACCESSO ADMIN: Email + Password ── */
          <form onSubmit={(e) => { e.preventDefault(); handleLoginByEmail() }}>
            <div className="relative">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="nome@azienda.it"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className={inputCls}
                autoFocus
              />
              {showSuggestions && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden text-sm">
                  {suggestions.map((s) => {
                    const atIdx = s.indexOf('@')
                    return (
                      <li key={s}>
                        <button
                          type="button"
                          onMouseDown={() => applySuggestion(s)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-1"
                        >
                          <span className="text-gray-400">{s.slice(0, atIdx + 1)}</span>
                          <span className="text-gray-800 font-medium">{s.slice(atIdx + 1)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Minimo 6 caratteri"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls + ' pr-11'}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {message && <FeedbackMsg msg={message} />}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading !== null || !canSubmit}
                className="flex-1 py-3 bg-[#1a3050] hover:bg-[#122238] active:bg-[#0d1e35] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading === 'login' ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                )}
                Accedi
              </button>
              <button
                type="button"
                onClick={handleSignup}
                disabled={loading !== null || !canSubmit}
                className="flex-1 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                {loading === 'signup' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <span className="truncate">Creazione...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Crea Account
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Toggle modalità */}
      <div className="text-center mt-4 space-y-1">
        {mode === 'name' ? (
          <button
            type="button"
            onClick={() => { setMode('email'); setMessage(null) }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
          >
            Sei un amministratore? Accedi con email
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('name'); setMessage(null) }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
          >
            ← Torna all&apos;accesso con nome
          </button>
        )}
      </div>
    </div>
  )
}

function FeedbackMsg({ msg }: { msg: { type: 'error' | 'success'; text: string } }) {
  return (
    <div
      className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl mt-3 ${
        msg.type === 'error'
          ? 'bg-red-50 text-red-600 border border-red-100'
          : 'bg-green-50 text-green-700 border border-green-100'
      }`}
    >
      {msg.type === 'error' ? (
        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {msg.text}
    </div>
  )
}
