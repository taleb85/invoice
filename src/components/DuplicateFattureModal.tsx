'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useToast } from '@/lib/toast-context'
import { useLocale } from '@/lib/locale-context'
import { formatCurrency, formatDate as formatAppDisplayDate } from '@/lib/locale-shared'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import type {
  DuplicateFatturaReportGroup,
  DuplicateFatturaReportRow,
  DuplicateFatturaScanProgressItem,
} from '@/lib/duplicate-fatture-report'
import {
  type ApiOk,
  type DupModalOcrPreview,
  patchFatturaRowInDuplicateData,
  fetchDupModalOcrPreviewFromApi,
  duplicateModalSupplierNameLikelyMismatch,
  readDuplicateReportNdjsonStream,
  resolveGroupSedeId,
} from '@/lib/duplicate-fatture-modal-utils'

type Props = {
  open: boolean
  onClose: () => void
  onRefresh: () => void
}

export default function DuplicateFattureModal({ open, onClose, onRefresh }: Props) {
  const t = useT()
  const { showToast } = useToast()
  const { locale, timezone, currency } = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiOk | null>(null)
  const [mounted, setMounted] = useState(false)
  const [scanElapsedSec, setScanElapsedSec] = useState(0)
  const [progressScanned, setProgressScanned] = useState(0)
  const [progressSample, setProgressSample] = useState<DuplicateFatturaScanProgressItem[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [canReassignSupplier, setCanReassignSupplier] = useState(false)
  const [fornitoriBySede, setFornitoriBySede] = useState<Record<string, { id: string; nome: string }[]>>({})
  const [reassignSel, setReassignSel] = useState<Record<string, string>>({})
  const [reassignBusyId, setReassignBusyId] = useState<string | null>(null)
  const [ocrPreviewById, setOcrPreviewById] = useState<Record<string, DupModalOcrPreview>>({})
  const [ocrBusyPreviewId, setOcrBusyPreviewId] = useState<string | null>(null)
  const [ocrBusyApplyId, setOcrBusyApplyId] = useState<string | null>(null)
  const [ocrGroupRunning, setOcrGroupRunning] = useState(false)
  const [ocrGroupProgress, setOcrGroupProgress] = useState<{ done: number; total: number } | null>(null)
  const [selectedFatturaIds, setSelectedFatturaIds] = useState<Record<string, true>>({})
  const abortRef = useRef<AbortController | null>(null)
  const fattureByIdMapRef = useRef<Record<string, DuplicateFatturaReportRow>>({})

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

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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

  const pruneDeletedFattura = useCallback((fatturaIds: string | string[]) => {
    const ids = Array.isArray(fatturaIds) ? fatturaIds : [fatturaIds]
    if (!ids.length) return
    const idSet = new Set(ids)
    setData((prev) => {
      if (!prev) return prev
      const groups = prev.groups
        .map((g) => ({ ...g, fatture: g.fatture.filter((f) => !idSet.has(f.id)) }))
        .filter((g) => g.fatture.length >= 2)
      return { ...prev, groups }
    })
  }, [])

  useEffect(() => {
    if (!open) {
      setCanReassignSupplier(false)
      setFornitoriBySede({})
      setReassignSel({})
      setReassignBusyId(null)
      setOcrPreviewById({})
      setOcrBusyPreviewId(null)
      setOcrBusyApplyId(null)
      setOcrGroupRunning(false)
      setOcrGroupProgress(null)
      setSelectedFatturaIds({})
    }
  }, [open])

  useEffect(() => {
    if (!open || !data?.groups.length || loading) return
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const meRes = await fetch('/api/me', { credentials: 'include' })
      if (!meRes.ok || cancelled) return
      const me = (await meRes.json()) as {
        is_admin?: boolean
        is_admin_sede?: boolean
      }
      const can =
        Boolean(me.is_admin) || Boolean(me.is_admin_sede)
      if (cancelled) return
      setCanReassignSupplier(can)
      if (!can) return

      const sedeIds = [
        ...new Set(data.groups.map(resolveGroupSedeId).filter((sid): sid is string => Boolean(sid))),
      ]
      if (sedeIds.length === 0) return

      const batches = await Promise.all(
        sedeIds.map(async (sid) => {
          const { data: rows, error } = await supabase
            .from('fornitori')
            .select('id, nome')
            .eq('sede_id', sid)
            .order('nome')
          if (cancelled) return { sid, rows: [] as { id: string; nome: string }[] }
          if (!error && rows?.length) return { sid, rows: rows as { id: string; nome: string }[] }
          return { sid, rows: [] as { id: string; nome: string }[] }
        }),
      )
      if (cancelled) return
      setFornitoriBySede((prev) => {
        const next = { ...prev }
        for (const { sid, rows } of batches) next[sid] = rows
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [open, data, loading])

  const handleReassignFornitore = useCallback(
    async (fatturaId: string, sedeScopeId: string | null) => {
      const nuovo = reassignSel[fatturaId]?.trim()
      if (!nuovo) {
        showToast(t.dashboard.duplicateFattureReassignNeedChoice, 'info')
        return
      }
      if (!sedeScopeId) {
        showToast(t.dashboard.duplicateFattureError, 'error')
        return
      }
      setReassignBusyId(fatturaId)
      try {
        const res = await fetch('/api/fatture/reassign-fornitore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fattura_id: fatturaId,
            nuovo_fornitore_id: nuovo,
            sede_id: sedeScopeId,
          }),
        })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? t.dashboard.duplicateFattureError)
        pruneDeletedFattura(fatturaId)
        setReassignSel((s) => {
          const next = { ...s }
          delete next[fatturaId]
          return next
        })
        onRefresh()
      } catch (e) {
        showToast(e instanceof Error ? e.message : t.dashboard.duplicateFattureError, 'error')
      } finally {
        setReassignBusyId(null)
      }
    },
    [pruneDeletedFattura, reassignSel, onRefresh, showToast, t.dashboard.duplicateFattureError, t.dashboard.duplicateFattureReassignNeedChoice],
  )

  const handleDupModalOcrPreview = useCallback(
    async (fatturaId: string) => {
      setOcrBusyPreviewId(fatturaId)
      try {
        const pv = await fetchDupModalOcrPreviewFromApi(fatturaId, t.dashboard.duplicateFattureError)
        setOcrPreviewById((p) => ({ ...p, [fatturaId]: pv }))
      } catch (e) {
        showToast(e instanceof Error ? e.message : t.dashboard.duplicateFattureError, 'error')
      } finally {
        setOcrBusyPreviewId(null)
      }
    },
    [showToast, t.dashboard.duplicateFattureError],
  )

  const applyDupModalOcrOnce = useCallback(
    async (fatturaId: string, pv: DupModalOcrPreview): Promise<boolean> => {
      const updates: { data?: string; importo?: number; numero_fattura?: string | null } = {}
      if (pv.diff.data && pv.read.data) updates.data = pv.read.data
      if (pv.diff.importo && pv.read.importo != null) updates.importo = pv.read.importo
      if (pv.diff.numero_fattura && pv.read.numero_fattura != null) {
        updates.numero_fattura = pv.read.numero_fattura
      }
      if (Object.keys(updates).length === 0) return false

      const res = await fetch('/api/fatture/ocr-sync-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fattura_id: fatturaId, phase: 'apply', updates }),
      })
      const j = (await res.json()) as {
        error?: string
        applied?: { data?: string; importo?: number; numero_fattura?: string | null }
      }
      if (!res.ok) throw new Error(j.error ?? t.dashboard.duplicateFattureError)
      const applied = j.applied ?? {}
      setData((prev) =>
        patchFatturaRowInDuplicateData(prev, fatturaId, {
          ...(applied.data !== undefined ? { data: String(applied.data) } : {}),
          ...(applied.importo !== undefined ? { importo: Number(applied.importo) } : {}),
          ...(applied.numero_fattura !== undefined
            ? { numero_fattura: applied.numero_fattura }
            : {}),
        }),
      )
      setOcrPreviewById((p) => {
        const next = { ...p }
        delete next[fatturaId]
        return next
      })
      return true
    },
    [t.dashboard.duplicateFattureError],
  )

  const handleDupModalOcrApply = useCallback(
    async (fatturaId: string, pv: DupModalOcrPreview) => {
      setOcrBusyApplyId(fatturaId)
      try {
        const applied = await applyDupModalOcrOnce(fatturaId, pv)
        if (!applied) {
          showToast(t.dashboard.duplicateFattureOcrNoChangesToSave, 'info')
          return
        }
        onRefresh()
        showToast(
          `${t.dashboard.duplicateFattureOcrSavedMsg}\n\n${t.dashboard.duplicateFattureOcrRescanHint}`,
          'success',
        )
      } catch (e) {
        showToast(e instanceof Error ? e.message : t.dashboard.duplicateFattureError, 'error')
      } finally {
        setOcrBusyApplyId(null)
      }
    },
    [applyDupModalOcrOnce, onRefresh, showToast, t.dashboard.duplicateFattureError, t.dashboard.duplicateFattureOcrNoChangesToSave, t.dashboard.duplicateFattureOcrRescanHint, t.dashboard.duplicateFattureOcrSavedMsg],
  )

  const handleOcrGroup = useCallback(
    async (groupFattureIds: string[]) => {
      const withAttachments = groupFattureIds.filter((id) => !!fattureByIdMapRef.current?.[id]?.file_url?.trim())
      if (withAttachments.length === 0) return
      setOcrGroupRunning(true)
      setOcrGroupProgress({ done: 0, total: withAttachments.length })
      const CONCURRENCY = 3
      const runBatch = async (batch: string[]) => {
        await Promise.all(
          batch.map(async (id) => {
            try {
              const pv = await fetchDupModalOcrPreviewFromApi(id, t.dashboard.duplicateFattureError)
              setOcrPreviewById((prev) => ({ ...prev, [id]: pv }))
            } catch {
            }
          }),
        )
      }
      for (let i = 0; i < withAttachments.length; i += CONCURRENCY) {
        const batch = withAttachments.slice(i, i + CONCURRENCY)
        await runBatch(batch)
        setOcrGroupProgress({ done: Math.min(i + CONCURRENCY, withAttachments.length), total: withAttachments.length })
      }
      setOcrGroupRunning(false)
      setOcrGroupProgress(null)
    },
    [t.dashboard.duplicateFattureError],
  )

  const toggleFatturaSelection = useCallback((id: string) => {
    setSelectedFatturaIds((prev) => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
      } else {
        next[id] = true as const
      }
      return next
    })
  }, [])

  const toggleGroupSelection = useCallback((fattureIds: string[]) => {
    setSelectedFatturaIds((prev) => {
      const allSelected = fattureIds.every((id) => prev[id])
      const next = { ...prev }
      if (allSelected) {
        fattureIds.forEach((id) => delete next[id])
      } else {
        fattureIds.forEach((id) => {
          next[id] = true as const
        })
      }
      return next
    })
  }, [])

  const handleFixSupplier = useCallback(
    async (fatturaIds: string[], suggestedRagioneSociale: string | null, sedeScopeId: string | null) => {
      if (!suggestedRagioneSociale?.trim() || !fatturaIds.length) return
      const normalized = suggestedRagioneSociale.trim().toLowerCase()
      let fornitoreId: string | null = null
      for (const [, vendors] of Object.entries(fornitoriBySede)) {
        const match = vendors.find(
          (v) => v.nome.trim().toLowerCase() === normalized,
        )
        if (match) {
          fornitoreId = match.id
          break
        }
      }
      if (!fornitoreId) {
        if (!sedeScopeId) {
          for (const fid of fatturaIds) setReassignSel((prev) => ({ ...prev, [fid]: '' }))
          return
        }
        setReassignBusyId(fatturaIds.join(','))
        try {
          const createRes = await fetch('/api/fornitori', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              nome: suggestedRagioneSociale.trim(),
              sede_id: sedeScopeId,
            }),
          })
          const createBody = (await createRes.json()) as {
            fornitore?: { id: string; nome: string }
            error?: string
          }
          if (!createRes.ok) throw new Error(createBody.error ?? t.dashboard.duplicateFattureError)
          fornitoreId = createBody.fornitore!.id
          setFornitoriBySede((prev) => {
            const existing = prev[sedeScopeId] ?? []
            if (existing.some((v) => v.id === fornitoreId)) return prev
            return {
              ...prev,
              [sedeScopeId]: [
                ...existing,
                { id: fornitoreId!, nome: suggestedRagioneSociale.trim() },
              ],
            }
          })
        } catch (e) {
          showToast(e instanceof Error ? e.message : t.dashboard.duplicateFattureError, 'error')
          setReassignBusyId(null)
          return
        }
      }
      if (!sedeScopeId) return
      setReassignBusyId(fornitoreId)
      const errors: string[] = []
      for (const fid of fatturaIds) {
        try {
          const res = await fetch('/api/fatture/reassign-fornitore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              fattura_id: fid,
              nuovo_fornitore_id: fornitoreId,
              sede_id: sedeScopeId,
            }),
          })
          const j = (await res.json()) as { error?: string }
          if (!res.ok) {
            errors.push(`${fid}: ${j.error ?? t.dashboard.duplicateFattureError}`)
          }
        } catch (e) {
          errors.push(`${fid}: ${e instanceof Error ? e.message : t.dashboard.duplicateFattureError}`)
        }
      }
      setReassignBusyId(null)
      if (errors.length) {
        showToast(errors.join('\n'), 'error')
        return
      }
      pruneDeletedFattura(fatturaIds)
      setReassignSel((s) => {
        const next = { ...s }
        for (const fid of fatturaIds) delete next[fid]
        return next
      })
      onRefresh()
    },
    [fornitoriBySede, showToast, t, onRefresh, pruneDeletedFattura],
  )

  const dupModalBusy =
    deletingId !== null ||
    reassignBusyId !== null ||
    ocrBusyPreviewId !== null ||
    ocrBusyApplyId !== null ||
    ocrGroupRunning

  const handleDeleteDuplicate = useCallback(
    async (event: React.MouseEvent, fatturaId: string) => {
      event.preventDefault()
      event.stopPropagation()
      if (!window.confirm(t.dashboard.duplicateFattureDeleteConfirm)) return
      setDeletingId(fatturaId)
      const { error } = await createClient().from('fatture').delete().eq('id', fatturaId)
      setDeletingId(null)
      if (error) {
        showToast(`${t.appStrings.deleteFailed} ${error.message}`, 'error')
        return
      }
      pruneDeletedFattura(fatturaId)
      onRefresh()
    },
    [pruneDeletedFattura, onRefresh, showToast, t.appStrings.deleteFailed, t.dashboard.duplicateFattureDeleteConfirm],
  )

  const runScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    setData(null)
    setProgressScanned(0)
    setProgressSample([])
    setOcrPreviewById({})
    setSelectedFatturaIds({})
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
      const result = await readDuplicateReportNdjsonStream(res, signal, ({ scannedSoFar, sample }) => {
        setProgressScanned(scannedSoFar)
        setProgressSample(sample)
      })
      if (signal.aborted) return
      setData(result)
      fattureByIdMapRef.current = {}
      for (const g of result.groups) {
        for (const f of g.fatture) {
          fattureByIdMapRef.current[f.id] = f
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : t.dashboard.duplicateFattureError)
    } finally {
      setLoading(false)
    }
  }, [t.dashboard.duplicateFattureError])

  useEffect(() => {
    if (!open) return
    void runScan()
  }, [open, runScan])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center app-workspace-inset-bg app-aurora-modal-overlay p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-fatture-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] app-workspace-surface-elevated shadow-[0_0_40px_-12px_rgba(245,158,11,0.35)]">
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
            onClick={onClose}
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
                <p className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
                  {t.dashboard.duplicateFattureTruncated}
                </p>
              ) : null}

              {data.groups.map((g) => {
                const groupSedeId = resolveGroupSedeId(g)
                const showReassign = canReassignSupplier && Boolean(groupSedeId)
                const vendorList = groupSedeId ? fornitoriBySede[groupSedeId] : undefined
                return (
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                        {t.dashboard.duplicateFattureGroupCount.replace('{n}', String(g.fatture.length))}
                      </span>
                      <button
                        type="button"
                        disabled={ocrGroupRunning || dupModalBusy}
                        onClick={() => void handleOcrGroup(g.fatture.map((ff) => ff.id))}
                        className="rounded-md border border-violet-400/35 bg-violet-950/35 px-2 py-0.5 text-[10px] font-semibold text-violet-100 hover:bg-violet-950/55 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {ocrGroupRunning && ocrGroupProgress
                          ? t.dashboard.duplicateFattureOcrGroupProgress
                              .replace('{done}', String(ocrGroupProgress.done))
                              .replace('{total}', String(ocrGroupProgress.total))
                          : t.dashboard.duplicateFattureOcrGroupBtn}
                      </button>
                    </div>
                  </div>
                  <p className="mb-2 text-[11px] text-app-fg-muted">
                    {g.sede_nome ?? t.dashboard.duplicateFattureSedeUnassigned}
                  </p>
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] text-app-fg-muted hover:text-app-fg transition-colors">
                    <input
                      type="checkbox"
                      checked={g.fatture.every((ff) => selectedFatturaIds[ff.id])}
                      onChange={() => toggleGroupSelection(g.fatture.map((ff) => ff.id))}
                      className="h-3.5 w-3.5 accent-cyan-500"
                    />
                    {t.dashboard.duplicateFattureSelectAll}
                  </label>
                  {showReassign ? (
                    <p className="mb-2 rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-2.5 py-2 text-[11px] leading-snug text-cyan-100/90">
                      {t.dashboard.duplicateFattureWrongSupplierHint}
                    </p>
                  ) : null}
                  <ul className="flex flex-col gap-1.5">
                    {g.fatture.map((f) => (
                      <li key={f.id} className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/[0.14] p-2">
                        <div className="flex items-stretch gap-2">
                        <label className="flex shrink-0 items-center self-stretch">
                          <input
                            type="checkbox"
                            checked={!!selectedFatturaIds[f.id]}
                            onChange={() => toggleFatturaSelection(f.id)}
                            className="h-4 w-4 accent-cyan-500"
                            disabled={dupModalBusy}
                            aria-label={f.id.slice(0, 8)}
                          />
                        </label>
                        {f.file_url ? (
                          <OpenDocumentInAppButton
                            fatturaId={f.id}
                            fileUrl={f.file_url}
                            title={t.bolle.viewDocument}
                            className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg border border-app-soft-border bg-cyan-950/20 px-2.5 py-2 text-left text-xs transition-colors hover:border-app-a-40 hover:bg-cyan-950/35 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
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
                          </OpenDocumentInAppButton>
                        ) : (
                          <Link
                            href={`/fatture/${f.id}`}
                            className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg border border-app-soft-border bg-cyan-950/20 px-2.5 py-2 text-xs transition-colors hover:border-app-a-40 hover:bg-cyan-950/35 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                            onClick={onClose}
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
                        )}
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-950/35 px-2.5 py-2 text-red-200 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-950/55 disabled:cursor-not-allowed disabled:opacity-45"
                          aria-label={t.dashboard.duplicateFattureDeleteAria}
                          title={t.common.delete}
                          disabled={dupModalBusy}
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
                        </div>
                        {showReassign ? (
                          vendorList === undefined ? (
                            <p className="text-[10px] text-app-fg-muted">{t.common.loading}</p>
                          ) : vendorList.length === 0 ? (
                            <p className="text-[10px] text-app-fg-muted">{t.dashboard.duplicateFattureReassignNoSuppliers}</p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
                              <button
                                type="button"
                                disabled={dupModalBusy}
                                onClick={() => {
                                  const sel = document.getElementById(`reassign-select-${CSS.escape(f.id)}`)
                                  sel?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  if (sel instanceof HTMLElement) setTimeout(() => sel.focus(), 300)
                                }}
                                className="shrink-0 rounded-md border border-cyan-500/25 bg-cyan-950/25 px-2 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-950/45 disabled:opacity-40"
                              >
                                {t.dashboard.duplicateFattureNotDuplicateBtn}
                              </button>
                              <select
                                id={`reassign-select-${CSS.escape(f.id)}`}
                                className="min-w-[11rem] flex-1 rounded-md border border-white/15 bg-black/35 px-2 py-1.5 text-[11px] text-app-fg"
                                value={reassignSel[f.id] ?? ''}
                                onChange={(e) =>
                                  setReassignSel((s) => ({ ...s, [f.id]: e.target.value }))
                                }
                                disabled={dupModalBusy}
                                aria-label={t.dashboard.duplicateFattureReassignSelectPlaceholder}
                              >
                                <option value="">{t.dashboard.duplicateFattureReassignSelectPlaceholder}</option>
                                {vendorList.map((fo) => (
                                  <option key={fo.id} value={fo.id}>
                                    {fo.nome?.trim() || fo.id.slice(0, 8)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={
                                  dupModalBusy ||
                                  !(reassignSel[f.id] ?? '').trim()
                                }
                                onClick={() => void handleReassignFornitore(f.id, groupSedeId ?? null)}
                                className="rounded-md border border-teal-500/45 bg-teal-600/30 px-2.5 py-1.5 text-[11px] font-semibold text-teal-50 hover:bg-teal-600/45 disabled:opacity-40"
                              >
                                {reassignBusyId === f.id
                                  ? t.dashboard.duplicateFattureReassignBusy
                                  : t.dashboard.duplicateFattureReassignApply}
                              </button>
                            </div>
                          )
                        ) : null}
                        {f.file_url?.trim() ? (
                          <div className="space-y-2 border-t border-white/10 pt-2">
                            <button
                              type="button"
                              title={t.dashboard.duplicateFattureOcrRereadTitle}
                              disabled={dupModalBusy}
                              onClick={() => void handleDupModalOcrPreview(f.id)}
                              className="rounded-md border border-violet-400/35 bg-violet-950/35 px-2 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-950/55 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {ocrBusyPreviewId === f.id
                                ? t.dashboard.duplicateFattureOcrAnalyzing
                                : t.dashboard.duplicateFattureOcrRereadBtn}
                            </button>
                            {(() => {
                              const pv = ocrPreviewById[f.id]
                              if (!pv) return null
                              const archivedNomeRow =
                                f.fornitore?.nome ?? g.fornitore_nome ?? ''
                              const supplierMismatch =
                                !pv.hasChanges &&
                                duplicateModalSupplierNameLikelyMismatch(
                                  archivedNomeRow,
                                  pv.read.ragione_sociale,
                                )
                              const fmtAmt = (n: number | null) =>
                                n != null && Number.isFinite(n)
                                  ? formatCurrency(n, currency, locale)
                                  : '—'
                              const docDt = (ymd: string | null | undefined) =>
                                ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? formatDate(ymd) : '—'
                              const fmtDoc = (s: string | null) => (s?.trim() ? s : '—')
                              return (
                                <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 px-2 py-2 text-[13px] text-app-fg-muted">
                                  <p className="font-semibold text-violet-100/95">
                                    {t.dashboard.duplicateFattureOcrPreviewHeading}
                                  </p>
                                  <div className="mt-2 grid grid-cols-[minmax(0,7rem)_1fr_1fr] gap-x-2 gap-y-1 text-[12px] items-start">
                                    <div />
                                    <div className="font-semibold text-app-fg-muted/90">
                                      {t.dashboard.duplicateFattureOcrLabelArchived}
                                    </div>
                                    <div className="font-semibold text-app-fg-muted/90">
                                      {t.dashboard.duplicateFattureOcrLabelFromPdf}
                                    </div>
                                    <div className="text-app-fg-muted/85">
                                      {t.dashboard.duplicateFattureOcrFieldDate}
                                    </div>
                                    <div>{docDt(pv.current.data)}</div>
                                    <div className={pv.diff.data ? 'font-semibold text-amber-200' : ''}>
                                      {docDt(pv.read.data)}
                                    </div>
                                    <div className="text-app-fg-muted/85">
                                      {t.dashboard.duplicateFattureOcrFieldAmount}
                                    </div>
                                    <div>{fmtAmt(pv.current.importo)}</div>
                                    <div
                                      className={pv.diff.importo ? 'font-semibold text-amber-200' : ''}
                                    >
                                      {fmtAmt(pv.read.importo)}
                                    </div>
                                    <div className="text-app-fg-muted/85">
                                      {t.dashboard.duplicateFattureOcrFieldNumber}
                                    </div>
                                    <div className="break-all">{fmtDoc(pv.current.numero_fattura)}</div>
                                    <div
                                      className={
                                        pv.diff.numero_fattura
                                          ? 'break-all font-semibold text-amber-200'
                                          : 'break-all'
                                      }
                                    >
                                      {fmtDoc(pv.read.numero_fattura)}
                                    </div>
                                  </div>
                                  {pv.read.ragione_sociale?.trim() ||
                                  pv.read.tipo_documento?.trim() ||
                                  pv.read.importo_raw?.trim() ? (
                                    <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-[12px] text-app-fg-muted/90">
                                      {pv.read.ragione_sociale?.trim() ? (
                                        <p>
                                          <span className="text-app-fg-muted/75">
                                            {t.dashboard.duplicateFattureOcrSupplierHint}:{' '}
                                          </span>
                                          {pv.read.ragione_sociale.trim()}
                                        </p>
                                      ) : null}
                                      {pv.read.tipo_documento?.trim() ? (
                                        <p>
                                          <span className="text-app-fg-muted/75">
                                            {t.dashboard.duplicateFattureOcrTipoHint}:{' '}
                                          </span>
                                          {pv.read.tipo_documento.trim()}
                                        </p>
                                      ) : null}
                                      {pv.read.importo_raw?.trim() ? (
                                        <p>
                                          <span className="text-app-fg-muted/75">
                                            {t.dashboard.duplicateFattureOcrImportoRaw}:{' '}
                                          </span>
                                          <span className="font-mono">{pv.read.importo_raw.trim()}</span>
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  {!pv.hasChanges ? (
                                    supplierMismatch ? (
                                      <>
                                        <p className="mt-2 text-[12px] text-amber-200/95">
                                          {t.dashboard.duplicateFattureOcrSupplierMismatchInline}
                                        </p>
                                        {pv.read.ragione_sociale?.trim() ? (
                                          <button
                                            type="button"
                                            disabled={dupModalBusy}
                                            onClick={() => {
                                              const suggested = pv.read.ragione_sociale!.trim().toLowerCase()
                                              const allMatching = g.fatture
                                                .filter((ff) => {
                                                  const pp = ocrPreviewById[ff.id]
                                                  return pp?.read.ragione_sociale?.trim().toLowerCase() === suggested
                                                })
                                                .map((ff) => ff.id)
                                              handleFixSupplier(allMatching, pv.read.ragione_sociale!.trim(), groupSedeId ?? null)
                                            }}
                                            className="mt-1 rounded-md border border-teal-500/35 bg-teal-950/30 px-2 py-1 text-[12px] font-semibold text-teal-100 hover:bg-teal-950/50 disabled:opacity-40"
                                          >
                                            {t.dashboard.duplicateFattureFixSupplierBtn.replace('{name}', pv.read.ragione_sociale.trim())}
                                          </button>
                                        ) : null}
                                      </>
                                    ) : (
                                      <p className="mt-2 text-[12px] text-emerald-200/90">
                                        {t.dashboard.duplicateFattureOcrNoChangesToSave}
                                      </p>
                                    )
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        dupModalBusy ||
                                        !pv.hasChanges ||
                                        ocrBusyApplyId === f.id
                                      }
                                      onClick={() => void handleDupModalOcrApply(f.id, pv)}
                                      className="rounded-md border border-teal-500/45 bg-teal-600/35 px-2.5 py-1.5 text-[13px] font-semibold text-teal-50 hover:bg-teal-600/50 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {ocrBusyApplyId === f.id
                                        ? t.dashboard.duplicateFattureReassignBusy
                                        : t.dashboard.duplicateFattureOcrSaveBtn}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        ocrBusyApplyId === f.id || ocrBusyPreviewId !== null
                                      }
                                      onClick={() => {
                                        setOcrPreviewById((p) => {
                                          const next = { ...p }
                                          delete next[f.id]
                                          return next
                                        })
                                      }}
                                      className="rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-[13px] font-semibold text-app-fg-muted hover:bg-black/45 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {t.dashboard.duplicateFattureOcrDismissBtn}
                                    </button>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                )
              })}
            {Object.keys(selectedFatturaIds).length > 0 ? (
              <div className="sticky bottom-0 -mx-3 -mb-3 flex flex-wrap items-center gap-2 border-t border-cyan-500/25 bg-black/70 px-3 py-2 backdrop-blur-sm sm:-mx-4 sm:-mb-4 sm:px-4">
                <span className="text-[11px] font-semibold text-cyan-100">
                  {t.dashboard.duplicateFattureSelectionCount.replace('{n}', String(Object.keys(selectedFatturaIds).length))}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  disabled={dupModalBusy}
                  onClick={() => {
                    const ids = Object.keys(selectedFatturaIds)
                    const groupIds = data?.groups.flatMap((g) => g.fatture.map((f) => f.id)).filter((id) => ids.includes(id)) ?? []
                    void handleOcrGroup(groupIds)
                  }}
                  className="rounded-md border border-violet-400/35 bg-violet-950/35 px-2.5 py-1.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-950/55 disabled:opacity-40"
                >
                  {t.dashboard.duplicateFattureBatchOcr}
                </button>
                <button
                  type="button"
                  disabled={dupModalBusy}
                  onClick={() => {
                    const ids = Object.keys(selectedFatturaIds)
                    const groupSedeId = ids.length > 0 && data ? (() => {
                      for (const g of data.groups) {
                        for (const f of g.fatture) {
                          if (f.id === ids[0]) return g.sede_id ?? undefined
                        }
                      }
                      return undefined
                    })() : undefined
                    for (const id of ids) {
                      if (reassignSel[id]?.trim()) {
                        void handleReassignFornitore(id, groupSedeId ?? null)
                      }
                    }
                  }}
                  className="rounded-md border border-teal-500/35 bg-teal-950/35 px-2.5 py-1.5 text-[11px] font-semibold text-teal-100 hover:bg-teal-950/55 disabled:opacity-40"
                >
                  {t.dashboard.duplicateFattureReassignApply}
                </button>
              </div>
            ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
