'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'

type ApiOk = {
  ok: true
  groups: DuplicateFatturaReportGroup[]
  scannedRows: number
  truncated: boolean
}

type DupModalOcrPreview = {
  current: { data: string; importo: number | null; numero_fattura: string | null }
  read: {
    data: string | null
    importo: number | null
    numero_fattura: string | null
    ragione_sociale: string | null
    tipo_documento: string | null
    importo_raw: string | null
  }
  diff: { data: boolean; importo: boolean; numero_fattura: boolean }
  hasChanges: boolean
}

function patchFatturaRowInDuplicateData(
  prev: ApiOk | null,
  fatturaId: string,
  patch: { data?: string; importo?: number | null; numero_fattura?: string | null },
): ApiOk | null {
  if (!prev) return prev
  return {
    ...prev,
    groups: prev.groups.map((g) => ({
      ...g,
      fatture: g.fatture.map((row) => (row.id === fatturaId ? { ...row, ...patch } : row)),
    })),
  }
}

function fatturaIdsWithAttachments(groups: DuplicateFatturaReportGroup[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of groups) {
    for (const f of g.fatture) {
      if (!f.file_url?.trim()) continue
      if (seen.has(f.id)) continue
      seen.add(f.id)
      out.push(f.id)
    }
  }
  return out
}

async function fetchDupModalOcrPreviewFromApi(
  fatturaId: string,
  errorFallback: string,
): Promise<DupModalOcrPreview> {
  const res = await fetch('/api/fatture/ocr-sync-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ fattura_id: fatturaId, phase: 'preview' }),
  })
  const j = (await res.json()) as {
    error?: string
    current?: DupModalOcrPreview['current']
    read?: DupModalOcrPreview['read']
    diff?: DupModalOcrPreview['diff']
    hasChanges?: boolean
  }
  if (!res.ok) throw new Error(j.error ?? errorFallback)
  if (!j.current || !j.read || !j.diff) throw new Error(errorFallback)
  return {
    current: j.current,
    read: j.read,
    diff: j.diff,
    hasChanges: Boolean(j.hasChanges),
  }
}

function compactSupplierKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '')
}

/** Conservative check: OCR supplier label vs archive name differ materially. */
function duplicateModalSupplierNameLikelyMismatch(
  archivedNome: string | null | undefined,
  ocrRagioneSociale: string | null | undefined,
): boolean {
  const a = archivedNome?.trim()
  const p = ocrRagioneSociale?.trim()
  if (!a || !p || p.length < 5) return false
  const ca = compactSupplierKey(a)
  const cp = compactSupplierKey(p)
  if (!ca || !cp || ca === cp) return false
  if (ca.includes(cp) || cp.includes(ca)) return false
  const longTokens = (raw: string) =>
    raw
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 5)
  for (const t of longTokens(p)) {
    if (ca.includes(compactSupplierKey(t))) return false
  }
  for (const t of longTokens(a)) {
    if (cp.includes(compactSupplierKey(t))) return false
  }
  return true
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

import { BTN_SIZE_XS } from '@/lib/button-size-tokens'
import { BTN_SIZE_SM } from '@/lib/button-size-tokens'

const toolbarStripBtnCls =
  `inline-flex shrink-0 items-center gap-1 whitespace-nowrap border border-app-line-35 app-workspace-inset-bg text-app-fg font-semibold leading-none transition-colors hover:border-app-line-50 hover:brightness-110 ${BTN_SIZE_XS}`
const defaultBtnCls =
  `inline-flex items-center gap-1.5 whitespace-nowrap border border-[rgba(34,211,238,0.15)] bg-amber-950/35 text-amber-100 font-semibold transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-amber-950/55 ${BTN_SIZE_SM}`

function resolveGroupSedeId(g: DuplicateFatturaReportGroup): string | null {
  if (g.sede_id?.trim()) return g.sede_id.trim()
  const row = g.fatture.find((f) => f.sede_id?.trim())
  return row?.sede_id?.trim() ?? null
}

