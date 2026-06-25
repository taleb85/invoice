'use client'

import { useState, useRef } from 'react'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import { useToast } from '@/lib/toast-context'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { BTN_SIZE_SM } from '@/lib/button-size-tokens'
import {
  runDocumentOcrRefresh,
  documentOcrRefreshTargetId,
  type DocumentOcrRefreshTarget,
} from '@/lib/document-refresh-from-ocr-client'
import type { FatturaRefreshOcrResponse } from '@/lib/fattura-refresh-from-ocr-client'

export type DocumentOcrRefreshBatchItem = DocumentOcrRefreshTarget

type Props = {
  hasFile: boolean
  readOnly?: boolean
  batch?: DocumentOcrRefreshBatchItem[]
  onLedgerMutated?: () => void
  /** Chiamato ad ogni cambio di riga durante l'elaborazione batch. */
  onProcessingChange?: (id: string | null) => void
  className?: string
}

function isFatturaBody(body: unknown): body is FatturaRefreshOcrResponse {
  return typeof body === 'object' && body != null && ('data_changed' in body || 'importo_changed' in body)
}

export default function DocumentOcrRefreshButton({
  hasFile,
  readOnly,
  batch,
  onLedgerMutated,
  onProcessingChange,
  className = '',
}: Props) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [batchIndex, setBatchIndex] = useState(0)
  const cancelledRef = useRef(false)

  const targets = batch ?? []

  if (readOnly || !hasFile || targets.length === 0) {
    return null
  }

  const isBatch = targets.length > 1
  const fmt = (iso: string) =>
    formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' })

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) {
      // Second click during loading → cancella
      cancelledRef.current = true
      onProcessingChange?.(null)
      setLoading(false)
      setBatchIndex(0)
      return
    }
    cancelledRef.current = false
    setLoading(true)
    setBatchIndex(0)
    let successCount = 0
    let errorCount = 0
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelledRef.current) break
        setBatchIndex(i + 1)
        const target = targets[i]!
        onProcessingChange?.(documentOcrRefreshTargetId(target))
        const result = await runDocumentOcrRefresh(target)
        if (!result.ok) {
          errorCount++
          const err =
            typeof result.body === 'object' && result.body && 'error' in result.body
              ? String((result.body as { error?: string }).error ?? '')
              : ''
          if (!isBatch) {
            showToast(err || t.ui.networkError, 'error')
          }
          continue
        }
        successCount++
        if (result.changed && !isBatch) {
          onLedgerMutated?.()
        }
        if (!isBatch) {
          if (target.kind === 'fattura' && isFatturaBody(result.body)) {
            const j = result.body
            if (j.fornitore_reassigned && j.nuovo_fornitore_nome) {
              showToast(
                t.fatture.refreshFornitoreReassignedFromDocSuccess.replace(
                  '{fornitore}',
                  j.nuovo_fornitore_nome,
                ),
                'success',
              )
            } else if (j.data_changed && j.data) {
              showToast(t.fatture.refreshDateFromDocSuccess.replace('{data}', fmt(j.data)), 'success')
            } else if (j.importo_changed) {
              showToast(t.fatture.refreshImportoFromDocSuccess, 'success')
            } else if (j.numero_fattura_changed) {
              showToast(t.fatture.refreshNumeroFatturaFromDocSuccess, 'success')
            } else if (j.date_rejected && j.info) {
              showToast(j.info, 'info')
            } else {
              showToast(j.info ?? t.fatture.refreshDateFromDocUnchanged, 'info')
            }
          } else if (result.changed) {
            const dateStr =
              typeof result.body === 'object' && result.body
                ? String(
                    (result.body as { data?: string; data_ordine?: string }).data
                      ?? (result.body as { data_ordine?: string }).data_ordine
                      ?? '',
                  )
                : ''
            showToast(
              dateStr
                ? t.fatture.refreshDateFromDocSuccess.replace('{data}', fmt(dateStr))
                : t.statements.reanalyzeDocSuccess,
              'success',
            )
          } else {
            const info =
              typeof result.body === 'object' && result.body && 'info' in result.body
                ? String((result.body as { info?: string }).info ?? '')
                : ''
            showToast(info || t.fatture.refreshDateFromDocUnchanged, 'info')
          }
        }
      }
      if (isBatch) {
        if (successCount > 0) onLedgerMutated?.()
        const cancelled = cancelledRef.current
        if (cancelled) {
          showToast(`Elaborazione interrotta: ${successCount} documenti riletti (su ${targets.length}).`, 'info')
        } else {
          showToast(
            t.fatture.refreshAllFromDocDone
              .replace('{ok}', String(successCount))
              .replace('{total}', String(targets.length)),
            errorCount > 0 ? 'info' : successCount > 0 ? 'success' : 'info',
          )
        }
        if (errorCount > 0) {
          showToast(t.fatture.refreshAllFromDocErrors.replace('{n}', String(errorCount)), 'error')
        }
      }
    } catch {
      showToast(t.ui.networkError, 'error')
    } finally {
      onProcessingChange?.(null)
      setLoading(false)
      setBatchIndex(0)
    }
  }

  const label =
    loading && isBatch
      ? targets[batchIndex - 1]?.numero
        ? `${batchIndex}/${targets.length} ${targets[batchIndex - 1]!.numero}`
        : `${batchIndex}/${targets.length}`
      : loading
        ? '…'
        : t.fatture.refreshDateFromDoc

  return (
    <button
      type="button"
      onClick={onClick}
      title={loading && isBatch ? 'Ferma elaborazione' : isBatch ? t.fatture.refreshAllFromDocTitle : t.fatture.refreshDateFromDocTitle}
      className={`inline-flex shrink-0 items-center gap-1 border font-semibold transition-colors disabled:opacity-50 ${BTN_SIZE_SM} ${className} ${
        loading && isBatch
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-500/60 hover:bg-rose-500/20'
          : 'border-app-line-30 bg-app-line-10 text-app-fg-muted hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200'
      }`}
    >
      {loading ? (
        isBatch ? (
          <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h12v12H6z" />
          </svg>
        ) : (
          <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent" />
        )
      ) : (
        <svg className={`h-3 w-3 shrink-0 ${icon.fatture}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
