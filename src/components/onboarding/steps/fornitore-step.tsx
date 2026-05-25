'use client'

import { useState } from 'react'
import { VatLookupField } from '@/components/vat-lookup-field'
import { useT } from '@/lib/use-t'

type Props = {
  sedeId: string
  onComplete: (fornitoreId: string, fornitoreNome: string) => void
  onSkip: () => void
}

const inputCls =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-app-fg-subtle focus:border-[#22d3ee]/50 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/20 [color-scheme:dark]'
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-subtle'

export function FornitoreStep({ sedeId, onComplete, onSkip }: Props) {
  const t = useT()
  const [form, setForm] = useState({ nome: '', email: '', piva: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/fornitori', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          email: form.email.trim() || null,
          piva: form.piva.trim() || null,
          sede_id: sedeId,
        }),
      })
      const data = await res.json() as { id?: string; nome?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? t.onboarding.fornitoreCreateError)
      onComplete(data.id!, data.nome ?? form.nome.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unknownError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelCls}>{t.onboarding.fornitoreVatLabel}</label>
        <VatLookupField
          value={form.piva}
          onChange={(val) => setForm({ ...form, piva: val })}
          onFound={(data) =>
            setForm((prev) => ({
              ...prev,
              nome: data.ragione_sociale ?? prev.nome,
            }))
          }
          inputClassName={inputCls}
          placeholder="01234567890"
        />
        <p className="mt-1 text-[11px] text-app-fg-subtle">{t.onboarding.fornitoreVatHint}</p>
      </div>

      <div>
        <label className={labelCls}>{t.onboarding.fornitoreNomeLabel}</label>
        <input
          className={inputCls}
          required
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder={t.onboarding.fornitoreNomePlaceholder}
          autoFocus
        />
      </div>

      <div>
        <label className={labelCls}>{t.onboarding.fornitoreEmailLabel}</label>
        <input
          className={inputCls}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={t.onboarding.fornitoreEmailPlaceholder}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/10 px-4 py-2 text-sm text-rose-400">{error}</p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={saving || !form.nome.trim()}
          className="w-full rounded-xl bg-[#22d3ee] py-3 text-sm font-bold text-[#020617] transition hover:opacity-90 active:scale-[.98] disabled:opacity-50"
        >
          {saving ? t.onboarding.emailSaving : t.onboarding.fornitoreCreateCta}
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="w-full py-2 text-xs text-app-fg-subtle transition hover:text-app-fg-muted"
        >
          {t.onboarding.skipStep}
        </button>
      </div>
    </form>
  )
}
