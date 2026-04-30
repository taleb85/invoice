'use client'

import { useState } from 'react'

type Props = {
  sedeId: string
  onComplete: () => void
  onSkip: () => void
}

const inputCls =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-app-fg-subtle focus:border-[#22d3ee]/50 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/20 [color-scheme:dark]'
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-subtle'

export function EmailStep({ sedeId, onComplete, onSkip }: Props) {
  const [form, setForm] = useState({
    host: '',
    port: '993',
    user: '',
    password: '',
  })
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTest() {
    setTestStatus('testing')
    setTestMessage(null)
    try {
      const res = await fetch('/api/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: form.host,
          port: Number(form.port) || 993,
          user: form.user,
          password: form.password,
        }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (!res.ok) {
        setTestStatus('error')
        setTestMessage(data.error ?? 'Connessione fallita')
      } else {
        setTestStatus('ok')
        setTestMessage(data.message ?? 'Connessione riuscita!')
      }
    } catch {
      setTestStatus('error')
      setTestMessage('Impossibile raggiungere il server IMAP')
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sedi/${sedeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imap_host: form.host || null,
          imap_port: Number(form.port) || 993,
          imap_user: form.user || null,
          imap_password: form.password || null,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Errore nel salvataggio')
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSaving(false)
    }
  }

  const canTest = form.host.trim() && form.user.trim() && form.password.trim()

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className={labelCls}>Server IMAP</label>
        <input
          className={inputCls}
          value={form.host}
          onChange={(e) => setForm({ ...form, host: e.target.value })}
          placeholder="imap.gmail.com"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>Username / Email</label>
          <input
            className={inputCls}
            type="email"
            value={form.user}
            onChange={(e) => setForm({ ...form, user: e.target.value })}
            placeholder="fatture@tuaazienda.it"
          />
        </div>
        <div>
          <label className={labelCls}>Porta</label>
          <input
            className={inputCls}
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: e.target.value })}
            placeholder="993"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Password / App Password</label>
        <input
          className={inputCls}
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="••••••••••••"
          autoComplete="new-password"
        />
      </div>

      {/* Test result */}
      {testStatus !== 'idle' && testMessage && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm ${
          testStatus === 'ok'
            ? 'border-[rgba(34,211,238,0.15)] bg-emerald-500/10 text-emerald-400'
            : testStatus === 'error'
              ? 'border-[rgba(34,211,238,0.15)] bg-rose-500/10 text-rose-400'
              : 'border-white/10 bg-white/5 text-app-fg-muted'
        }`}>
          {testStatus === 'testing' && (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Test in corso…
            </span>
          )}
          {testStatus !== 'testing' && testMessage}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/10 px-4 py-2 text-sm text-rose-400">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={!canTest || testStatus === 'testing'}
          className="w-full rounded-xl border border-[#22d3ee]/30 py-2.5 text-sm font-semibold text-[#22d3ee] transition hover:bg-[#22d3ee]/10 disabled:opacity-40"
        >
          {testStatus === 'testing' ? 'Test in corso…' : 'Testa connessione'}
        </button>

        <button
          type="submit"
          disabled={saving || !canTest}
          className="w-full rounded-xl bg-[#22d3ee] py-3 text-sm font-bold text-[#020617] transition hover:opacity-90 active:scale-[.98] disabled:opacity-50"
        >
          {saving ? 'Salvataggio…' : 'Salva e continua →'}
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
