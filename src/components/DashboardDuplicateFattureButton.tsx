'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatCurrency } from '@/lib/locale-shared'
import type { DuplicateFatturaReportGroup } from '@/lib/duplicate-fatture-report'
import Link from 'next/link'

type ApiOk = {
  ok: true
  groups: DuplicateFatturaReportGroup[]
  scannedRows: number
  truncated: boolean
}

export default function DashboardDuplicateFattureButton({
  className,
  alwaysShowLabel = false,
}: {
  className?: string
  /** Come ScanEmail: mostra il testo anche su schermi stretti */
  alwaysShowLabel?: boolean
}) {
  const t = useT()
  const { locale, timezone, currency } = useLocale()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiOk | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatDate = useCallback(
    (d: string) => {
      try {
        return new Intl.DateTimeFormat(locale, {
          timeZone: timezone,
          dateStyle: 'medium',
        }).format(new Date(d + 'T12:00:00'))
      } catch {
        return d
      }
    },
    [locale, timezone],
  )

  const formatDt = useCallback(
    (iso: string) => {
      try {
        return new Intl.DateTimeFormat(locale, {
          timeZone: timezone,
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(iso))
      } catch {
        return iso
      }
    },
    [locale, timezone],
  )

  const runScan = useCallback(async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch('/api/fatture/duplicate-report', { method: 'GET', cache: 'no-store' })
      const json = (await res.json()) as ApiOk | { error?: string }
      if (!res.ok || !('ok' in json) || !json.ok) {
        setError((json as { error?: string }).error?.trim() || t.dashboard.duplicateFattureError)
        return
      }
      setData(json)
    } catch {
      setError(t.dashboard.duplicateFattureError)
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
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dup-fatture-title"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-b from-slate-900 to-slate-950 shadow-[0_0_40px_-12px_rgba(245,158,11,0.35)]">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 id="dup-fatture-title" className="text-base font-bold text-amber-100 sm:text-lg">
                    {t.dashboard.duplicateFattureModalTitle}
                  </h2>
                  {data && !loading ? (
                    <p className="mt-1 text-xs text-slate-400">
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
                  className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
                >
                  {t.dashboard.duplicateFattureClose}
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
                {loading ? (
                  <p className="py-10 text-center text-sm text-slate-300">{t.dashboard.duplicateFattureScanning}</p>
                ) : error ? (
                  <p className="py-10 text-center text-sm text-red-300">{error}</p>
                ) : data && data.groups.length === 0 ? (
                  <p className="py-10 text-center text-sm leading-relaxed text-slate-300">
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
                        className="rounded-xl border border-white/10 bg-slate-800/40 px-3 py-3 sm:px-4"
                      >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-100">
                            {g.fornitore_nome ?? '—'}
                            <span className="ml-2 font-normal text-slate-400">
                              · {formatDate(g.data)} · {g.numero_normalizzato}
                            </span>
                          </p>
                          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                            {t.dashboard.duplicateFattureGroupCount.replace('{n}', String(g.fatture.length))}
                          </span>
                        </div>
                        <p className="mb-2 text-[11px] text-slate-500">
                          {g.sede_nome ?? t.dashboard.duplicateFattureSedeUnassigned}
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {g.fatture.map((f) => (
                            <li key={f.id}>
                              <Link
                                href={`/fatture/${f.id}`}
                                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-2.5 py-2 text-xs transition-colors hover:border-cyan-400/40 hover:bg-cyan-950/35 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                                onClick={() => setOpen(false)}
                              >
                                <span className="font-mono text-[11px] text-cyan-200/90">{f.id.slice(0, 8)}…</span>
                                <span className="text-slate-400 sm:text-right">{formatDt(f.created_at)}</span>
                                <span className="font-semibold text-slate-200 sm:text-right">
                                  {f.importo != null && !Number.isNaN(f.importo)
                                    ? formatCurrency(f.importo, currency, locale)
                                    : '—'}
                                </span>
                                <span className="col-span-2 text-cyan-300 underline decoration-cyan-500/50 sm:col-span-1 sm:text-right">
                                  {t.common.detail} →
                                </span>
                              </Link>
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
        className={
          className ??
          'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-500/40 bg-amber-950/35 px-3.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-400/55 hover:bg-amber-950/55'
        }
      >
        <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
