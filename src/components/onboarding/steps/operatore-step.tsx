'use client'

import { useRef, useState } from 'react'

type Props = {
  sedeId: string
  onComplete: (operatoreNome: string) => void
  onSkip: () => void
}

const PIN_LENGTH = 4

const inputCls =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-app-fg-subtle focus:border-[#22d3ee]/50 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/20 [color-scheme:dark]'
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-subtle'

export function OperatoreStep({ sedeId, onComplete, onSkip }: Props) {
  const [nome, setNome] = useState('')
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const pinValue = pin.join('')
  const canSubmit = nome.trim().length > 0 && pinValue.length === PIN_LENGTH

  function handlePinChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...pin]
    next[idx] = digit
    setPin(next)
    if (digit && idx < PIN_LENGTH - 1) {
      pinRefs.current[idx + 1]?.focus()
    }
  }

  function handlePinKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      const next = [...pin]
      next[idx - 1] = ''
      setPin(next)
      pinRefs.current[idx - 1]?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nome.trim().toUpperCase(),
          pin: pinValue,
          sedeId,
          role: 'operatore',
        }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Errore nella creazione')
      onComplete(nome.trim().toUpperCase())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className={labelCls}>Nome operatore *</label>
        <input
          className={inputCls}
          required
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
          placeholder="es. MARIO"
          autoFocus
          style={{ textTransform: 'uppercase' }}
        />
        <p className="mt-1 text-[11px] text-app-fg-subtle">Il nome appare nella schermata di selezione operatore</p>
      </div>

      <div>
        <label className={labelCls}>PIN (4 cifre) *</label>
        <div className="flex gap-3 justify-center">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <input
              key={i}
              ref={(el) => { pinRefs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={pin[i] ?? ''}
              onChange={(e) => handlePinChange(i, e.target.value)}
              onKeyDown={(e) => handlePinKeyDown(i, e)}
              className="h-14 w-14 rounded-xl border border-white/15 bg-white/5 text-center text-2xl font-bold text-white focus:border-[#22d3ee]/50 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/20 [color-scheme:dark]"
            />
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-app-fg-subtle">{"L'operatore userà questo PIN per accedere"}</p>
      </div>

      {error && (
        <p className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/10 px-4 py-2 text-sm text-rose-400">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={saving || !canSubmit}
          className="w-full rounded-xl bg-[#22d3ee] py-3 text-sm font-bold text-[#020617] transition hover:opacity-90 active:scale-[.98] disabled:opacity-50"
        >
          {saving ? 'Creazione…' : 'Crea operatore e continua →'}
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="w-full py-2 text-xs text-app-fg-subtle transition hover:text-app-fg-muted"
        >
          Salta questo passaggio
        </button>
      </div>
    </form>
  )
}
