'use client'

import { useState } from 'react'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import { useToast } from '@/lib/toast-context'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { BTN_SIZE_SM } from '@/lib/button-size-tokens'
import {
  applyFatturaRefreshOcrResponse,
  fetchFatturaRefreshFromOcr,
  type FatturaRefreshOcrCallbacks,
} from '@/lib/fattura-refresh-from-ocr-client'

export type FatturaRefreshBatchItem = {
  fatturaId: string
} & FatturaRefreshOcrCallbacks

type Props = {
  fatturaId?: string
  hasFile: boolean
  readOnly?: boolean
  /** Se presente, rilegge tutti i documenti in sequenza (toolbar elenco fornitore). */
  batch?: FatturaRefreshBatchItem[]
  onDataUpdated: (newIsoDate: string) => void
  onImportoUpdated?: (newImporto: number) => void
  onNumeroFatturaUpdated?: (newNumero: string) => void
  onTipoDocumentoUpdated?: (tipo: string) => void
  onLedgerMutated?: () => void
  className?: string
}

export default function FatturaRefreshDateButton({
  fatturaId,
  hasFile,
  readOnly,
  batch,
  onDataUpdated,
  onImportoUpdated,
  onNumeroFatturaUpdated,
  onTipoDocumentoUpdated,
  onLedgerMutated,
  className = '',
}: Props) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [batchIndex, setBatchIndex] = useState(0)

  const targets: FatturaRefreshBatchItem[] =
    batch && batch.length > 0
      ? batch
      : fatturaId
        ? [
            {
              fatturaId,
              onDataUpdated,
              onImportoUpdated,
              onNumeroFatturaUpdated,
              onTipoDocumentoUpdated,
            },
          ]
        : []

  if (readOnly || !hasFile || targets.length === 0) {
    return null
  }

  const isBatch = targets.length > 1
  const fmt = (iso: string) =>
    formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' })

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    setBatchIndex(0)
    let successCount = 0
    let errorCount = 0
    try {
      for (let i = 0; i < targets.length; i++) {
        setBatchIndex(i + 1)
        const target = targets[i]!
        const result = await fetchFatturaRefreshFromOcr(target.fatturaId)
        if (!result.ok) {
          errorCount++
          if (!isBatch) {
            showToast(result.body.error ?? t.ui.networkError, 'error')
          }
          continue
        }
        successCount++
        const j = result.body
        const changed = applyFatturaRefreshOcrResponse(j, target)
        if (changed && !isBatch) {
          onLedgerMutated?.()
        }
        if (!isBatch) {
          if (changed) {
            if (j.data_changed && j.data) {
              showToast(t.fatture.refreshDateFromDocSuccess.replace('{data}', fmt(j.data)), 'success')
            } else if (j.importo_changed) {
              showToast(t.fatture.refreshImportoFromDocSuccess, 'success')
            } else if (j.numero_fattura_changed) {
              showToast(t.fatture.refreshNumeroFatturaFromDocSuccess, 'success')
            }
          } else if (j.date_rejected && j.info) {
            showToast(j.info, 'info')
          } else {
            showToast(j.info ?? t.fatture.refreshDateFromDocUnchanged, 'info')
          }
        }
      }
      if (isBatch) {
        if (successCount > 0) onLedgerMutated?.()
        showToast(
          t.fatture.refreshAllFromDocDone
            .replace('{ok}', String(successCount))
            .replace('{total}', String(targets.length)),
          errorCount > 0 ? 'info' : successCount > 0 ? 'success' : 'info',
        )
        if (errorCount > 0) {
          showToast(t.fatture.refreshAllFromDocErrors.replace('{n}', String(errorCount)), 'error')
        }
      }
    } catch {
      showToast(t.ui.networkError, 'error')
    } finally {
      setLoading(false)
      setBatchIndex(0)
    }
  }

  const label = loading && isBatch
    ? `${batchIndex}/${targets.length}`
    : loading
      ? '…'
      : t.fatture.refreshDateFromDoc

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={isBatch ? t.fatture.refreshAllFromDocTitle : t.fatture.refreshDateFromDocTitle}
      className={`inline-flex shrink-0 items-center gap-1 border border-app-line-30 bg-app-line-10 text-app-fg-muted font-semibold transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:opacity-50 ${BTN_SIZE_SM} ${className}`}
    >
      {loading ? (
        <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent" />
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