export default function DashboardDuplicateFattureButton({
  className,
  alwaysShowLabel = false,
  toolbarStrip = false,
}: {
  className?: string
  /** Come ScanEmail: mostra il testo anche su schermi stretti */
  alwaysShowLabel?: boolean
  /** Allinea alla fascia desktop: altezza `h-7`, testo 10–11px come sync / solleciti. */
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
  const [canReassignSupplier, setCanReassignSupplier] = useState(false)
  const [fornitoriBySede, setFornitoriBySede] = useState<Record<string, { id: string; nome: string }[]>>({})
  const [reassignSel, setReassignSel] = useState<Record<string, string>>({})
  const [reassignBusyId, setReassignBusyId] = useState<string | null>(null)
  const [ocrPreviewById, setOcrPreviewById] = useState<Record<string, DupModalOcrPreview>>({})
  const [ocrBusyPreviewId, setOcrBusyPreviewId] = useState<string | null>(null)
  const [ocrBusyApplyId, setOcrBusyApplyId] = useState<string | null>(null)
  const [bulkPdfOcrRunning, setBulkPdfOcrRunning] = useState(false)
  const [bulkPdfOcrProgress, setBulkPdfOcrProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkPdfOcrErrors, setBulkPdfOcrErrors] = useState<Record<string, string>>({})
  const [bulkApplyAllOcrBusy, setBulkApplyAllOcrBusy] = useState(false)
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

  useEffect(() => {
    if (!open) {
      setCanReassignSupplier(false)
      setFornitoriBySede({})
      setReassignSel({})
      setReassignBusyId(null)
      setOcrPreviewById({})
      setOcrBusyPreviewId(null)
      setOcrBusyApplyId(null)
      setBulkPdfOcrRunning(false)
      setBulkPdfOcrProgress(null)
      setBulkPdfOcrErrors({})
      setBulkApplyAllOcrBusy(false)
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
        is_admin_tecnico?: boolean
      }
      const can =
        Boolean(me.is_admin) || Boolean(me.is_admin_sede) || Boolean(me.is_admin_tecnico)
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
        window.alert(t.dashboard.duplicateFattureReassignNeedChoice)
        return
      }
      if (!sedeScopeId) {
        window.alert(t.dashboard.duplicateFattureError)
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
        router.refresh()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : t.dashboard.duplicateFattureError)
      } finally {
        setReassignBusyId(null)
      }
    },
    [
      pruneDeletedFattura,
      reassignSel,
      router,
      t.dashboard.duplicateFattureError,
      t.dashboard.duplicateFattureReassignNeedChoice,
    ],
  )

  const handleDupModalOcrPreview = useCallback(
    async (fatturaId: string) => {
      setOcrBusyPreviewId(fatturaId)
      try {
        const pv = await fetchDupModalOcrPreviewFromApi(fatturaId, t.dashboard.duplicateFattureError)
        setOcrPreviewById((p) => ({ ...p, [fatturaId]: pv }))
        setBulkPdfOcrErrors((prev) => {
          const next = { ...prev }
          delete next[fatturaId]
          return next
        })
      } catch (e) {
        window.alert(e instanceof Error ? e.message : t.dashboard.duplicateFattureError)
      } finally {
        setOcrBusyPreviewId(null)
      }
    },
    [t.dashboard.duplicateFattureError],
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
          window.alert(t.dashboard.duplicateFattureOcrNoChangesToSave)
          return
        }
        router.refresh()
        window.alert(
          `${t.dashboard.duplicateFattureOcrSavedMsg}\n\n${t.dashboard.duplicateFattureOcrRescanHint}`,
        )
      } catch (e) {
        window.alert(e instanceof Error ? e.message : t.dashboard.duplicateFattureError)
      } finally {
        setOcrBusyApplyId(null)
      }
    },
    [
      applyDupModalOcrOnce,
      router,
      t.dashboard.duplicateFattureError,
      t.dashboard.duplicateFattureOcrNoChangesToSave,
      t.dashboard.duplicateFattureOcrRescanHint,
      t.dashboard.duplicateFattureOcrSavedMsg,
    ],
  )

  const handleApplyAllDupModalOcr = useCallback(async () => {
    const snapshot = { ...ocrPreviewById }
    const entries = Object.entries(snapshot).filter(([, pv]) => pv.hasChanges)
    if (entries.length === 0) {
      window.alert(t.dashboard.duplicateFattureApplyAllNone)
      return
    }
    if (
      !window.confirm(
        t.dashboard.duplicateFattureApplyAllConfirm.replace('{n}', String(entries.length)),
      )
    ) {
      return
    }
    setBulkApplyAllOcrBusy(true)
    try {
      let n = 0
      for (const [id, pv] of entries) {
        try {
          const did = await applyDupModalOcrOnce(id, pv)
          if (did) n++
        } catch (e) {
          window.alert(e instanceof Error ? e.message : t.dashboard.duplicateFattureError)
          break
        }
      }
      router.refresh()
      if (n > 0) {
        window.alert(t.dashboard.duplicateFattureApplyAllDone.replace('{n}', String(n)))
      }
    } finally {
      setBulkApplyAllOcrBusy(false)
    }
  }, [
    applyDupModalOcrOnce,
    ocrPreviewById,
    router,
    t.dashboard.duplicateFattureApplyAllConfirm,
    t.dashboard.duplicateFattureApplyAllDone,
    t.dashboard.duplicateFattureApplyAllNone,
    t.dashboard.duplicateFattureError,
  ])

  const ocrChangeApplyCount = useMemo(
    () => Object.values(ocrPreviewById).filter((pv) => pv.hasChanges).length,
    [ocrPreviewById],
  )

  const dupModalBusy =
    deletingId !== null ||
    reassignBusyId !== null ||
    ocrBusyPreviewId !== null ||
    ocrBusyApplyId !== null ||
    bulkPdfOcrRunning ||
    bulkApplyAllOcrBusy

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
    setBulkPdfOcrRunning(false)
    setBulkPdfOcrProgress(null)
    setBulkPdfOcrErrors({})
    setOcrPreviewById({})
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
      if (signal.aborted) return
      setData(result)
      setLoading(false)

      const ids = fatturaIdsWithAttachments(result.groups)
      if (ids.length === 0 || signal.aborted) return

      setBulkPdfOcrRunning(true)
      setBulkPdfOcrProgress({ done: 0, total: ids.length })
      setBulkPdfOcrErrors({})

      for (let i = 0; i < ids.length; i++) {
        if (signal.aborted) break
        const id = ids[i]!
        try {
          const pv = await fetchDupModalOcrPreviewFromApi(id, t.dashboard.duplicateFattureError)
          setOcrPreviewById((prev) => ({ ...prev, [id]: pv }))
          setBulkPdfOcrErrors((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : t.dashboard.duplicateFattureError
          setBulkPdfOcrErrors((prev) => ({ ...prev, [id]: msg }))
        }
        setBulkPdfOcrProgress({ done: i + 1, total: ids.length })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : t.dashboard.duplicateFattureError)
    } finally {
      setLoading(false)
      setBulkPdfOcrRunning(false)
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
            className="fixed inset-0 z-[80] flex items-end justify-center app-workspace-inset-bg app-aurora-modal-overlay p-3 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dup-fatture-title"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
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
                      <p className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
                        {t.dashboard.duplicateFattureTruncated}
                      </p>
                    ) : null}
                    {bulkPdfOcrRunning && bulkPdfOcrProgress ? (
                      <div
                        className="rounded-lg border border-violet-500/35 bg-violet-950/30 px-3 py-2 text-[11px] text-violet-100"
                        role="status"
                        aria-live="polite"
                      >
                        <p className="font-semibold">{t.dashboard.duplicateFatturePdfPassPhase}</p>
                        <p className="mt-1 tabular-nums text-app-fg-muted">
                          {t.dashboard.duplicateFatturePdfPassProgress
                            .replace('{done}', String(bulkPdfOcrProgress.done))
                            .replace('{total}', String(bulkPdfOcrProgress.total))}
                        </p>
                      </div>
                    ) : null}
                    {bulkPdfOcrProgress &&
                    bulkPdfOcrProgress.total > 0 &&
                    !bulkPdfOcrRunning &&
                    !loading ? (
                      <div className="rounded-xl border border-violet-500/20 bg-violet-950/10 px-3 py-3 sm:px-4">
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-violet-100">
                              {t.dashboard.duplicateFatturePdfSummaryTitle}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-app-fg-muted">
                              {t.dashboard.duplicateFatturePdfSummaryIntro}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-amber-100/85">
                              {t.dashboard.duplicateFatturePdfSummaryAlignedSupplierNote}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={dupModalBusy || ocrChangeApplyCount === 0}
                            onClick={() => void handleApplyAllDupModalOcr()}
                            className="shrink-0 rounded-lg border border-teal-500/45 bg-teal-600/35 px-3 py-1.5 text-[11px] font-semibold text-teal-50 hover:bg-teal-600/50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {bulkApplyAllOcrBusy
                              ? t.dashboard.duplicateFattureApplyAllBusy
                              : t.dashboard.duplicateFattureApplyAllBtn}
                          </button>
                        </div>
                        <div className="max-h-52 overflow-x-auto overflow-y-auto rounded-lg border border-white/10">
                          <table className="w-full min-w-[640px] border-collapse text-left text-[10px]">
                            <thead>
                              <tr className="border-b border-white/10 text-app-fg-muted">
                                <th className="sticky top-0 bg-violet-950/90 px-2 py-1.5 font-semibold">ID</th>
                                <th className="sticky top-0 bg-violet-950/90 px-2 py-1.5 font-semibold">
                                  {t.common.supplier}
                                </th>
                                <th className="sticky top-0 bg-violet-950/90 px-2 py-1.5 font-semibold">
                                  {t.dashboard.duplicateFatturePdfColOutcome}
                                </th>
                                <th className="sticky top-0 bg-violet-950/90 px-2 py-1.5 font-semibold">
                                  {t.dashboard.duplicateFattureOcrFieldDate}
                                </th>
                                <th className="sticky top-0 bg-violet-950/90 px-2 py-1.5 font-semibold">
                                  {t.dashboard.duplicateFattureOcrFieldAmount}
                                </th>
                                <th className="sticky top-0 bg-violet-950/90 px-2 py-1.5 font-semibold">
                                  {t.dashboard.duplicateFattureOcrFieldNumber}
                                </th>
                                <th className="sticky top-0 bg-violet-950/90 px-2 py-1.5 font-semibold">
                                  {t.dashboard.duplicateFattureOcrTipoHint}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="text-app-fg-muted">
                              {data.groups.flatMap((gg) =>
                                gg.fatture.map((f) => {
                                  const pv = ocrPreviewById[f.id]
                                  const err = bulkPdfOcrErrors[f.id]
                                  const docDt = (ymd: string | null | undefined) =>
                                    ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? formatDate(ymd) : '—'
                                  const fmtAmt = (n: number | null) =>
                                    n != null && Number.isFinite(n)
                                      ? formatCurrency(n, currency, locale)
                                      : '—'
                                  const fmtDoc = (s: string | null) => (s?.trim() ? s : '—')
                                  let outcomeLabel = ''
                                  let outcomeCls = 'text-app-fg-muted'
                                  if (!f.file_url?.trim()) {
                                    outcomeLabel = t.dashboard.duplicateFatturePdfStatusNoFile
                                    outcomeCls = 'text-app-fg-muted'
                                  } else if (err) {
                                    outcomeLabel = t.dashboard.duplicateFatturePdfStatusErr
                                    outcomeCls = 'text-red-300'
                                  } else if (pv) {
                                    const archivedNomeRow =
                                      f.fornitore?.nome ?? gg.fornitore_nome
                                    const supplierMisaligned =
                                      !pv.hasChanges &&
                                      duplicateModalSupplierNameLikelyMismatch(
                                        archivedNomeRow,
                                        pv.read.ragione_sociale,
                                      )
                                    if (pv.hasChanges) {
                                      outcomeLabel = t.dashboard.duplicateFatturePdfStatusDiff
                                      outcomeCls = 'font-semibold text-amber-200'
                                    } else if (supplierMisaligned) {
                                      outcomeLabel =
                                        t.dashboard.duplicateFatturePdfStatusAlignedSupplierMismatch
                                      outcomeCls = 'font-semibold text-amber-200'
                                    } else {
                                      outcomeLabel = t.dashboard.duplicateFatturePdfStatusAligned
                                      outcomeCls = 'text-emerald-200/90'
                                    }
                                  } else {
                                    outcomeLabel = '—'
                                  }
                                  return (
                                    <tr key={f.id} className="border-b border-white/5">
                                      <td className="whitespace-nowrap px-2 py-1 font-mono text-[9px]">
                                        {f.id.slice(0, 8)}…
                                      </td>
                                      <td className="max-w-[8rem] truncate px-2 py-1" title={f.fornitore?.nome ?? ''}>
                                        {f.fornitore?.nome ?? gg.fornitore_nome ?? '—'}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1">
                                        <span className={outcomeCls}>{outcomeLabel}</span>
                                        {err ? (
                                          <span className="mt-0.5 block max-w-[14rem] truncate text-[9px] text-red-300/90" title={err}>
                                            {err}
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1">
                                        {pv ? (
                                          <>
                                            <span>{docDt(pv.current.data)}</span>
                                            <span className="text-app-fg-muted"> → </span>
                                            <span className={pv.diff.data ? 'font-semibold text-amber-200' : ''}>
                                              {docDt(pv.read.data)}
                                            </span>
                                          </>
                                        ) : (
                                          docDt(f.data)
                                        )}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1">
                                        {pv ? (
                                          <>
                                            <span>{fmtAmt(pv.current.importo)}</span>
                                            <span className="text-app-fg-muted"> → </span>
                                            <span className={pv.diff.importo ? 'font-semibold text-amber-200' : ''}>
                                              {fmtAmt(pv.read.importo)}
                                            </span>
                                          </>
                                        ) : (
                                          fmtAmt(f.importo)
                                        )}
                                      </td>
                                      <td className="max-w-[7rem] truncate px-2 py-1" title={fmtDoc(f.numero_fattura)}>
                                        {pv ? (
                                          <>
                                            <span>{fmtDoc(pv.current.numero_fattura)}</span>
                                            <span className="text-app-fg-muted"> → </span>
                                            <span
                                              className={
                                                pv.diff.numero_fattura ? 'font-semibold text-amber-200' : ''
                                              }
                                            >
                                              {fmtDoc(pv.read.numero_fattura)}
                                            </span>
                                          </>
                                        ) : (
                                          fmtDoc(f.numero_fattura)
                                        )}
                                      </td>
                                      <td className="max-w-[6rem] truncate px-2 py-1 text-[9px]" title={pv?.read.tipo_documento ?? ''}>
                                        {pv?.read.tipo_documento?.trim() || '—'}
                                      </td>
                                    </tr>
                                  )
                                }),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
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
                          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-200">
                            {t.dashboard.duplicateFattureGroupCount.replace('{n}', String(g.fatture.length))}
                          </span>
                        </div>
                        <p className="mb-2 text-[11px] text-app-fg-muted">
                          {g.sede_nome ?? t.dashboard.duplicateFattureSedeUnassigned}
                        </p>
                        <div className="mb-2 rounded-lg border border-amber-500/35 bg-amber-950/30 px-2.5 py-2 text-[11px] leading-snug text-amber-50/95">
                          <p>{t.dashboard.duplicateFattureBadReadHint}</p>
                          <Link
                            href="/fornitori/new"
                            onClick={() => setOpen(false)}
                            className="mt-2 inline-flex font-semibold text-amber-200 underline decoration-amber-400/45 underline-offset-2 hover:text-amber-50"
                          >
                            {t.dashboard.duplicateFattureCreateSupplierCta}
                          </Link>
                        </div>
                        {showReassign ? (
                          <p className="mb-2 rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-2.5 py-2 text-[11px] leading-snug text-cyan-100/90">
                            {t.dashboard.duplicateFattureWrongSupplierHint}
                          </p>
                        ) : null}
                        <ul className="flex flex-col gap-1.5">
                          {g.fatture.map((f) => (
                            <li key={f.id} className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/[0.14] p-2">
                              <div className="flex items-stretch gap-2">
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
                                    <select
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
                                      onClick={() => void handleReassignFornitore(f.id, groupSedeId)}
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
                                      <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 px-2 py-2 text-[11px] text-app-fg-muted">
                                        <p className="font-semibold text-violet-100/95">
                                          {t.dashboard.duplicateFattureOcrPreviewHeading}
                                        </p>
                                        <div className="mt-2 grid grid-cols-[minmax(0,7rem)_1fr_1fr] gap-x-2 gap-y-1 text-[10px] items-start">
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
                                          <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-[10px] text-app-fg-muted/90">
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
                                            <p className="mt-2 text-[10px] text-amber-200/95">
                                              {t.dashboard.duplicateFattureOcrSupplierMismatchInline}
                                            </p>
                                          ) : (
                                            <p className="mt-2 text-[10px] text-emerald-200/90">
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
                                            className="rounded-md border border-teal-500/45 bg-teal-600/35 px-2.5 py-1.5 text-[11px] font-semibold text-teal-50 hover:bg-teal-600/50 disabled:cursor-not-allowed disabled:opacity-40"
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
                                              setBulkPdfOcrErrors((prev) => {
                                                const next = { ...prev }
                                                delete next[f.id]
                                                return next
                                              })
                                            }}
                                            className="rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-[11px] font-semibold text-app-fg-muted hover:bg-black/45 disabled:cursor-not-allowed disabled:opacity-40"
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
        {toolbarStrip && alwaysShowLabel ? (
          <>
            <span className="hidden md:inline">{t.dashboard.duplicateFattureScanButton}</span>
            <span className="inline md:hidden">{t.dashboard.duplicateFattureToolbarShort}</span>
          </>
        ) : (
          <span className={alwaysShowLabel ? '' : 'hidden md:inline'}>{t.dashboard.duplicateFattureScanButton}</span>
        )}
      </button>
      {modal}
    </>
  )
}
