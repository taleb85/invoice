'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Locale as DateFnsLocale } from 'date-fns'
import { it as itLocale, enUS, es, fr, de } from 'date-fns/locale'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

interface EmailUpdate {
  prodotto: string
  email_date: string
  email_subject: string | null
  is_matched: boolean
}


interface SyncStatus {
  last_sync_at: string | null
  total_emails_scanned: number
  total_products_found: number
  matched_count: number
  unmatched_count: number
  recent_updates: EmailUpdate[]
  new_suppliers_found: Array<{ supplier_name: string; email_count: number; first_seen: string }>
  imap_configured: boolean
}

const DATE_FNS_LOCALES: Record<string, DateFnsLocale> = {
  it: itLocale, en: enUS, es, fr, de,
}

export default function StatoSincronizzazioneIntelligente({
  fornitoreId,
  fornitoreNome,
  sedeId,
}: {
  fornitoreId: string
  fornitoreNome: string
  sedeId: string | null | undefined
}) {
  type SyncPhase = 'queued' | 'connect' | 'search' | 'process' | 'persist' | 'done' | 'error'
  type SyncLog   = { phase: SyncPhase; label: string; percent: number }

  const t = useT()
  const { locale } = useLocale()
  const dateFnsLocale = DATE_FNS_LOCALES[locale] ?? enUS

  const PHASE_LABEL = useCallback((phase: SyncPhase): string => {
    const map: Record<SyncPhase, string> = {
      queued:  t.appStrings.rekkiPhaseQueued,
      connect: t.appStrings.rekkiPhaseConnect,
      search:  t.appStrings.rekkiPhaseSearch,
      process: t.appStrings.rekkiPhaseProcess,
      persist: t.appStrings.rekkiPhasePersist,
      done:    t.appStrings.rekkiPhaseDone,
      error:   t.appStrings.rekkiPhaseError,
    }
    return map[phase] ?? phase
  }, [t])

  const [status, setStatus]             = useState<SyncStatus | null>(null)
  const [loading, setLoading]           = useState(true)
  const [syncing, setSyncing]           = useState(false)
  const [syncLog, setSyncLog]           = useState<SyncLog[]>([])
  const [syncPercent, setSyncPercent]   = useState(0)
  const [syncResult, setSyncResult]     = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [lookbackDays, setLookbackDays] = useState(30)

  const abortRef   = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/rekki/sync-status?fornitore_id=${fornitoreId}`, {
        credentials: 'include',
        signal,
      })
      if (res.ok && mountedRef.current) {
        const data = await res.json()
        setStatus(data.status)
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') console.error('[SYNC-STATUS]', err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [fornitoreId])

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (mountedRef.current) {
      setSyncing(false)
      setSyncLog([])
      setSyncPercent(0)
      setSyncResult(null)
      setError(null)
    }
  }, [fornitoreId])

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    loadStatus(ac.signal)
    const interval = setInterval(() => {
      if (!ac.signal.aborted) loadStatus(ac.signal)
    }, 30000)
    return () => { ac.abort(); clearInterval(interval) }
  }, [loadStatus])

  const handleSync = async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setSyncing(true)
    setError(null)
    setSyncResult(null)
    setSyncLog([])
    setSyncPercent(0)

    try {
      const payload: Record<string, unknown> = {
        fornitore_id: fornitoreId,
        email_sync_scope: 'lookback',
        email_sync_lookback_days: lookbackDays,
        mode: 'historical',
        stream: true,
      }
      if (sedeId) { payload.user_sede_id = sedeId; payload.filter_sede_id = sedeId }

      const res = await fetch('/api/scan-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
        signal: ac.signal,
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        if (mountedRef.current) setError((data as { error?: string }).error ?? `${t.appStrings.rekkiPhaseError} ${res.status}`)
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

      while (true) {
        if (ac.signal.aborted || !mountedRef.current) {
          await reader.cancel()
          break
        }

        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        if (!mountedRef.current) break

        for (const line of lines) {
          const raw = line.trim()
          if (!raw) continue
          try {
            const evt = JSON.parse(raw) as {
              type: string
              phase?: string
              percent?: number
              messaggio?: string
              error?: string
              ricevuti?: number
            }

            if (evt.type === 'progress') {
              const phase   = (evt.phase ?? 'connect') as SyncPhase
              const percent = evt.percent ?? 0
              setSyncPercent(percent)
              setSyncLog(prev => {
                const last = prev[prev.length - 1]
                if (last?.phase === phase) return prev.map((l, i) => i === prev.length - 1 ? { ...l, percent } : l)
                return [...prev, { phase, label: PHASE_LABEL(phase), percent }]
              })
            } else if (evt.type === 'done') {
              setSyncPercent(100)
              setSyncResult(
                evt.messaggio ?? t.appStrings.rekkiDoneResult.replace('{n}', String(evt.ricevuti ?? 0))
              )
              await loadStatus()
            } else if (evt.type === 'error') {
              setError(evt.error ?? t.appStrings.rekkiErrUnknown)
            }
          } catch { /* line non JSON */ }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      if (mountedRef.current) setError(err instanceof Error ? err.message : t.appStrings.rekkiErrNetwork)
    } finally {
      if (mountedRef.current) setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="supplier-detail-tab-shell supplier-detail-tab-shell--soft-surface col-span-full overflow-hidden">
        <div className="app-card-bar-accent" aria-hidden />
        <div className="flex items-center justify-center px-5 py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-400/60 border-t-transparent" />
        </div>
      </div>
    )
  }

  const imapReady = status?.imap_configured !== false
  const matched   = status?.matched_count ?? 0
  const synced    = status?.last_sync_at
    ? new Date(status.last_sync_at).getTime() > Date.now() - 3_600_000
    : false

  const stopSync = () => {
    abortRef.current?.abort()
    setSyncing(false)
    setSyncLog([])
    setSyncPercent(0)
  }

  return (
    <div className="supplier-detail-tab-shell supplier-detail-tab-shell--soft-surface col-span-full overflow-hidden">
      <div className="app-card-bar-accent" aria-hidden />

      <div className="px-5 py-4">

        {/* ── Header desktop ──────────────────────────────────────── */}
        <div className="mb-4 hidden md:flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-app-fg">{t.appStrings.rekkiSyncTitle}</h3>
            <p className="mt-0.5 text-xs text-app-fg-muted">{t.appStrings.rekkiSyncDesc}</p>
          </div>
          {imapReady && (
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="flex h-[2.125rem] shrink-0 items-center gap-1 rounded-lg border border-app-line-25 bg-app-line-10/60 px-2.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <select
                  value={lookbackDays}
                  onChange={e => setLookbackDays(Number(e.target.value))}
                  disabled={syncing}
                  className="h-full min-h-0 max-w-[7rem] cursor-pointer bg-transparent py-0 text-xs font-semibold leading-none text-app-fg-muted focus:outline-none disabled:opacity-50 [color-scheme:dark]"
                >
                  {[7, 14, 30, 60, 90, 180, 365].map(d => (
                    <option key={d} value={d}>{t.appStrings.rekkiSyncDays.replace('{n}', String(d))}</option>
                  ))}
                </select>
              </div>

              {syncing ? (
                <>
                  <div className="flex items-center gap-1.5 rounded-lg border border-app-line-35 bg-app-line-10 px-3 py-2 text-xs font-semibold text-app-fg-muted">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400/70 border-t-transparent" />
                    {t.appStrings.rekkiSyncInProgress}…
                  </div>
                  <button
                    type="button"
                    onClick={stopSync}
                    className="flex items-center gap-1 rounded-lg border border-red-400/35 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                    title={t.appStrings.rekkiSyncStop}
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    {t.appStrings.rekkiSyncStop}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSync}
                  className="flex items-center gap-1.5 rounded-lg border border-app-line-35 bg-app-line-10 px-3 py-2 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-15"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t.appStrings.rekkiSyncCheckNow}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Header mobile ─────────────────────────────────────── */}
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between gap-2 rounded-lg px-0 py-0 text-left md:hidden active:opacity-70"
          onClick={() => { if (!syncing && imapReady) handleSync() }}
          title={syncing ? t.appStrings.rekkiSyncInProgress : t.appStrings.rekkiSyncCheckNow}
          aria-label={syncing ? t.appStrings.rekkiSyncInProgress : t.appStrings.rekkiSyncMobileTap}
        >
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white">{t.appStrings.rekkiSyncMobileTap}</h3>
            {status?.last_sync_at ? (
              <p className="mt-0.5 text-[11px] text-app-fg-muted">
                {formatDistanceToNow(new Date(status.last_sync_at), { addSuffix: true, locale: dateFnsLocale })}
                {!syncing && imapReady && (
                  <span className="ml-1.5 text-app-fg-muted">· {t.appStrings.rekkiSyncTapUpdate}</span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-app-fg-muted">
                {t.appStrings.rekkiSyncNeverRun}
                {!syncing && imapReady && <span className="ml-1.5 text-app-fg-muted">· {t.appStrings.rekkiSyncTapStart}</span>}
              </p>
            )}
          </div>
          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${synced ? 'bg-emerald-400' : 'bg-amber-400'} ${syncing ? 'animate-ping' : 'animate-pulse'}`} />
        </button>

        {/* ── Inline mobile sync action (replaces old fixed banner) ── */}
        {imapReady && (
          <div className="mb-3 md:hidden">
            {syncing ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2.5">
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-400/50 border-t-transparent" />
                <p className="min-w-0 flex-1 text-xs font-semibold text-red-200">{t.appStrings.rekkiSyncProcessing}</p>
                <button
                  type="button"
                  onClick={stopSync}
                  aria-label={t.appStrings.rekkiSyncStop}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/20 transition-colors active:bg-red-500/35"
                >
                  <svg className="h-4 w-4 text-red-200" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSync}
                aria-label={t.appStrings.rekkiSyncButtonLabel}
                className="flex w-full items-center gap-3 rounded-xl border border-app-line-28 bg-app-line-10/80 px-4 py-2.5 transition-colors active:bg-app-line-15"
              >
                <svg className="h-5 w-5 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="min-w-0 flex-1 text-left text-xs font-semibold text-app-fg">{t.appStrings.rekkiSyncButtonLabel}</span>
                <svg className="h-4 w-4 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* ── IMAP non configurato ──────────────────────────────── */}
        {!imapReady && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-300">{t.appStrings.rekkiImapNotConfigured}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/70">
                  {t.appStrings.rekkiImapNotConfiguredDesc}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Progresso streaming ──────────────────────────────── */}
        {syncing && (
          <div className="mb-4 overflow-hidden rounded-lg border border-app-line-28 bg-app-line-10/40">
            <div className="h-1 w-full bg-app-line-15">
              <div
                className="h-1 bg-gradient-to-r from-slate-400 to-slate-500 transition-all duration-500"
                style={{ width: `${syncPercent}%` }}
              />
            </div>
            <div className="px-3 py-2.5 space-y-1.5">
              {syncLog.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-app-fg-muted">
                  <div className="h-3 w-3 animate-spin rounded-full border border-slate-400/70 border-t-transparent" />
                  <span>{t.appStrings.rekkiSyncStarting}</span>
                </div>
              )}
              {syncLog.map((log, i) => {
                const isLast = i === syncLog.length - 1
                return (
                  <div key={i} className={`flex items-center gap-2 text-xs ${isLast ? 'text-app-fg' : 'text-app-fg-muted'}`}>
                    {isLast ? (
                      <div className="h-3 w-3 shrink-0 animate-spin rounded-full border border-slate-400/70 border-t-transparent" />
                    ) : (
                      <svg className="h-3 w-3 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span>{log.label}</span>
                    <span className="ml-auto tabular-nums text-[10px] opacity-60">{log.percent}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Feedback sync ────────────────────────────────────── */}
        {syncResult && !syncing && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
            <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {syncResult}
          </div>
        )}
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
            <svg className={`h-4 w-4 shrink-0 ${icon.duplicateAlert}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Corpo ────────────────────────────────────────────── */}
        {status && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">

            {/* Colonna sinistra — nascosta su mobile */}
            <div className="hidden md:flex flex-col gap-3 lg:w-56">
              <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.rekkiSyncLastScan}</p>
                    <p className="mt-1 text-sm font-bold text-app-fg">
                      {status.last_sync_at
                        ? formatDistanceToNow(new Date(status.last_sync_at), { addSuffix: true, locale: dateFnsLocale })
                        : t.appStrings.rekkiSyncNeverRun}
                    </p>
                  </div>
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${synced ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.rekkiSyncEmails}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">{status.total_emails_scanned}</p>
                </div>
                <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">{t.appStrings.rekkiSyncDocuments}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">{status.total_products_found}</p>
                </div>
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">{t.appStrings.rekkiSyncMatched}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">{matched}</p>
                </div>
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">{t.appStrings.rekkiSyncUnmatched}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-amber-200">{status.unmatched_count}</p>
                </div>
              </div>
            </div>

            {/* Colonna destra — nascosta su mobile */}
            <div className="hidden md:block min-w-0">
              {status.recent_updates.length > 0 ? (
                <div className="rounded-lg border border-app-line-35 bg-white/[0.025] p-3">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                    {t.appStrings.rekkiSyncRecentEmails}
                  </p>
                  <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: '14rem' }}>
                    {status.recent_updates.slice(0, 15).map((u, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-md border border-app-line-15 bg-app-line-10/50 px-3 py-2"
                      >
                        {u.is_matched ? (
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                            <svg className="h-2.5 w-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                            <svg className="h-2.5 w-2.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-app-fg">
                            {u.email_subject ?? u.prodotto ?? '—'}
                          </p>
                          <p className="truncate text-[10px] text-app-fg-muted">
                            {formatDistanceToNow(new Date(u.email_date), { addSuffix: true, locale: dateFnsLocale })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-app-line-35 bg-white/[0.025] px-4 py-8 text-center">
                  <svg className="h-10 w-10 text-app-fg-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-3 text-sm font-semibold text-app-fg-muted">{t.appStrings.rekkiSyncNoData}</p>
                  <p className="mt-1 text-xs text-app-fg-muted">
                    {t.appStrings.rekkiSyncNoDataDesc.replace('{nome}', fornitoreNome)}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
