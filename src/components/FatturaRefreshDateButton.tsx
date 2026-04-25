'use client'

import { useState } from 'react'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import { useToast } from '@/lib/toast-context'

type Props = {
  fatturaId: string
  hasFile: boolean
  readOnly?: boolean
  onDataUpdated: (newIsoDate: string) => void
  onLedgerMutated?: () => void
  className?: string
}

export default function FatturaRefreshDateButton({
  fatturaId,
  hasFile,
  readOnly,
  onDataUpdated,
  onLedgerMutated,
  className = '',
}: Props) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  if (readOnly || !hasFile) {
    return null
  }

  const fmt = (iso: string) => formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' })

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/fatture/refresh-date-from-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fattura_id: fatturaId }),
        credentials: 'include',
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        ok?: boolean
        data?: string
        data_changed?: boolean
      }
      if (!res.ok) {
        showToast(j.error ?? t.ui.networkError, 'error')
        return
      }
      if (j.data) {
        onDataUpdated(j.data)
        onLedgerMutated?.()
        if (j.data_changed) {
          showToast(
            t.fatture.refreshDateFromDocSuccess.replace('{data}', fmt(j.data)),
            'success',
          )
        } else {
          showToast(t.fatture.refreshDateFromDocUnchanged, 'info')
        }
      }
    } catch {
      showToast(t.ui.networkError, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={t.fatture.refreshDateFromDocTitle}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-app-line-30 bg-app-line-10 px-2 py-1 text-[10px] font-semibold text-app-fg-muted transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-200 disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <span className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-current border-t-transparent" />
      ) : (
        <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      )}
      <span className="whitespace-nowrap">{loading ? '…' : t.fatture.refreshDateFromDoc}</span>
    </button>
  )
}
