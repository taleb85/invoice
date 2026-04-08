'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Message = { type: 'error' | 'success'; text: string }

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<'login' | 'signup' | null>(null)
  const [message, setMessage] = useState<Message | null>(null)

  const handleLogin = async () => {
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

    // Passo 1: registrazione
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase().includes('already')
        ? 'Esiste già un account con questa email. Usa "Accedi" per entrare.'
        : `Errore durante la registrazione: ${signUpError.message}`
      setMessage({ type: 'error', text: msg })
      setLoading(null)
      return
    }

    // Passo 2: se Supabase ha già creato la sessione (email confirmation disabilitata) → redirect diretto
    if (data.session) {
      router.push('/')
      router.refresh()
      return
    }

    // Passo 3: email confirmation abilitata → login automatico dopo signup
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      // Signup riuscito ma login automatico fallito (es. email non ancora confermata)
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  const inputCls =
    'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a3050] focus:border-transparent bg-white placeholder:text-gray-300 transition'

  return (
    <div className="min-h-screen bg-[#1a3050] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 -mt-8">
          {/* Icona + testo affiancati */}
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" className="w-24 h-14 shrink-0">
              <defs>
                <linearGradient id="lg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              <rect x="25" y="5" width="50" height="50" rx="12" fill="url(#lg-grad)" opacity="0.2"/>
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
          <p className="text-sm text-white/50 mt-8">Accedi o crea il tuo account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="nome@azienda.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputCls}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Minimo 6 caratteri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputCls}
            />
          </div>

          {/* Messaggio feedback */}
          {message && (
            <div
              className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-600 border border-red-100'
                  : 'bg-green-50 text-green-700 border border-green-100'
              }`}
            >
              {message.type === 'error' ? (
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {message.text}
            </div>
          )}

          {/* Pulsanti */}
          <div className="flex gap-3 pt-1">
            {/* Accedi */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading !== null || !email || !password}
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

            {/* Crea Account */}
            <button
              type="button"
              onClick={handleSignup}
              disabled={loading !== null || !email || !password}
              className="flex-1 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              {loading === 'signup' ? (
                <>
                  <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="truncate">Creazione profilo...</span>
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
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Accesso riservato agli amministratori
        </p>
      </div>
    </div>
  )
}
