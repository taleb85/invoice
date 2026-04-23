'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import { createPortal } from 'react-dom'
import type { ScannerDetailRow } from '@/app/api/scansioni/detail/route'
import type { Translations } from '@/lib/translations'
import { useLocale } from '@/lib/locale-context'
import { formatDate as fmtDate } from '@/lib/locale-shared'

type ModalType = 'elaborate' | 'archiviate'
type FetchState = 'idle' | 'loading' | 'done' | 'error'

// ─── utility ─────────────────────────────────────────────────────────────────

function tipoLabel(tipo: ScannerDetailRow['tipo']): string {
  if (tipo === 'bolla') return 'Bolla'
  if (tipo === 'fattura') return 'Fattura'
  return 'AI'
}

function tipoBadgeCls(tipo: ScannerDetailRow['tipo']): string {
  if (tipo === 'bolla')
    return 'bg-amber-500/20 text-amber-200 ring-amber-400/30'
  if (tipo === 'fattura')
    return 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30'
  return 'bg-cyan-500/20 text-cyan-200 ring-cyan-400/30'
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({
  modalType,
  tz,
  onClose,
}: {
  modalType: ModalType
  tz: string
  onClose: () => void
}) {
  const { locale } = useLocale()
  const titleId = useId()
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [rows, setRows] = useState<ScannerDetailRow[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Fetch data
  useEffect(() => {
    if (fetchState !== 'idle') return
    setFetchState('loading')
    fetch(`/api/scansioni/detail?type=${modalType}&tz=${encodeURIComponent(tz)}`, {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((json: { ok?: boolean; rows?: ScannerDetailRow[]; error?: string }) => {
        if (json.ok && json.rows) {
          setRows(json.rows)
          setFetchState('done')
        } else {
          setErrorMsg(json.error ?? 'Errore durante il caricamento')
          setFetchState('error')
        }
      })
      .catch(() => {
        setErrorMsg('Errore di rete')
        setFetchState('error')
      })
  }, [fetchState, modalType, tz])

  const title =
    modalType === 'elaborate' ? 'Documenti elaborati dall\'AI' : 'Documenti archiviati'

  const formatTime = (iso: string) => {
    try {
      return fmtDate(iso, locale, tz, { hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso.slice(11, 16)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return fmtDate(`${iso.slice(0, 10)}T12:00:00`, locale, tz, { day: '2-digit', month: 'short' })
    } catch {
      return iso.slice(0, 10)
    }
  }

  const isElaborate = modalType === 'elaborate'

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center p-3 sm:items-center sm:p-5"
      style={{ background: 'rgba(10,25,47,0.85)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden"
        style={{
          background: '#0f2a4a',
          border: '1px solid rgba(34,211,238,0.2)',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5"
          style={{ borderColor: 'rgba(34,211,238,0.15)' }}>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-bold text-app-fg sm:text-base">
              {title}
            </h2>
            {fetchState === 'done' && (
              <p className="mt-0.5 text-[11px] text-app-fg-muted">
                {rows.length === 0
                  ? 'Nessun documento trovato'
                  : `${rows.length} ${rows.length === 1 ? 'documento' : 'documenti'} oggi`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
            style={{ borderColor: 'rgba(34,211,238,0.2)', color: '#94a3b8' }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {fetchState === 'loading' && (
            <div className="flex items-center justify-center py-14" role="status" aria-live="polite">
              <svg className="h-7 w-7 animate-spin text-cyan-400/70" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}

          {fetchState === 'error' && (
            <div className="px-5 py-6 text-sm text-red-300">{errorMsg}</div>
          )}

          {fetchState === 'done' && rows.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-app-fg-muted">
              Nessun documento trovato per oggi.
            </div>
          )}

          {fetchState === 'done' && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="border-b text-[10px] font-semibold uppercase tracking-wider text-app-fg-muted"
                    style={{ borderColor: 'rgba(34,211,238,0.12)' }}>
                    <th className="px-4 py-2.5 sm:px-5">Orario</th>
                    {!isElaborate && <th className="px-2 py-2.5">Tipo</th>}
                    {!isElaborate && <th className="px-2 py-2.5">Fornitore</th>}
                    {!isElaborate && <th className="px-2 py-2.5">Numero</th>}
                    {!isElaborate && <th className="px-2 py-2.5">Data doc.</th>}
                    {!isElaborate && <th className="px-2 py-2.5">Stato</th>}
                    {isElaborate && <th className="px-2 py-2.5 sm:px-5">Azione</th>}
                    {!isElaborate && <th className="px-2 py-2.5 sm:px-5">File</th>}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(34,211,238,0.08)' }}>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors"
                      style={{ borderColor: 'rgba(34,211,238,0.08)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(34,211,238,0.04)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-app-fg-muted sm:px-5">
                        {formatTime(row.created_at)}
                      </td>
                      {isElaborate ? (
                        <td className="px-2 py-2.5 text-app-fg-muted sm:px-5">
                          PDF analizzato dall&apos;AI
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-2.5">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${tipoBadgeCls(row.tipo)}`}>
                              {tipoLabel(row.tipo)}
                            </span>
                          </td>
                          <td className="max-w-[140px] truncate px-2 py-2.5 text-app-fg sm:max-w-none">
                            {row.fornitore_nome ?? <span className="text-app-fg-muted">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-app-fg-muted">
                            {row.numero ?? <span className="text-app-fg-muted/60">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-app-fg-muted">
                            {row.data ? formatDate(row.data) : <span className="text-app-fg-muted/60">—</span>}
                          </td>
                          <td className="px-2 py-2.5">
                            {row.stato ? (
                              <span className="rounded bg-app-line-20 px-1.5 py-0.5 text-[10px] font-medium text-app-fg-muted">
                                {row.stato}
                              </span>
                            ) : <span className="text-app-fg-muted/60">—</span>}
                          </td>
                          <td className="max-w-[160px] truncate px-2 py-2.5 font-mono text-[10px] text-app-fg-muted sm:px-5"
                            title={row.file_nome ?? undefined}>
                            {row.file_nome ?? <span className="opacity-50">—</span>}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── KPI Buttons ──────────────────────────────────────────────────────────────

export default function ScannerFlowKpiButtons({
  aiElaborate,
  archiviate,
  t,
  tz,
  kpiBoxBorder,
  kpiBoxBg,
  kpiNumCls,
  kpiLabelCls,
}: {
  aiElaborate: number
  archiviate: number
  t: Translations
  /** IANA timezone string from the server */
  tz: string
  kpiBoxBorder: string
  kpiBoxBg: string
  kpiNumCls: string
  kpiLabelCls: string
}) {
  const [openModal, setOpenModal] = useState<ModalType | null>(null)

  const handleClose = useCallback(() => setOpenModal(null), [])

  const btnBase = `flex flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center md:py-3 cursor-pointer touch-manipulation select-none transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950`
  const btnHoverStyle = {
    '--hover-border': 'rgba(34,211,238,0.35)',
  } as React.CSSProperties

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenModal('elaborate')}
        className={`${btnBase} ${kpiBoxBorder} ${kpiBoxBg}`}
        style={btnHoverStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,211,238,0.35)'; (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.filter = '' }}
        aria-label={`${t.dashboard.scannerFlowAiElaborate}: ${aiElaborate}. Clicca per vedere la lista`}
      >
        <span className={`text-2xl font-bold tabular-nums md:text-3xl ${kpiNumCls}`}>{aiElaborate}</span>
        <span className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${kpiLabelCls}`}>
          {t.dashboard.scannerFlowAiElaborate}
          <svg className="h-2.5 w-2.5 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>

      <button
        type="button"
        onClick={() => setOpenModal('archiviate')}
        className={`${btnBase} ${kpiBoxBorder} ${kpiBoxBg}`}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34,211,238,0.35)'; (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.filter = '' }}
        aria-label={`${t.dashboard.scannerFlowArchived}: ${archiviate}. Clicca per vedere la lista`}
      >
        <span className={`text-2xl font-bold tabular-nums md:text-3xl ${kpiNumCls}`}>{archiviate}</span>
        <span className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${kpiLabelCls}`}>
          {t.dashboard.scannerFlowArchived}
          <svg className="h-2.5 w-2.5 shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>

      {openModal !== null && (
        <DetailModal modalType={openModal} tz={tz} onClose={handleClose} />
      )}
    </>
  )
}
