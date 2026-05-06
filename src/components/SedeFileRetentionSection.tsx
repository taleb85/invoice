'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import type { SedeFileRetentionPolicy } from '@/types'
import {
  FILE_ATTACHMENT_RETENTION_DAYS,
  FILE_ATTACHMENT_RETENTION_UI_ENABLED,
} from '@/lib/file-retention-config'

function normalizePolicy(raw: string | null | undefined): SedeFileRetentionPolicy {
  if (raw === 'delete_only' || raw === 'archive_then_delete') return raw
  return 'keep'
}

type Props = {
  sedeId: string
  initialPolicy: string | null
  initialDays: number | null
  initialRunDay: number | null
  canEdit: boolean
}

export default function SedeFileRetentionSection({
  sedeId,
  initialPolicy,
  initialDays,
  initialRunDay,
  canEdit,
}: Props) {
  const { t } = useLocale()
  const router = useRouter()
  const s = t.sedi

  const [policy, setPolicy] = useState<SedeFileRetentionPolicy>(() => normalizePolicy(initialPolicy))
  const [days, setDays] = useState(() =>
    initialDays != null && Number.isFinite(initialDays) ? String(initialDays) : String(FILE_ATTACHMENT_RETENTION_DAYS),
  )
  const [runDay, setRunDay] = useState(() =>
    initialRunDay != null && Number.isFinite(initialRunDay) ? String(initialRunDay) : '',
  )
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<'ok' | 'err' | null>(null)

  useEffect(() => {
    setPolicy(normalizePolicy(initialPolicy))
    setDays(
      initialDays != null && Number.isFinite(initialDays)
        ? String(initialDays)
        : String(FILE_ATTACHMENT_RETENTION_DAYS),
    )
    setRunDay(initialRunDay != null && Number.isFinite(initialRunDay) ? String(initialRunDay) : '')
  }, [initialPolicy, initialDays, initialRunDay])

  const save = useCallback(async () => {
    if (!canEdit || !FILE_ATTACHMENT_RETENTION_UI_ENABLED) return
    setSaving(true)
    setFeedback(null)
    try {
      const payload: Record<string, unknown> = { file_retention_policy: policy }
      if (policy !== 'keep') {
        const d = Math.floor(Number(days))
        const clamped = Number.isNaN(d)
          ? FILE_ATTACHMENT_RETENTION_DAYS
          : Math.min(3650, Math.max(1, d))
        payload.file_retention_days = clamped
        const rd = runDay.trim()
        if (rd === '') {
          payload.file_retention_run_day = null
        } else {
          const n = Math.floor(Number(rd))
          payload.file_retention_run_day = Number.isNaN(n)
            ? null
            : Math.min(28, Math.max(1, n))
        }
      }
      const res = await fetch(`/api/sedi/${encodeURIComponent(sedeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'PATCH')
      setFeedback('ok')
      router.refresh()
    } catch {
      setFeedback('err')
    } finally {
      setSaving(false)
      window.setTimeout(() => setFeedback(null), 2800)
    }
  }, [canEdit, days, policy, runDay, router, sedeId])

  if (!FILE_ATTACHMENT_RETENTION_UI_ENABLED) return null

  const radioCls =
    'flex cursor-pointer items-start gap-3 rounded-lg border border-app-line-20 bg-black/10 px-3 py-2.5 transition-colors has-[:checked]:border-cyan-500/45 has-[:checked]:bg-cyan-500/10'
  const disabledCls = !canEdit ? 'cursor-not-allowed opacity-70' : ''

  return (
    <div className="app-card mb-6 flex flex-col overflow-hidden">
      <div className="space-y-4 px-5 py-4 app-workspace-inset-bg-soft sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-app-fg">{s.fileRetentionSectionTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{s.fileRetentionSectionHint}</p>
          </div>
          {canEdit ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex shrink-0 touch-manipulation items-center justify-center rounded-lg bg-app-cyan-500 px-4 py-2 text-xs font-bold text-cyan-950 shadow-sm transition-colors hover:bg-app-cyan-400 disabled:opacity-50"
            >
              {saving ? t.common.loading : s.saveConfig}
            </button>
          ) : null}
        </div>

        <fieldset disabled={!canEdit} className={`space-y-3 ${disabledCls}`}>
          <legend className="sr-only">{s.fileRetentionPolicyLabel}</legend>
          <p className="text-xs font-medium text-app-fg-muted">{s.fileRetentionPolicyLabel}</p>

          <label className={radioCls}>
            <input
              type="radio"
              name={`ret-pol-${sedeId}`}
              className="mt-1 shrink-0"
              checked={policy === 'keep'}
              onChange={() => setPolicy('keep')}
            />
            <span className="text-sm leading-snug text-app-fg">{s.fileRetentionKeep}</span>
          </label>

          <label className={radioCls}>
            <input
              type="radio"
              name={`ret-pol-${sedeId}`}
              className="mt-1 shrink-0"
              checked={policy === 'delete_only'}
              onChange={() => setPolicy('delete_only')}
            />
            <span className="text-sm leading-snug text-app-fg">{s.fileRetentionDeleteOnly}</span>
          </label>

          <label className={radioCls}>
            <input
              type="radio"
              name={`ret-pol-${sedeId}`}
              className="mt-1 shrink-0"
              checked={policy === 'archive_then_delete'}
              onChange={() => setPolicy('archive_then_delete')}
            />
            <span className="text-sm leading-snug text-app-fg">{s.fileRetentionArchiveThenDelete}</span>
          </label>
        </fieldset>

        {policy !== 'keep' ? (
          <div className="grid grid-cols-1 gap-4 border-t border-app-line-15 pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`ret-days-${sedeId}`} className="mb-1 block text-xs font-medium text-app-fg-muted">
                {s.fileRetentionMonthsLabel}
              </label>
              <input
                id={`ret-days-${sedeId}`}
                type="number"
                min={1}
                max={3650}
                disabled={!canEdit}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full rounded-lg border border-app-line-25 app-workspace-surface-elevated px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40 disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor={`ret-runday-${sedeId}`} className="mb-1 block text-xs font-medium text-app-fg-muted">
                {s.fileRetentionRunDayLabel}
              </label>
              <input
                id={`ret-runday-${sedeId}`}
                type="number"
                min={1}
                max={28}
                placeholder="—"
                disabled={!canEdit}
                value={runDay}
                onChange={(e) => setRunDay(e.target.value)}
                className="w-full rounded-lg border border-app-line-25 app-workspace-surface-elevated px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-app-line-40 disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-app-fg-muted">{s.fileRetentionRunDayHint}</p>
            </div>
          </div>
        ) : null}

        {feedback === 'ok' ? (
          <p className="text-xs font-medium text-emerald-300">{s.fileRetentionSaved}</p>
        ) : null}
        {feedback === 'err' ? (
          <p className="text-xs font-medium text-red-300">{t.common.error}</p>
        ) : null}
      </div>
    </div>
  )
}
