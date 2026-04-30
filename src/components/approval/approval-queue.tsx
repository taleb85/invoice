'use client'

import { useEffect, useState, useCallback } from 'react'
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

export function ApprovalQueue() {
  const t = useT()
  const [rows, setRows] = useState<PendingApprovalFattura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [rejectState, setRejectState] = useState<RejectState | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/fatture/pending-approval')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Errore caricamento'))))
      .then((d: { rows: PendingApprovalFattura[] }) => setRows(d.rows))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

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
        // Optimistically remove from list
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

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-app-line-22 bg-[#0f172b]/60" />
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
        <p className="text-sm text-app-fg-muted">{t.appStrings.approvazioni_allReviewed}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((f) => (
        <div
          key={f.id}
          className="rounded-2xl border border-app-line-22 bg-[#0f172b]/80 p-5 transition-all hover:border-[rgba(34,211,238,0.15)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Info */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-bold text-app-fg">
                  {f.fornitoreNome ?? 'Fornitore sconosciuto'}
                </p>
                {f.sedeNome && (
                  <span className="rounded-full bg-app-line-15 px-2 py-0.5 text-[10px] font-semibold text-app-fg-muted">
                    {f.sedeNome}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-app-fg-muted">
                <span>{fmtDate(f.data)}</span>
                {f.numero_fattura && <span>N° {f.numero_fattura}</span>}
                {f.approval_threshold != null && (
                  <span className="text-amber-400/70">
                    {t.appStrings.approvazioni_threshold} {fmt(f.approval_threshold)}
                  </span>
                )}
              </div>
            </div>

            {/* Amount */}
            <div className="flex shrink-0 flex-col items-end gap-2">
              <p className="font-mono text-lg font-bold tabular-nums text-app-fg">
                {fmt(f.importo)}
              </p>
              {f.file_url?.trim() ? (
                <OpenDocumentInAppButton
                  fatturaId={f.id}
                  fileUrl={f.file_url}
                  className="text-[10px] text-app-fg-muted underline underline-offset-2 hover:text-app-fg"
                  title={t.appStrings.approvazioni_viewInvoice}
                >
                  {t.appStrings.approvazioni_viewInvoice}
                </OpenDocumentInAppButton>
              ) : (
                <ReturnToLink
                  to={`/fatture/${f.id}`}
                  from="/approvazioni"
                  className="text-[10px] text-app-fg-muted underline underline-offset-2 hover:text-app-fg"
                >
                  {t.appStrings.approvazioni_viewInvoice}
                </ReturnToLink>
              )}
            </div>
          </div>

          {/* Rejection reason input */}
          {rejectState?.id === f.id && (
            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-app-fg-muted">
                {t.appStrings.approvazioni_rejectReason}
              </label>
              <input
                type="text"
                value={rejectState.reason}
                onChange={(e) => setRejectState({ id: f.id, reason: e.target.value })}
                placeholder={t.appStrings.approvazioni_rejectPlaceholder}
                className="w-full rounded-xl border border-app-line-28 bg-transparent px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-muted focus:border-[rgba(34,211,238,0.15)] focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                autoFocus
              />
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {rejectState?.id === f.id ? (
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
            ) : (
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
                  className="flex items-center gap-1.5 rounded-xl border border-[rgba(34,211,238,0.15)] bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t.appStrings.approvazioni_reject}
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
