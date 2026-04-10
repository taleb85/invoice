'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SedeLockPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sedeName, setSedeName] = useState('')
  const [sedeId, setSedeId] = useState('')
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
        setSedeId(data.sede_id)
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

    const res = await fetch('/api/sede-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Codice non corretto. Riprova.')
      setCode('')
      setLoading(false)
      return
    }

    document.cookie = `sede-verified=${data.sede_id}; path=/; Max-Age=86400; SameSite=Strict`
    router.replace('/')
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (fatalError) {
    return (
      <div className="min-h-screen bg-[#1a3050] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
          <p className="text-sm text-red-500 font-medium">{fatalError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-[#1a3050] text-white text-sm font-semibold rounded-lg"
          >
            Ricarica
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a3050] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Accesso protetto</h1>
          <p className="text-sm text-white/50 mt-1 text-center">
            La sede <strong className="text-white/70">{sedeName}</strong> richiede un codice di accesso
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Codice accesso</label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3050] bg-white"
            />
            {error && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !code}
            className="w-full py-2.5 bg-[#1a3050] hover:bg-[#122238] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Verifica…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  )
}
