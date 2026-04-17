'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'

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

  const PHASE_LABEL: Record<SyncPhase, string> = {
    queued:  'In coda...',
    connect: 'Connessione alla casella email...',
    search:  'Ricerca email Rekki...',
    process: 'Elaborazione email...',
    persist: 'Salvataggio dati...',
    done:    'Completato',
    error:   'Errore',
  }

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

  // Quando cambia fornitore: interrompe sync in corso e ricarica status
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
    // Cancella eventuale sync precedente ancora in corso
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
        if (mountedRef.current) setError((data as { error?: string }).error || `Errore ${res.status}`)
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

      while (true) {
        // Se il componente si è smontato o l'abort è scattato, esci subito
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
                return [...prev, { phase, label: PHASE_LABEL[phase] ?? phase, percent }]
              })
            } else if (evt.type === 'done') {
              setSyncPercent(100)
              setSyncResult(evt.messaggio ?? `Completato — ${evt.ricevuti ?? 0} email elaborate`)
              await loadStatus()
            } else if (evt.type === 'error') {
              setError(evt.error ?? 'Errore sconosciuto')
            }
          } catch { /* line non JSON */ }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Errore di rete')
    } finally {
      if (mountedRef.current) setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="supplier-detail-tab-shell col-span-full overflow-hidden border-cyan-500/25">
        <div className="app-card-bar-accent bg-gradient-to-r from-cyan-500/80 to-blue-500/60" aria-hidden />
        <div className="flex items-center justify-center px-5 py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
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
    <div className="supplier-detail-tab-shell col-span-full overflow-hidden border-cyan-500/25">
      <div className="app-card-bar-accent bg-gradient-to-r from-cyan-500/80 to-blue-500/60" aria-hidden />

      {/* ── Action Bar mobile: sopra il bottom nav (90px) + safe area bottom + gap landscape ─── */}
      {imapReady && (
        <div
          className="fixed left-1/2 z-[90] -translate-x-1/2 w-[min(calc(100vw-1.75rem),var(--app-layout-max-width))] max-w-[var(--app-layout-max-width)] md:hidden"
          style={{
            bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px) + 90px + 0.625rem)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >
          {syncing ? (
            <div className="flex items-center gap-3 rounded-2xl bg-red-600 px-5 py-3 shadow-[0_8px_32px_rgba(239,68,68,0.55)] ring-1 ring-red-400/40">
              <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-red-100/80">Scansione in corso</p>
                <p className="text-sm font-bold text-white">Elaborazione email Rekki…</p>
              </div>
              <button
                type="button"
                onClick={stopSync}
                aria-label="Interrompi scansione"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 transition-colors active:bg-white/25"
              >
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSync}
              aria-label="Scansiona bolla o fattura"
              className="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-3 shadow-[0_8px_32px_rgba(6,182,212,0.45)] ring-1 ring-cyan-300/30 transition-transform active:scale-[0.97]"
            >
              {/* Icona fotocamera */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-100/70">Rekki · Email</p>
                <p className="text-base font-bold leading-tight text-white">SCANSIONA BOLLA / FATTURA</p>
              </div>
              <svg className="h-5 w-5 shrink-0 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="px-5 py-4">

        {/* ── Header desktop ──────────────────────────────────────── */}
        <div className="mb-4 hidden md:flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-app-fg">Sincronizzazione Email Rekki</h3>
            <p className="mt-0.5 text-xs text-app-fg-muted">
              Scansiona la casella email della sede e abbina automaticamente gli ordini Rekki
            </p>
          </div>
          {imapReady && (
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Selettore finestra giorni */}
              <div className="flex items-center gap-1 rounded-lg border border-app-line-25 bg-app-line-10/60 px-2 py-1.5">
                <svg className="h-3 w-3 shrink-0 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <select
                  value={lookbackDays}
                  onChange={e => setLookbackDays(Number(e.target.value))}
                  disabled={syncing}
                  className="bg-transparent text-[11px] font-semibold text-app-fg-muted focus:outline-none disabled:opacity-50 [color-scheme:dark] cursor-pointer"
                >
                  {[7, 14, 30, 60, 90, 180, 365].map(d => (
                    <option key={d} value={d}>{d} giorni</option>
                  ))}
                </select>
              </div>

              {syncing ? (
                <>
                  <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                    Scansione...
                  </div>
                  <button
                    type="button"
                    onClick={stopSync}
                    className="flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                    title="Interrompi scansione"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                    Stop
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSync}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Controlla ora
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Header mobile: titolo + timer + tap-to-sync ─────────── */}
        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between gap-2 rounded-lg px-0 py-0 text-left md:hidden active:opacity-70"
          onClick={() => { if (!syncing && imapReady) handleSync() }}
          title={syncing ? 'Scansione in corso…' : 'Tocca per avviare la sync'}
          aria-label={syncing ? 'Scansione in corso' : 'Avvia sync email Rekki'}
        >
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white">Sincronizza Email Rekki</h3>
            {status?.last_sync_at ? (
              <p className="mt-0.5 text-[11px] text-white/60">
                {formatDistanceToNow(new Date(status.last_sync_at), { addSuffix: true, locale: it })}
                {!syncing && imapReady && (
                  <span className="ml-1.5 text-cyan-400">· tocca per aggiornare</span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-white/60">
                Mai eseguita{!syncing && imapReady && <span className="ml-1.5 text-cyan-400">· tocca per avviare</span>}
              </p>
            )}
          </div>
          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${synced ? 'bg-emerald-400' : 'bg-amber-400'} ${syncing ? 'animate-ping' : 'animate-pulse'}`} />
        </button>

        {/* ── IMAP non configurato ──────────────────────────────── */}
        {!imapReady && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-300">Casella email non configurata</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/70">
                  Configura le credenziali IMAP in <span className="font-semibold text-amber-300">Impostazioni → Sede</span> per abilitare la sincronizzazione.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Progresso streaming ──────────────────────────────── */}
        {syncing && (
          <div className="mb-4 overflow-hidden rounded-lg border border-cyan-500/25 bg-app-line-10/40">
            {/* Barra progresso */}
            <div className="h-1 w-full bg-app-line-15">
              <div
                className="h-1 bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-500"
                style={{ width: `${syncPercent}%` }}
              />
            </div>
            {/* Log fasi */}
            <div className="px-3 py-2.5 space-y-1.5">
              {syncLog.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-app-fg-muted">
                  <div className="h-3 w-3 animate-spin rounded-full border border-cyan-400 border-t-transparent" />
                  <span>Avvio scansione...</span>
                </div>
              )}
              {syncLog.map((log, i) => {
                const isLast = i === syncLog.length - 1
                return (
                  <div key={i} className={`flex items-center gap-2 text-xs ${isLast ? 'text-cyan-300' : 'text-app-fg-muted'}`}>
                    {isLast ? (
                      <div className="h-3 w-3 shrink-0 animate-spin rounded-full border border-cyan-400 border-t-transparent" />
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
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
            <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {syncResult}
          </div>
        )}
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Corpo ────────────────────────────────────────────── */}
        {status && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">

            {/* Colonna sinistra: ultimo sync + KPI — nascosta su mobile */}
            <div className="hidden md:flex flex-col gap-3 lg:w-56">
              {/* Ultimo sync */}
              <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">Ultima scansione</p>
                    <p className="mt-1 text-sm font-bold text-app-fg">
                      {status.last_sync_at
                        ? formatDistanceToNow(new Date(status.last_sync_at), { addSuffix: true, locale: it })
                        : 'Mai eseguita'}
                    </p>
                  </div>
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${synced ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                </div>
              </div>

              {/* KPI 2×2 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">Email</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">{status.total_emails_scanned}</p>
                </div>
                <div className="rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">Documenti</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-fg">{status.total_products_found}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">Abbinati</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">{matched}</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Da abbinare</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-amber-200">{status.unmatched_count}</p>
                </div>
              </div>
            </div>

            {/* Colonna destra: email elaborate — nascosta su mobile */}
            <div className="hidden md:block min-w-0">
              {status.recent_updates.length > 0 ? (
                <div className="rounded-lg border border-app-line-22 bg-app-line-10/30 p-3">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                    Ultime email elaborate
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
                            {formatDistanceToNow(new Date(u.email_date), { addSuffix: true, locale: it })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-app-line-22 bg-app-line-10/30 px-4 py-8 text-center">
                  <svg className="h-10 w-10 text-app-fg-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-3 text-sm font-semibold text-app-fg-muted">Nessun prezzo rilevato</p>
                  <p className="mt-1 text-xs text-app-fg-muted">
                    Premi «Controlla ora» per scansionare le email Rekki di {fornitoreNome}
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
