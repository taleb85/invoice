'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function SedeLockPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sedeName, setSedeName] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('sede_id, role')
        .eq('id', user.id)
        .single()

      // Admin non ha bisogno del codice sede
      if (!profile || profile.role === 'admin') { router.push('/'); return }

      // Controlla se la sede ha un codice accesso
      if (!profile.sede_id) { router.push('/'); return }

      const { data: sede } = await supabase
        .from('sedi')
        .select('nome, access_password')
        .eq('id', profile.sede_id)
        .single()

      if (!sede?.access_password) {
        // Nessun codice richiesto
        router.push('/')
        return
      }

      // Controlla se già verificato (cookie)
      const verified = document.cookie.includes(`sede-verified=${profile.sede_id}`)
      if (verified) { router.push('/'); return }

      setSedeName(sede.nome ?? '')
      setChecking(false)
    }
    init()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('sede_id')
      .eq('id', user.id)
      .single()

    if (!profile?.sede_id) { router.push('/'); return }

    const { data: sede } = await supabase
      .from('sedi')
      .select('access_password')
      .eq('id', profile.sede_id)
      .single()

    if (sede?.access_password === code) {
      // Imposta cookie di sessione per la verifica (letto dal middleware)
      document.cookie = `sede-verified=${profile.sede_id}; path=/; SameSite=Strict`
      router.push('/')
    } else {
      setError('Codice non corretto. Riprova.')
      setCode('')
    }
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
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
