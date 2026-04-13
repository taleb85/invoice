'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { useT } from '@/lib/use-t'

export default function SedeAddOperatorForm({
  sedeId,
  embedded = false,
}: {
  sedeId: string
  /** Scheda compatta (es. hub Impostazioni mobile) senza secondo `app-card`. */
  embedded?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const run = () => {
      if (typeof window === 'undefined' || window.location.hash !== '#sede-operatori') return
      window.setTimeout(() => {
        document.getElementById('sede-operatori')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    }
    run()
    window.addEventListener('hashchange', run)
    return () => window.removeEventListener('hashchange', run)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const n = name.trim()
    if (!n) {
      setError(t.sedi.operatorNameRequired)
      return
    }
    if (pin.length < 4) {
      setError(t.sedi.operatorPinTooShort)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, pin, sedeId, role: 'operatore' }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        setError(data.error ?? 'Errore')
        return
      }
      setSuccess(data.message ?? 'OK')
      setName('')
      setPin('')
      router.refresh()
    } catch {
      setError('Errore di rete.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-600/50 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40'

  const nameId = embedded ? 'imp-embedded-op-name' : 'sede-op-name'
  const pinId = embedded ? 'imp-embedded-op-pin' : 'sede-op-pin'

  const inner = (
    <>
      {error && <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      {success && (
        <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{success}</div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={
          embedded
            ? 'flex flex-col gap-3'
            : 'flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3'
        }
      >
        <div className={embedded ? 'w-full' : 'flex-1 min-w-[10rem]'}>
          <label htmlFor={nameId} className="mb-1 block text-xs font-medium text-slate-400">
            {t.sedi.operatorDisplayNameLabel}
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder={t.sedi.operatoreRole}
            disabled={loading}
          />
        </div>
        <div className={embedded ? 'w-full' : 'w-full sm:w-36'}>
          <label htmlFor={pinId} className="mb-1 block text-xs font-medium text-slate-400">
            {t.sedi.operatorPinMinLabel}
          </label>
          <input
            id={pinId}
            type="password"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className={inputCls}
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={
            embedded
              ? 'w-full touch-manipulation rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-60 active:scale-[0.99]'
              : 'w-full sm:w-auto px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors touch-manipulation'
          }
        >
          {loading ? t.sedi.creatingBtn : t.sedi.createBtn}
        </button>
      </form>
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-2">
        <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.sedi.addOperatorSedeTitle}</p>
        <p className="px-0.5 text-xs leading-snug text-slate-400">{t.sedi.addOperatorSedeDesc}</p>
        {inner}
      </div>
    )
  }

  return (
    <div className="app-card mb-8 p-5">
      <div className="app-card-bar mb-4" aria-hidden />
      <h2 className="text-sm font-semibold text-slate-100">{t.sedi.addOperatorSedeTitle}</h2>
      <p className="mb-4 mt-1 text-xs text-slate-400">{t.sedi.addOperatorSedeDesc}</p>
      {inner}
    </div>
  )
}
