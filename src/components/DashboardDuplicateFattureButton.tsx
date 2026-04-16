'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatCurrency, formatDate as formatAppDisplayDate } from '@/lib/locale-shared'
import { createClient } from '@/utils/supabase/client'
import type {
  DuplicateFatturaReportGroup,
  DuplicateFatturaScanProgressItem,
} from '@/lib/duplicate-fatture-report'
import Link from 'next/link'

type ApiOk = {
  ok: true
  groups: DuplicateFatturaReportGroup[]
  scannedRows: number
  truncated: boolean
}

function parseDuplicateReportNdjsonLine(
  trimmed: string,
  onProgress: (p: { scannedSoFar: number; sample: DuplicateFatturaScanProgressItem[] }) => void,
): ApiOk | null {
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
  if (msg.type === 'progress') {
    onProgress({
      scannedSoFar: Number(msg.scannedSoFar) || 0,
      sample: Array.isArray(msg.sample) ? (msg.sample as DuplicateFatturaScanProgressItem[]) : [],
    })
    return null
  }
  if (msg.type === 'done' && msg.ok === true) {
    return {
      ok: true,
      groups: msg.groups as DuplicateFatturaReportGroup[],
      scannedRows: Number(msg.scannedRows) || 0,
      truncated: Boolean(msg.truncated),
    }
  }
  if (msg.type === 'error') {
    throw new Error(String(msg.error ?? 'Errore'))
  }
  return null
}

/**
 * Legge NDJSON in streaming. Gestisce correttamente l’ultimo chunk (`done` + `value`)
 * e corpi inviati in un solo blocco (altrimenti i `progress` non venivano mai parsati).
 */
async function readDuplicateReportNdjsonStream(
  response: Response,
  signal: AbortSignal,
  onProgress: (p: { scannedSoFar: number; sample: DuplicateFatturaScanProgressItem[] }) => void,
): Promise<ApiOk> {
  if (!response.body) throw new Error('Nessun corpo risposta')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (signal.aborted) {
      await reader.cancel().catch(() => {})
      throw new DOMException('Aborted', 'AbortError')
    }
    if (value) {
      buffer += decoder.decode(value, { stream: true })
    }
    if (done) {
      buffer += decoder.decode()
    }

    const parts = buffer.split('\n')
    if (done) {
      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const result = parseDuplicateReportNdjsonLine(trimmed, onProgress)
        if (result) return result
      }
      break
    }

    buffer = parts.pop() ?? ''
    for (let i = 0; i < parts.length; i++) {
      const trimmed = parts[i]!.trim()
      if (!trimmed) continue
      const result = parseDuplicateReportNdjsonLine(trimmed, onProgress)
      if (result) return result
    }
  }
  throw new Error('Flusso interrotto prima del risultato')
}

const toolbarStripBtnCls =
  'inline-flex h-7 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md border border-app-line-35 app-workspace-inset-bg px-2 text-[10px] font-semibold text-app-fg transition-colors hover:border-app-line-50 hover:brightness-110 sm:gap-1 sm:rounded-lg sm:px-2.5 sm:text-[11px]'
const defaultBtnCls =
  'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-500/40 bg-amber-950/35 px-3.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-400/55 hover:bg-amber-950/55'

