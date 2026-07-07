'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { useToast } from '@/lib/toast-context'
import type { SessionPolicyRecord } from '@/lib/session-policy-store'

// ── Format helpers ────────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

/** Parse a human duration string like "8h 30m" or "1800" back to seconds. */
function parseDurationInput(input: string): number | null {
  const trimmed = input.trim()
  // Plain number → seconds
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    return n > 0 ? n : null
  }
  // "Xh Ym" pattern
  const match = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/)
  if (!match) return null
  const h = match[1] ? Number(match[1]) : 0
  const m = match[2] ? Number(match[2]) : 0
  const total = h * 3600 + m * 60
  return total > 0 ? total : null
}

interface RoleFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  error?: string
}

function RoleField({ label, value, onChange, error }: RoleFieldProps) {
  const [draft, setDraft] = useState(formatDuration(value))
  const [localError, setLocalError] = useState<string | undefined>(error)

  useEffect(() => {
    setDraft(formatDuration(value))
    setLocalError(undefined)
  }, [value])

  const handleBlur = useCallback(() => {
    const parsed = parseDurationInput(draft)
    if (parsed === null) {
      setLocalError('Invalid format (es. 8h 30m o secondi)')
      setDraft(formatDuration(value))
      return
    }
    setLocalError(undefined)
    if (parsed !== value) onChange(parsed)
  }, [draft, value, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [],
  )

  const err = localError ?? error
  return (
    <div className="min-w-0">
      <label className="block text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{label}</label>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`mt-1 w-full rounded-lg border bg-app-bg px-2.5 py-1.5 text-xs font-mono tabular-nums text-app-fg outline-none transition-colors focus:ring-2 ${
          err ? 'border-rose-500/50 ring-rose-500/20' : 'border-app-line-22 hover:border-app-line-28 focus:border-sky-500/50 focus:ring-sky-500/20'
        }`}
      />
      {err && <p className="mt-0.5 text-[10px] text-rose-400">{err}</p>}
    </div>
  )
}

function RoleSection({
  roleLabel,
  maxAge,
  inactivity,
  onMaxAgeChange,
  onInactivityChange,
}: {
  roleLabel: string
  maxAge: number
  inactivity: number
  onMaxAgeChange: (v: number) => void
  onInactivityChange: (v: number) => void
}) {
  return (
    <div className="rounded-lg border border-app-line-15 bg-app-bg/50 p-3">
      <p className="mb-2 text-xs font-bold text-app-fg">{roleLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        <RoleField label="Durata max" value={maxAge} onChange={onMaxAgeChange} />
        <RoleField label="Inattività" value={inactivity} onChange={onInactivityChange} />
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SessionPolicyCard() {
  const t = useT()
  const { showToast } = useToast()
  const uid = useId()
  const toggleId = `imp-sessione-toggle-${uid}`
  const panelId = `imp-sessione-panel-${uid}`

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState<SessionPolicyRecord | null>(null)

  // Load current policy
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/session-policy')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}))
          console.warn('[SessionPolicyCard] fetch failed:', r.status, body)
          return null
        }
        return r.json() as Promise<SessionPolicyRecord>
      })
      .then((data) => {
        if (!cancelled) setPolicy(data)
      })
      .catch((e) => {
        console.warn('[SessionPolicyCard] fetch error:', e)
        if (!cancelled) setPolicy(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleSave = useCallback(async () => {
    if (!policy) return
    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      for (const role of ['operatore', 'admin', 'admin_sede'] as const) {
        const p = policy[role]
        const chiaviMap = {
          operatore:  { maxAge: 'sessione_operatore_max_age_seconds',  inactivity: 'sessione_operatore_inactivity_seconds' },
          admin:      { maxAge: 'sessione_admin_max_age_seconds',      inactivity: 'sessione_admin_inactivity_seconds' },
          admin_sede: { maxAge: 'sessione_admin_sede_max_age_seconds', inactivity: 'sessione_admin_sede_inactivity_seconds' },
        } as const
        payload[chiaviMap[role].maxAge] = String(p.maxAgeSeconds)
        payload[chiaviMap[role].inactivity] = String(p.inactivitySeconds)
      }

      const res = await fetch('/api/admin/session-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'save_failed' }))
        showToast(err.error ?? 'save_failed', 'error')
        return
      }

      const updated: SessionPolicyRecord = await res.json()
      setPolicy(updated)
      showToast('Session policy salvata', 'success')
    } catch {
      showToast('Errore di rete', 'error')
    } finally {
      setSaving(false)
    }
  }, [policy, showToast])

  const isDirty = policy !== null

  return (
    <div className="app-card min-h-0 min-w-0 overflow-hidden">
      <div className="app-workspace-inset-bg-soft p-5">
        <button
          type="button"
          id={toggleId}
          aria-expanded={drawerOpen}
          aria-controls={drawerOpen ? panelId : undefined}
          onClick={() => setDrawerOpen((v) => !v)}
          className="flex w-full min-w-0 touch-manipulation items-start gap-4 rounded-xl text-left outline-none ring-app-cyan-500/40 transition hover:bg-black/[0.06] focus-visible:ring-2"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 ring-1 ring-sky-500/25">
            <svg className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Session Policy</p>
            <p className="mt-1 text-xs leading-snug text-app-fg-muted">
              Gestisci i timeout di sessione e inattività per ogni ruolo (operatore, admin, admin sede)
            </p>
            {!drawerOpen && policy ? (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-app-fg-muted">
                <span>Operatore: {formatDuration(policy.operatore.maxAgeSeconds)} max, {formatDuration(policy.operatore.inactivitySeconds)} inatt.</span>
                <span>Admin: {formatDuration(policy.admin.maxAgeSeconds)} max, {formatDuration(policy.admin.inactivitySeconds)} inatt.</span>
              </div>
            ) : null}
          </div>
          <svg
            className={`mt-2 h-5 w-5 shrink-0 text-app-fg-muted transition-transform duration-200 ${drawerOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {drawerOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label="Session Policy"
          className="border-t border-app-line-30 app-workspace-inset-bg-soft p-4 sm:p-5"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-4 w-4 animate-spin text-app-fg-muted" />
              <span className="text-xs text-app-fg-muted">{t.common.loading ?? 'Caricamento...'}</span>
            </div>
          ) : !policy ? (
            <p className="text-xs text-rose-400">Impossibile caricare la session policy</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <RoleSection
                  roleLabel="Operatore"
                  maxAge={policy.operatore.maxAgeSeconds}
                  inactivity={policy.operatore.inactivitySeconds}
                  onMaxAgeChange={(v) => setPolicy((p) => p ? { ...p, operatore: { ...p.operatore, maxAgeSeconds: v } } : p)}
                  onInactivityChange={(v) => setPolicy((p) => p ? { ...p, operatore: { ...p.operatore, inactivitySeconds: v } } : p)}
                />
                <RoleSection
                  roleLabel="Admin"
                  maxAge={policy.admin.maxAgeSeconds}
                  inactivity={policy.admin.inactivitySeconds}
                  onMaxAgeChange={(v) => setPolicy((p) => p ? { ...p, admin: { ...p.admin, maxAgeSeconds: v } } : p)}
                  onInactivityChange={(v) => setPolicy((p) => p ? { ...p, admin: { ...p.admin, inactivitySeconds: v } } : p)}
                />
                <RoleSection
                  roleLabel="Admin Sede"
                  maxAge={policy.admin_sede.maxAgeSeconds}
                  inactivity={policy.admin_sede.inactivitySeconds}
                  onMaxAgeChange={(v) => setPolicy((p) => p ? { ...p, admin_sede: { ...p.admin_sede, maxAgeSeconds: v } } : p)}
                  onInactivityChange={(v) => setPolicy((p) => p ? { ...p, admin_sede: { ...p.admin_sede, inactivitySeconds: v } } : p)}
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                {isDirty && (
                  <span className="text-[10px] text-app-fg-muted">
                    I valori si scrivono in secondi o formato breve (es. 8h 30m)
                  </span>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    'Salva'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
