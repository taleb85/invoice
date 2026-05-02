'use client'

import { useEffect, useId, useMemo, useState } from 'react'
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
  const a = t.approvalSettings
  const autoHeadingId = useId()
  const approvalHeadingId = useId()
  const thresholdSectionId = useId()

  const [settings, setSettings] = useState<ApprovalSettings>({
    threshold: 500,
    require_approval: true,
    auto_register_fatture: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const thresholdHint = useMemo(
    () => a.thresholdHint.replace(/\{threshold\}/g, String(settings.threshold)),
    [a.thresholdHint, settings.threshold],
  )

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
        throw new Error(d.error ?? a.saveFailedFallback)
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

  const switchBase =
    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-cyan-500/40'

  return (
    <div className="overflow-hidden rounded-xl border border-app-line-28 bg-black/[0.12] ring-1 ring-white/[0.04]">
      <section
        aria-labelledby={autoHeadingId}
        className="p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-4 rounded-lg border border-app-line-28 bg-black/15 px-4 py-3.5 ring-1 ring-white/[0.04]">
          <div className="min-w-0 flex-1">
            <p id={autoHeadingId} className="text-sm font-semibold text-app-fg">
              {a.autoRegisterTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{a.autoRegisterDescription}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.auto_register_fatture}
            aria-labelledby={autoHeadingId}
            onClick={() => setSettings((s) => ({ ...s, auto_register_fatture: !s.auto_register_fatture }))}
            className={`${switchBase} ${
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
      </section>

      <section
        aria-labelledby={approvalHeadingId}
        className="border-t border-app-line-28 p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-4 rounded-lg border border-app-line-28 bg-black/15 px-4 py-3.5 ring-1 ring-white/[0.04]">
          <div className="min-w-0 flex-1">
            <p id={approvalHeadingId} className="text-sm font-semibold text-app-fg">
              {a.requireApprovalTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{a.requireApprovalDescription}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.require_approval}
            aria-labelledby={approvalHeadingId}
            aria-controls={settings.require_approval ? thresholdSectionId : undefined}
            onClick={() => setSettings((s) => ({ ...s, require_approval: !s.require_approval }))}
            className={`${switchBase} ${
              settings.require_approval ? 'bg-app-cyan-600' : 'bg-app-line-30'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.require_approval ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {settings.require_approval ? (
          <div
            id={thresholdSectionId}
            className="mt-4 rounded-lg border border-app-line-25 bg-black/[0.08] px-4 py-3.5 ring-1 ring-white/[0.03]"
          >
            <label className="block text-xs font-medium text-app-fg-muted">{a.thresholdLabel}</label>
            <div className="mt-2 flex max-w-[16rem] items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-app-fg-muted">£</span>
              <input
                type="number"
                min={0}
                step={50}
                value={settings.threshold}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, threshold: Math.max(0, Number(e.target.value)) }))
                }
                className="min-w-0 flex-1 rounded-lg border border-app-line-28 bg-black/25 px-3 py-2 text-sm font-semibold tabular-nums text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-app-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-app-cyan-500/25"
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-app-fg-muted">{thresholdHint}</p>
          </div>
        ) : null}
      </section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-app-line-28 px-4 py-3.5 sm:px-5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-app-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-app-cyan-500 disabled:opacity-50"
        >
          {saving ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : null}
          {saving ? a.savingSettings : a.saveSettings}
        </button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <svg className={`h-3.5 w-3.5 ${icon.success}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {a.savedSettings}
          </span>
        ) : null}
        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      </footer>
    </div>
  )
}