export default function DashboardDuplicateFattureButton({
  className,
  alwaysShowLabel = false,
  toolbarStrip = false,
}: {
  className?: string
  /** Come ScanEmail: mostra il testo anche su schermi stretti */
  alwaysShowLabel?: boolean
  /** Allinea a Sincronizza Email nella barra desktop (h-7, padding compatto). */
  toolbarStrip?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const { locale, timezone, currency } = useLocale()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiOk | null>(null)
  const [mounted, setMounted] = useState(false)
  const [scanElapsedSec, setScanElapsedSec] = useState(0)
  const [progressScanned, setProgressScanned] = useState(0)
  const [progressSample, setProgressSample] = useState<DuplicateFatturaScanProgressItem[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
    }
  }, [open])

  useEffect(() => {
    if (!loading) {
      setScanElapsedSec(0)
      return
    }
    const start = Date.now()
    const tick = () => setScanElapsedSec(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [loading])

  const formatDate = useCallback(
    (d: string) => {
      const ymd = d.slice(0, 10)
      try {
        return formatAppDisplayDate(`${ymd}T12:00:00`, locale, timezone)
      } catch {
        return d
      }
    },
    [locale, timezone],
  )

  const pruneDeletedFattura = useCallback((fatturaId: string) => {
    setData((prev) => {
      if (!prev) return prev
      const groups = prev.groups
        .map((g) => ({ ...g, fatture: g.fatture.filter((f) => f.id !== fatturaId) }))
        .filter((g) => g.fatture.length >= 2)
      return { ...prev, groups }
    })
  }, [])

  const handleDeleteDuplicate = useCallback(
    async (event: React.MouseEvent, fatturaId: string) => {
      event.preventDefault()
      event.stopPropagation()
      if (!window.confirm(t.dashboard.duplicateFattureDeleteConfirm)) return
      setDeletingId(fatturaId)
      const { error } = await createClient().from('fatture').delete().eq('id', fatturaId)
      setDeletingId(null)
      if (error) {
        window.alert(`${t.appStrings.deleteFailed} ${error.message}`)
        return
      }
      pruneDeletedFattura(fatturaId)
      router.refresh()
    },
    [pruneDeletedFattura, router, t.appStrings.deleteFailed, t.dashboard.duplicateFattureDeleteConfirm],
  )

  const runScan = useCallback(async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setData(null)
    setProgressScanned(0)
    setProgressSample([])
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current
    try {
      const res = await fetch('/api/fatture/duplicate-report?stream=1', {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/x-ndjson' },
        signal,
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        setError(json.error?.trim() || t.dashboard.duplicateFattureError)
        return
      }
      /** `?stream=1` ⇒ risposta NDJSON; lettura streaming anche se il proxy altera il Content-Type. */
      const result = await readDuplicateReportNdjsonStream(res, signal, ({ scannedSoFar, sample }) => {
        setProgressScanned(scannedSoFar)
        setProgressSample(sample)
      })
      setData(result)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : t.dashboard.duplicateFattureError)
    } finally {
      setLoading(false)
    }
  }, [t.dashboard.duplicateFattureError])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center app-workspace-inset-bg p-3 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dup-fatture-title"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/35 app-workspace-surface-elevated shadow-[0_0_40px_-12px_rgba(245,158,11,0.35)]">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 id="dup-fatture-title" className="text-base font-bold text-amber-100 sm:text-lg">
                    {t.dashboard.duplicateFattureModalTitle}
                  </h2>
                  {data && !loading ? (
                    <p className="mt-1 text-xs text-app-fg-muted">
                      {t.dashboard.duplicateFattureRowsAnalyzed.replace(
                        '{n}',
                        data.scannedRows.toLocaleString(locale),
                      )}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-lg border border-app-line-30 app-workspace-inset-bg-soft px-2.5 py-1 text-xs font-semibold text-app-fg-muted transition-colors hover:border-app-a-45 hover:bg-app-line-10 hover:text-app-fg"
                >
                  {t.dashboard.duplicateFattureClose}
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                {loading ? (
                  <div
                    className="flex flex-col items-center gap-4 py-10"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <svg
                      className="h-9 w-9 shrink-0 animate-spin text-amber-400/90"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-90"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    <p className="text-center text-sm text-app-fg-muted">{t.dashboard.duplicateFattureScanning}</p>
                    <p className="text-center text-xs text-app-fg-muted">
                      {t.dashboard.duplicateFattureRowsAnalyzed.replace(
                        '{n}',
                        progressScanned.toLocaleString(locale),
                      )}
                    </p>
                    <p className="tabular-nums text-xs text-app-fg-muted">
                      {scanElapsedSec > 0 ? `${scanElapsedSec}s` : '…'}
                    </p>
                    <div className="w-full max-w-lg px-1">
                      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                        {t.dashboard.duplicateFattureScanningBatch}
                      </p>
                      <ul
                        className="max-h-48 min-h-[5rem] space-y-1.5 overflow-y-auto rounded-lg border border-white/10 app-workspace-inset-bg-soft px-2 py-2 text-left"
                        aria-label={t.dashboard.duplicateFattureScanningBatch}
                      >
                        {progressSample.length > 0 ? (
                          progressSample.map((row) => (
                            <li
                              key={row.id}
                              className="border-b border-white/5 pb-1.5 text-[11px] text-app-fg-muted last:border-0 last:pb-0"
                            >
                              <div className="truncate font-medium text-app-fg-muted">
                                {row.fornitore_nome ?? '—'}
                                <span className="font-normal text-app-fg-muted">
                                  {' '}
                                  · {formatDate(row.data)}
                                  {row.numero_fattura ? ` · ${row.numero_fattura}` : ''}
                                </span>
                              </div>
                              {row.file_label ? (
                                <div className="mt-0.5 truncate font-mono text-[10px] text-app-fg-muted" title={row.file_label}>
                                  {row.file_label}
                                </div>
                              ) : null}
                            </li>
                          ))
                        ) : (
                          <li className="list-none py-5 text-center text-[11px] leading-relaxed text-app-fg-muted">
                            {t.dashboard.duplicateFattureScanningAwaitingRows}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                ) : error ? (
                  <p className="py-10 text-center text-sm text-red-300">{error}</p>
                ) : data && data.groups.length === 0 ? (
                  <p className="py-10 text-center text-sm leading-relaxed text-app-fg-muted">
                    {t.dashboard.duplicateFattureNone}
                  </p>
                ) : data ? (
                  <div className="flex flex-col gap-4">
                    {data.truncated ? (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
                        {t.dashboard.duplicateFattureTruncated}
                      </p>
                    ) : null}
                    {data.groups.map((g) => (
                      <div
                        key={`${g.sede_id ?? 'x'}-${g.fornitore_id}-${g.data}-${g.numero_normalizzato}`}
                        className="rounded-xl border border-white/10 app-workspace-inset-bg-soft px-3 py-3 sm:px-4"
                      >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-app-fg">
                            {g.fornitore_nome ?? '—'}
                            <span className="ml-2 font-normal text-app-fg-muted">
                              · {formatDate(g.data)} · {g.numero_normalizzato}
                            </span>
                          </p>
                          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                            {t.dashboard.duplicateFattureGroupCount.replace('{n}', String(g.fatture.length))}
                          </span>
                        </div>
                        <p className="mb-2 text-[11px] text-app-fg-muted">
                          {g.sede_nome ?? t.dashboard.duplicateFattureSedeUnassigned}
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {g.fatture.map((f) => (
                            <li key={f.id} className="flex items-stretch gap-2">
                              <Link
                                href={`/fatture/${f.id}`}
                                className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg border border-app-soft-border bg-cyan-950/20 px-2.5 py-2 text-xs transition-colors hover:border-app-a-40 hover:bg-cyan-950/35 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                                onClick={() => setOpen(false)}
                              >
                                <span className="font-mono text-[11px] text-app-fg-muted">{f.id.slice(0, 8)}…</span>
                                <span className="font-semibold text-app-fg-muted sm:text-right">
                                  {f.importo != null && !Number.isNaN(f.importo)
                                    ? formatCurrency(f.importo, currency, locale)
                                    : '—'}
                                </span>
                                <span className="col-span-2 text-app-fg-muted underline decoration-app-line-50 sm:col-span-1 sm:text-right">
                                  {t.common.detail} →
                                </span>
                              </Link>
                              <button
                                type="button"
                                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-500/45 bg-red-950/35 px-2.5 py-2 text-red-200 transition-colors hover:border-red-400/65 hover:bg-red-950/55 disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label={t.dashboard.duplicateFattureDeleteAria}
                                title={t.common.delete}
                                disabled={deletingId !== null}
                                onClick={(e) => void handleDeleteDuplicate(e, f.id)}
                              >
                                {deletingId === f.id ? (
                                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        type="button"
        onClick={() => void runScan()}
        className={className ?? (toolbarStrip ? toolbarStripBtnCls : defaultBtnCls)}
      >
        <svg
          className={`${toolbarStrip ? 'h-3 w-3 sm:h-3.5 sm:w-3.5' : 'h-4 w-4'} shrink-0 opacity-90`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        <span className={alwaysShowLabel ? '' : 'hidden md:inline'}>{t.dashboard.duplicateFattureScanButton}</span>
      </button>
      {modal}
    </>
  )
}
