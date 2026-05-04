'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ReturnToLink } from '@/components/ReturnToLink'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { useT } from '@/lib/use-t'
import type { PendingApprovalFattura } from '@/app/api/fatture/pending-approval/route'

function fmt(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

type RejectState = { id: string; reason: string }
type AiCheckState = {
  id: string
  status: 'checking' | 'failed' | 'approved'
  message: string
} | null

export function ApprovalQueue() {
  const t = useT()
  const [rows, setRows] = useState<PendingApprovalFattura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [rejectState, setRejectState] = useState<RejectState | null>(null)
  const [aiCheckState, setAiCheckState] = useState<AiCheckState>(null)
  const [bulkChecking, setBulkChecking] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)
  const [bulkCurrentId, setBulkCurrentId] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<{ approved: number; total: number; failed: { id: string; motivazione: string }[] } | null>(null)
  const autoStarted = useRef(false)
  const singleCheckIds = useRef(new Set<string>())
  const rowsRef = useRef<PendingApprovalFattura[]>([])
  const allBulkedIds = useRef(new Set<string>())

  // Keep rowsRef in sync
  rowsRef.current = rows

  const processNextBatch = useCallback(async () => {
    const currentRows = rowsRef.current
    const toCheck = currentRows.filter((r) => r.file_url?.trim() && !allBulkedIds.current.has(r.id)).slice(0, 3)
    if (toCheck.length === 0) {
      setBulkChecking(false)
      setBulkCurrentId(null)
      setBulkProgress(null)
      return
    }

    // Mark these as processed so they won't be picked up again
    toCheck.forEach((f) => allBulkedIds.current.add(f.id))

    setBulkChecking(true)

    const failed: { id: string; motivazione: string }[] = []
    let approved = 0

    for (let i = 0; i < toCheck.length; i++) {
      const f = toCheck[i]
      setBulkCurrentId(f.id)
      setBulkProgress(`Controllo fattura ${i + 1} di ${toCheck.length}: ${f.fornitoreNome ?? 'Fornitore'}...`)
      try {
        const res = await fetch('/api/fatture/check-and-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fattura_id: f.id }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          esito?: string
          motivazione?: string
          approvata?: boolean
          error?: string
        }
        if (data.approvata) {
          approved++
          setRows((prev) => prev.filter((r) => r.id !== f.id))
        } else {
          failed.push({ id: f.id, motivazione: data.motivazione ?? 'Verifica non superata' })
        }
      } catch {
        failed.push({ id: f.id, motivazione: 'Errore di rete' })
      }
    }

    // Show partial result
    if (failed.length > 0 || approved > 0) {
      setBulkResult({ approved, total: toCheck.length, failed })
    }

    // Check if there are more to process
    const remainingRows = rowsRef.current.filter((r) => r.file_url?.trim() && !allBulkedIds.current.has(r.id))
    if (remainingRows.length > 0) {
      // Continue with next batch after a brief pause
      setTimeout(() => {
        void processNextBatch()
      }, 500)
    } else {
      setBulkChecking(false)
      setBulkCurrentId(null)
      setBulkProgress(null)
    }
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/fatture/pending-approval')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Errore caricamento'))))
      .then((d: { rows: PendingApprovalFattura[] }) => {
        setRows(d.rows)
        if (!autoStarted.current && d.rows.length > 0) {
          autoStarted.current = true
          setTimeout(() => {
            void processNextBatch()
          }, 500)
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [processNextBatch])

  useEffect(() => {
    load()
  }, [load])

  const handleAction = useCallback(
    async (id: string, action: 'approve' | 'reject', reason?: string) => {
      setActionPending(id)
      try {
        const res = await fetch('/api/fatture/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fattura_id: id, action, reason }),
        })
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(d.error ?? 'Errore')
        }
        setRows((prev) => prev.filter((r) => r.id !== id))
        setRejectState(null)
      } catch (e) {
        alert((e as Error).message)
      } finally {
        setActionPending(null)
      }
    },
    [],
  )

  const handleCheckAndApprove = useCallback(async (id: string) => {
    setAiCheckState({ id, status: 'checking', message: '' })
    singleCheckIds.current.add(id)
    try {
      const res = await fetch('/api/fatture/check-and-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fattura_id: id }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        esito?: string
        motivazione?: string
        approvata?: boolean
        error?: string
      }
      if (data.error) {
        throw new Error(data.error)
      }
      if (data.approvata) {
        setAiCheckState({ id, status: 'approved', message: '' })
        setTimeout(() => {
          setRows((prev) => prev.filter((r) => r.id !== id))
          setAiCheckState(null)
          singleCheckIds.current.delete(id)
        }, 2000)
      } else {
        setAiCheckState({
          id,
          status: 'failed',
          message: data.motivazione ?? 'Verifica non superata',
        })
        singleCheckIds.current.delete(id)
      }
    } catch (e) {
      setAiCheckState({
        id,
        status: 'failed',
        message: (e as Error).message,
      })
      singleCheckIds.current.delete(id)
    }
  }, [])

  const handleBulkCheck = useCallback(() => {
    // Reset processed set so user can re-check
    allBulkedIds.current = new Set()
    void processNextBatch()
  }, [processNextBatch])

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-app-line-22 bg-transparent" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/10 p-4 text-sm text-rose-400">
        {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
          <svg className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-app-fg">{t.appStrings.approvazioni_noPending}</p>
        <p className="text-sm text-app-fg-subtle">{t.appStrings.approvazioni_allReviewed}</p>
      </div>
    )
  }

  const withFileCount = rows.filter((r) => r.file_url?.trim()).length
  const canBulk = withFileCount > 0 && !bulkChecking

  return (
    <div className="space-y-4">
      {/* Header con pulsante bulk */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-app-fg-subtle">
          {rows.length} fatture da approvare
          {withFileCount < rows.length && (
            <span className="ml-2 text-amber-300">({rows.length - withFileCount} senza allegato)</span>
          )}
        </div>
        <button
          type="button"
          disabled={!canBulk}
          onClick={() => void handleBulkCheck()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-600 hover:to-blue-700 hover:shadow-cyan-500/30 disabled:opacity-40"
        >
          {bulkChecking ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {bulkProgress ?? 'Controllo in corso...'}
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Controlla le prime {Math.min(3, withFileCount)} fatture
            </>
          )}
        </button>
      </div>

      {/* Risultato cumulativo */}
      {bulkResult && (
        <div className="rounded-xl border border-app-line-22 bg-transparent p-4 text-sm">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold text-app-fg">
              {bulkResult.approved} di {bulkResult.total} fatture approvate in questo gruppo
            </span>
          </div>
          {bulkResult.failed.length > 0 && (
            <div className="mt-2 space-y-1">
              {bulkResult.failed.map((f) => (
                <div key={f.id} className="text-amber-300">
                  <strong>Non superata:</strong> {f.motivazione}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista fatture */}
      <div className="space-y-3">
        {rows.map((f) => {
          const isCheckAi = aiCheckState?.id === f.id
          const isBulkProcessing = bulkCurrentId === f.id && bulkChecking
          const cardHighlight = isBulkProcessing
            ? 'border-cyan-500/50 bg-cyan-500/[0.04] ring-1 ring-cyan-500/20'
            : 'border-app-line-22 bg-transparent'

          return (
            <div
              key={f.id}
              className={`rounded-2xl border p-5 transition-all ${cardHighlight} ${isCheckAi && aiCheckState?.status === 'approved' ? 'opacity-50' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isBulkProcessing && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    )}
                    <p className="truncate font-bold text-app-fg">
                      {f.fornitoreNome ?? 'Fornitore sconosciuto'}
                    </p>
                    {f.sedeNome && (
                      <span className="rounded-full border border-app-line-20 bg-transparent px-2 py-0.5 text-[10px] font-semibold text-app-fg-subtle">
                        {f.sedeNome}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-app-fg-subtle">
                    <span>{fmtDate(f.data)}</span>
                    {f.numero_fattura && <span>N° {f.numero_fattura}</span>}
                    {f.approval_threshold != null && (
                      <span className="text-amber-300">
                        {t.appStrings.approvazioni_threshold} {fmt(f.approval_threshold)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="font-mono text-lg font-bold tabular-nums text-app-fg">
                    {fmt(f.importo)}
                  </p>
                  {f.file_url?.trim() ? (
                    <OpenDocumentInAppButton
                      fatturaId={f.id}
                      fileUrl={f.file_url}
                      className="text-[10px] text-app-fg-subtle underline underline-offset-2 hover:text-app-fg"
                      title={t.appStrings.approvazioni_viewInvoice}
                    >
                      {t.appStrings.approvazioni_viewInvoice}
                    </OpenDocumentInAppButton>
                  ) : (
                    <ReturnToLink
                      to={`/fatture/${f.id}`}
                      from="/approvazioni"
                      className="text-[10px] text-app-fg-subtle underline underline-offset-2 hover:text-app-fg"
                    >
                      {t.appStrings.approvazioni_viewInvoice}
                    </ReturnToLink>
                  )}
                </div>
              </div>

              {isCheckAi && aiCheckState?.status === 'checking' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                  <span className="text-sm text-cyan-300">{t.appStrings.approvazioni_checkingAi}</span>
                </div>
              )}
              {isCheckAi && aiCheckState?.status === 'failed' && (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                  <strong>{t.appStrings.approvazioni_checkFailed}:</strong> {aiCheckState.message}
                </div>
              )}
              {isCheckAi && aiCheckState?.status === 'approved' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-emerald-300">{t.appStrings.approvazioni_checkApproved}</span>
                </div>
              )}

              {rejectState?.id === f.id && !isCheckAi && (
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-semibold text-app-fg-muted">
                    {t.appStrings.approvazioni_rejectReason}
                  </label>
                  <input
                    type="text"
                    value={rejectState.reason}
                    onChange={(e) => setRejectState({ id: f.id, reason: e.target.value })}
                    placeholder={t.appStrings.approvazioni_rejectPlaceholder}
                    className="w-full rounded-xl border border-app-line-28 bg-transparent px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-placeholder focus:border-[rgba(34,211,238,0.15)] focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                    autoFocus
                  />
                </div>
              )}

              {(!isCheckAi || aiCheckState?.status !== 'approved') && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {rejectState?.id !== f.id && !isCheckAi && (
                    <button
                      type="button"
                      disabled={actionPending === f.id || !f.file_url?.trim()}
                      onClick={() => void handleCheckAndApprove(f.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50"
                      title={!f.file_url?.trim() ? 'Nessun file allegato' : undefined}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Controlla e approva (AI)
                    </button>
                  )}

                  {isCheckAi && aiCheckState?.status === 'checking' && (
                    <button
                      type="button"
                      disabled
                      className="flex items-center gap-1.5 rounded-xl bg-cyan-500/30 px-4 py-2 text-sm font-semibold text-cyan-300 opacity-60"
                    >
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                      Controllo in corso...
                    </button>
                  )}

                  {isCheckAi && aiCheckState?.status === 'failed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAiCheckState(null)}
                        className="flex items-center gap-1.5 rounded-xl border border-app-line-25 px-3 py-2 text-sm text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
                      >
                        Chiudi
                      </button>
                      <button
                        type="button"
                        disabled={actionPending === f.id}
                        onClick={() => void handleAction(f.id, 'approve')}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {actionPending === f.id ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {t.appStrings.approvazioni_approve}
                      </button>
                    </>
                  )}

                  {!isCheckAi && rejectState?.id !== f.id && (
                    <>
                      <button
                        type="button"
                        disabled={actionPending === f.id}
                        onClick={() => void handleAction(f.id, 'approve')}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {actionPending === f.id ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {t.appStrings.approvazioni_approve}
                      </button>
                      <button
                        type="button"
                        disabled={actionPending === f.id}
                        onClick={() => setRejectState({ id: f.id, reason: '' })}
                        className="flex items-center gap-1.5 rounded-xl border border-rose-400/45 bg-transparent px-4 py-2 text-sm font-semibold text-rose-300 transition-colors hover:border-rose-300/70 hover:bg-rose-500/15 disabled:opacity-50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {t.appStrings.approvazioni_reject}
                      </button>
                    </>
                  )}

                  {rejectState?.id === f.id && !isCheckAi && (
                    <>
                      <button
                        type="button"
                        disabled={actionPending === f.id}
                        onClick={() => void handleAction(f.id, 'reject', rejectState.reason)}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-600 disabled:opacity-50"
                      >
                        {actionPending === f.id ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        {t.appStrings.approvazioni_confirmReject}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectState(null)}
                        className="rounded-xl border border-app-line-25 px-3 py-2 text-sm text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
                      >
                        {t.common.cancel}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
