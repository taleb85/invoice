'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import type { BackupDate } from '@/app/api/backup/list/route'
import type { Locale } from '@/lib/translations'
import { useLocale } from '@/lib/locale-context'
import { useT } from '@/lib/use-t'
import { SUMMARY_HIGHLIGHT_SURFACE_CLASS } from '@/lib/summary-highlight-accent'

type BackupHistoryEntry = {
  id: string
  createdAt: string
  entityLabel: string | null
  metadata: {
    tablesExported?: number
    results?: Record<string, { rows: number; path: string }>
    errors?: string[]
  } | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const LOCALE_TAG: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

function nextMonday2am(locale: Locale): string {
  const now = new Date()
  const day = now.getUTCDay() // 0 Sun, 1 Mon
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7
  const next = new Date(now)
  next.setUTCDate(now.getUTCDate() + daysUntilMonday)
  next.setUTCHours(2, 0, 0, 0)
  return next.toLocaleString(LOCALE_TAG[locale], {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

function tableLabel(name: string): string {
  const map: Record<string, string> = {
    'fatture.csv': 'Fatture',
    'bolle.csv': 'Bolle / DDT',
    'fornitori.csv': 'Fornitori',
    'sedi.csv': 'Sedi',
    'price_anomalies.csv': 'Anomalie Prezzi',
  }
  return map[name] ?? name.replace('.csv', '')
}

export function BackupManager() {
  const t = useT()
  const { locale } = useLocale()
  const b = t.appStrings
  const cronAutomationHeadingId = useId()

  const [backups, setBackups] = useState<BackupDate[]>([])
  const [history, setHistory] = useState<BackupHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [cronAutomationEnabled, setCronAutomationEnabled] = useState(true)
  const [cronAutomationSaving, setCronAutomationSaving] = useState(false)
  const [cronAutomationError, setCronAutomationError] = useState<string | null>(null)

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    try {
      const [autoRes, listRes, histRes] = await Promise.all([
        fetch('/api/backup/automation'),
        fetch('/api/backup/list'),
        fetch('/api/activity-log?action=backup.completed&limit=10'),
      ])
      if (autoRes.ok) {
        const j = (await autoRes.json()) as { enabled?: boolean }
        if (typeof j.enabled === 'boolean') setCronAutomationEnabled(j.enabled)
      }
      if (listRes.ok) {
        const { backups: bRows } = (await listRes.json()) as { backups: BackupDate[] }
        setBackups(bRows ?? [])
        if (bRows?.length > 0) setExpanded(bRows[0].date)
      }
      if (histRes.ok) {
        const json = (await histRes.json()) as {
          activities?: Array<{
            id: string
            createdAt: string
            entityLabel: string | null
            metadata: BackupHistoryEntry['metadata']
          }>
        }
        setHistory(json.activities ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBackups()
  }, [fetchBackups])

  async function runBackupNow() {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/cron/backup?force=1', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? ''}` },
      })
      if (res.ok) {
        const json = await res.json() as { totalTables: number; errors?: string[] }
        const msg =
          (json.errors?.length ?? 0) > 0
            ? `${json.totalTables} tabelle esportate con ${json.errors!.length} errori`
            : `${json.totalTables} tabelle esportate con successo`
        setRunResult({ ok: (json.errors?.length ?? 0) === 0, message: msg })
        await fetchBackups()
      } else {
        setRunResult({ ok: false, message: 'Backup fallito — controlla CRON_SECRET' })
      }
    } catch {
      setRunResult({ ok: false, message: 'Errore di rete' })
    } finally {
      setRunning(false)
    }
  }

  async function downloadFile(path: string, name: string) {
    setDownloading(path)
    try {
      const res = await fetch(`/api/backup/download?path=${encodeURIComponent(path)}`)
      if (!res.ok) return
      const { url } = await res.json() as { url: string }
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
    } finally {
      setDownloading(null)
    }
  }

  const lastBackup = backups[0]

  async function persistCronAutomation(enabled: boolean) {
    setCronAutomationSaving(true)
    setCronAutomationError(null)
    try {
      const res = await fetch('/api/backup/automation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error('save')
      const j = (await res.json()) as { enabled?: boolean }
      if (typeof j.enabled === 'boolean') setCronAutomationEnabled(j.enabled)
    } catch {
      setCronAutomationError(b.backupCronSaveError)
    } finally {
      setCronAutomationSaving(false)
    }
  }

  const switchFocus =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-app-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'

  return (
    <div className="space-y-6">
      <section
        className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} flex flex-col border-app-line-35 p-0`}
        aria-label="Stato e pianificazione backup"
      >
        <div className="border-b border-app-line-22 px-4 py-3">
          <h2 className="text-sm font-semibold text-app-fg">Stato e pianificazione</h2>
        </div>

        <div className="space-y-4 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-app-line-28 bg-app-line-5 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p id={cronAutomationHeadingId} className="text-sm font-semibold text-app-fg">
                {b.backupCronAutomationLabel}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{b.backupCronAutomationHint}</p>
              {cronAutomationError ? (
                <p className="mt-2 text-xs font-medium text-red-400">{cronAutomationError}</p>
              ) : null}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cronAutomationEnabled}
              aria-labelledby={cronAutomationHeadingId}
              disabled={cronAutomationSaving || loading}
              onClick={() => void persistCronAutomation(!cronAutomationEnabled)}
              className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 ${switchFocus} ${
                cronAutomationEnabled
                  ? 'bg-app-cyan-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-app-cyan-400/35'
                  : 'bg-app-line-30 ring-1 ring-white/[0.08]'
              }`}
            >
              <span
                className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                  cronAutomationEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
                aria-hidden
              />
            </button>
          </div>
          {cronAutomationSaving ? (
            <p className="text-xs text-app-fg-muted">{b.backupCronSaving}</p>
          ) : null}

          {/* Status bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-app-line-28 bg-app-line-5 p-4">
              <p className="text-xs text-app-fg-muted">Ultimo backup</p>
              <p className="mt-1 text-base font-semibold text-app-fg">
                {lastBackup ? lastBackup.date : 'Nessuno'}
              </p>
              {lastBackup && (
                <p className="text-xs text-app-fg-muted">
                  {lastBackup.files.length} file
                </p>
              )}
            </div>

            <div className="rounded-lg border border-app-line-28 bg-app-line-5 p-4">
              <p className="text-xs text-app-fg-muted">Prossimo backup</p>
              <p className="mt-1 text-sm font-semibold text-app-fg">
                {cronAutomationEnabled ? nextMonday2am(locale) : b.backupCronNextPaused}
              </p>
              <p className="text-xs text-app-fg-muted">{b.backupCronScheduleFootnote}</p>
            </div>

            <div className="rounded-lg border border-app-line-28 bg-app-line-5 p-4">
              <p className="text-xs text-app-fg-muted">Totale backup disponibili</p>
              <p className="mt-1 text-base font-semibold text-app-fg">{backups.length}</p>
              <p className="text-xs text-app-fg-muted">Archiviati in Supabase Storage</p>
            </div>
          </div>

          {/* Manual trigger */}
          <div className="flex flex-col gap-3 rounded-lg border border-app-line-28 bg-app-line-5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-app-fg">Esegui backup manuale</p>
              <p className="text-xs text-app-fg-muted">
                Esporta subito tutte le tabelle critiche in CSV
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runBackupNow()}
              disabled={running}
              className="flex items-center gap-2 rounded-xl bg-app-cyan-500 px-4 py-2 text-sm font-semibold text-[#0a192f] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {running ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0a192f] border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              )}
              {running ? 'Esecuzione…' : 'Esegui backup ora'}
            </button>
          </div>

          {runResult && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                runResult.ok
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {runResult.ok ? '✓ ' : '✗ '}{runResult.message}
            </div>
          )}
        </div>
      </section>

      {/* Backup list — stesso guscio strip/summary (`AppPageHeaderStrip`) */}
      <section
        className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} flex flex-col border-app-line-35 p-0`}
        aria-label="Backup disponibili"
      >
        <div className="border-b border-app-line-22 px-4 py-3">
          <h2 className="text-sm font-semibold text-app-fg">Backup disponibili</h2>
        </div>

        <div className="space-y-3 px-4 py-3">
          {loading && (
            <div className="flex items-center gap-2 py-6 text-app-fg-muted text-sm">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-app-cyan-500 border-t-transparent" />
              Caricamento…
            </div>
          )}

          {!loading && backups.length === 0 && (
            <p className="py-8 text-center text-sm text-app-fg-muted">
              Nessun backup disponibile. Esegui il primo backup manualmente.
            </p>
          )}

          {!loading && backups.map((b) => (
            <div key={b.date} className="rounded-2xl border border-app-line-20 bg-app-line-5 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === b.date ? null : b.date)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-app-line-10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="h-4 w-4 text-app-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-app-fg">{b.date}</p>
                    <p className="text-xs text-app-fg-muted">
                      {b.files.length} {b.files.length === 1 ? 'file' : 'file'} ·{' '}
                      {formatBytes(b.files.reduce((s, f) => s + f.size, 0))}
                    </p>
                  </div>
                </div>
                <svg
                  className={`h-4 w-4 text-app-fg-muted transition-transform ${
                    expanded === b.date ? 'rotate-180' : ''
                  }`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expanded === b.date && (
                <div className="divide-y divide-app-line-15 border-t border-app-line-15">
                  {b.files.map((f) => (
                    <div key={f.path} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="h-4 w-4 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm text-app-fg truncate">{tableLabel(f.name)}</p>
                          <p className="text-xs text-app-fg-muted">{formatBytes(f.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadFile(f.path, f.name)}
                        disabled={downloading === f.path}
                        className="ml-4 flex shrink-0 items-center gap-1.5 rounded-lg border border-app-line-20 bg-app-line-10 px-3 py-1.5 text-xs font-medium text-app-fg transition-colors hover:bg-app-line-20 disabled:opacity-50"
                      >
                        {downloading === f.path ? (
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                        Scarica
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Backup history from activity_log */}
      {history.length > 0 && (
        <section
          className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} flex flex-col border-app-line-35 p-0`}
          aria-label="Storico esecuzioni backup"
        >
          <div className="border-b border-app-line-22 px-4 py-3">
            <h2 className="text-sm font-semibold text-app-fg">Storico esecuzioni</h2>
          </div>
          <div className="divide-y divide-app-line-15 overflow-hidden">
            {history.map((h) => (
              <div key={h.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-app-fg">
                    {h.entityLabel ?? 'Backup'}
                  </p>
                  <p className="text-xs text-app-fg-muted">
                    {h.metadata?.tablesExported ?? 0} tabelle · {' '}
                    {(h.metadata?.errors?.length ?? 0) === 0 ? (
                      <span className="text-emerald-400">Successo</span>
                    ) : (
                      <span className="text-red-400">{h.metadata!.errors!.length} errori</span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-app-fg-muted">
                  {new Date(h.createdAt).toLocaleString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
