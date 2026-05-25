'use client'

import { useMemo, useState } from 'react'
import { useT } from '@/lib/use-t'
import type { Translations } from '@/lib/translations'

type CountryOption = {
  code: string
  label: string
  currency: string
  timezone: string
}

function buildCountries(t: Translations): CountryOption[] {
  return [
    { code: 'IT', label: t.onboarding.sedeCountryItaly, currency: 'EUR', timezone: 'Europe/Rome' },
    { code: 'GB', label: t.onboarding.sedeCountryUk, currency: 'GBP', timezone: 'Europe/London' },
    { code: 'ES', label: t.onboarding.sedeCountrySpain, currency: 'EUR', timezone: 'Europe/Madrid' },
    { code: 'FR', label: t.onboarding.sedeCountryFrance, currency: 'EUR', timezone: 'Europe/Paris' },
    { code: 'DE', label: t.onboarding.sedeCountryGermany, currency: 'EUR', timezone: 'Europe/Berlin' },
  ]
}

type Props = {
  onComplete: (sedeId: string, sedeNome: string) => void
}

const inputCls =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-app-fg-subtle focus:border-[#22d3ee]/50 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/20 [color-scheme:dark]'
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-subtle'

export function SedeStep({ onComplete }: Props) {
  const t = useT()
  const COUNTRIES = useMemo(() => buildCountries(t), [t])
  const [nome, setNome] = useState('')
  const [country, setCountry] = useState<CountryOption>(COUNTRIES[0]!)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sedi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          country_code: country.code,
          currency: country.currency,
          timezone: country.timezone,
        }),
      })
      const data = await res.json() as { ok?: boolean; sede?: { id: string; nome: string }; error?: string }
      if (!res.ok) throw new Error(data.error ?? t.onboarding.sedeCreateError)
      onComplete(data.sede!.id, data.sede!.nome)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.unknownError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelCls}>{t.onboarding.sedeNameLabel}</label>
        <input
          className={inputCls}
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t.onboarding.sedeNamePlaceholder}
          autoFocus
        />
      </div>

      <div>
        <label className={labelCls}>{t.onboarding.sedeCountryLabel}</label>
        <select
          value={country.code}
          onChange={(e) => {
            const found = COUNTRIES.find((c) => c.code === e.target.value)
            if (found) setCountry(found)
          }}
          className={inputCls}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t.onboarding.sedeCurrencyLabel}</label>
          <input className={`${inputCls} cursor-not-allowed opacity-60`} value={country.currency} readOnly />
        </div>
        <div>
          <label className={labelCls}>{t.onboarding.sedeTimezoneLabel}</label>
          <input className={`${inputCls} cursor-not-allowed opacity-60`} value={country.timezone} readOnly />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/10 px-4 py-2 text-sm text-rose-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving || !nome.trim()}
        className="w-full rounded-xl bg-[#22d3ee] py-3 text-sm font-bold text-[#020617] transition hover:opacity-90 active:scale-[.98] disabled:opacity-50"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#020617] border-t-transparent" />
            {t.onboarding.sedeCreating}
          </span>
        ) : (
          t.onboarding.sedeCreateCta
        )}
      </button>
    </form>
  )
}
