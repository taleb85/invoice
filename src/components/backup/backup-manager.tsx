'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BackupDate } from '@/app/api/backup/list/route'

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

function nextMonday2am(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0 Sun, 1 Mon
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7
  const next = new Date(now)
  next.setUTCDate(now.getUTCDate() + daysUntilMonday)
  next.setUTCHours(2, 0, 0, 0)
  return next.toLocaleString('it-IT', {
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
  const [backups, setBackups] = useState<BackupDate[]>([])
  const [history, setHistory] = useState<BackupHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, histRes] = await Promise.all([
        fetch('/api/backup/list'),
        fetch('/api/activity-log?action=backup.completed&limit=10'),
      ])
      if (listRes.ok) {
        const { backups: b } = await listRes.json() as { backups: BackupDate[] }
        setBackups(b ?? [])
        if (b?.length > 0) setExpanded(b[0].date)
      }
      if (histRes.ok) {
        const json = await histRes.json() as { activities?: Array<{ id: string; createdAt: string; entityLabel: string | null; metadata: BackupHistoryEntry['metadata'] }> }
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
      const res = await fetch('/api/cron/backup', {
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

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-app-line-5 p-4">
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

        <div className="rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-app-line-5 p-4">
          <p className="text-xs text-app-fg-muted">Prossimo backup</p>
          <p className="mt-1 text-sm font-semibold text-app-fg">{nextMonday2am()}</p>
          <p className="text-xs text-app-fg-muted">Ogni lunedì alle 02:00 UTC</p>
        </div>

        <div className="rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-app-line-5 p-4">
          <p className="text-xs text-app-fg-muted">Totale backup disponibili</p>
          <p className="mt-1 text-base font-semibold text-app-fg">{backups.length}</p>
          <p className="text-xs text-app-fg-muted">Archiviati in Supabase Storage</p>
        </div>
      </div>

      {/* Manual trigger */}
      <div className="flex flex-col gap-3 rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-app-line-5 p-4 sm:flex-row sm:items-center sm:justify-between">
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

      {/* Backup list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-app-fg">Backup disponibili</h2>

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

      {/* Backup history from activity_log */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-app-fg">Storico esecuzioni</h2>
          <div className="rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 bg-app-line-5 divide-y divide-app-line-15 overflow-hidden">
            {history.map((h) => (
              <div key={h.id} className="flex items-start justify-between px-4 py-3 gap-4">
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
        </div>
      )}
    </div>
  )
}
