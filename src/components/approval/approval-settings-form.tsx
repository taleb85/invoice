'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/use-t'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

type ApprovalSettings = {
  threshold: number
  require_approval: boolean
  auto_register_fatture: boolean
}

type Props = {
  sedeId: string
}

export function ApprovalSettingsForm({ sedeId }: Props) {
  const t = useT()
  const [settings, setSettings] = useState<ApprovalSettings>({
    threshold: 500,
    require_approval: true,
    auto_register_fatture: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/sedi/${sedeId}/approval-settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ApprovalSettings | null) => {
        if (d)
          setSettings({
            threshold: d.threshold ?? 500,
            require_approval: d.require_approval !== false,
            auto_register_fatture: d.auto_register_fatture === true,
          })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sedeId])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/sedi/${sedeId}/approval-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error ?? 'Errore salvataggio')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl bg-app-line-10" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-app-fg">{t.approvalSettings.autoRegisterTitle}</p>
          <p className="text-xs text-app-fg-muted">{t.approvalSettings.autoRegisterDescription}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.auto_register_fatture}
          onClick={() => setSettings((s) => ({ ...s, auto_register_fatture: !s.auto_register_fatture }))}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/40 ${
            settings.auto_register_fatture ? 'bg-emerald-600' : 'bg-app-line-30'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              settings.auto_register_fatture ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-app-fg">Richiedi approvazione</p>
          <p className="text-xs text-app-fg-muted">
            Le fatture sopra soglia richiedono approvazione admin
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.require_approval}
          onClick={() => setSettings((s) => ({ ...s, require_approval: !s.require_approval }))}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/40 ${
            settings.require_approval ? 'bg-[#22d3ee]' : 'bg-app-line-30'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              settings.require_approval ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Threshold input */}
      {settings.require_approval && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-app-fg-muted">
            Soglia importo (£)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-app-fg-muted">£</span>
            <input
              type="number"
              min={0}
              step={50}
              value={settings.threshold}
              onChange={(e) =>
                setSettings((s) => ({ ...s, threshold: Math.max(0, Number(e.target.value)) }))
              }
              className="w-32 rounded-xl border border-app-line-28 bg-transparent px-3 py-2 text-sm font-semibold tabular-nums text-app-fg focus:border-[#22d3ee]/50 focus:outline-none focus:ring-2 focus:ring-[#22d3ee]/20"
            />
          </div>
          <p className="text-[11px] text-app-fg-muted">
            Fatture con importo ≥ £{settings.threshold} richiederanno approvazione
          </p>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#0a192f] transition-colors hover:bg-[#06b6d4] disabled:opacity-50"
        >
          {saving && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a192f] border-t-transparent" />
          )}
          {saving ? 'Salvataggio...' : 'Salva impostazioni'}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <svg className={`h-3.5 w-3.5 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Salvato
          </span>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  )
}
