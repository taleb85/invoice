'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CategoriaDropdown } from '@/components/CategoriaDropdown'
import { AiAnalysisButton } from '@/components/AiAnalysisButton'
import DocumentActionsButton from '@/components/DocumentActionsButton'
import { DocumentModalFooter } from '@/components/DocumentModalFooter'
import type { DocumentActionItem } from '@/components/DocumentActionsModal'
import { documentActionItemFromEntity } from '@/lib/document-action-item'
import { resolveOpenDocumentHrefs } from '@/lib/open-document-url'
import { attachmentKindFromFileUrl, embedSrcForInlineViewer } from '@/lib/attachment-kind'
import { useT } from '@/lib/use-t'
import { CYAN_TABLE_PILL_LINK_CLASSNAME } from '@/components/CyanTablePillLink'

type ActionAnomalia = {
  tipo: string
}

type AzioneConsigliata = {
  action: 'resetta' | 'scarta' | 'elimina_duplicato'
  label: string
  color: string
  border: string
  bg: string
}

function viewerAnalizzaAzioneConsigliata(anomalie: ActionAnomalia[]): AzioneConsigliata | null {
  if (anomalie.length === 0) return null
  const tipi = new Set(anomalie.map((a) => a.tipo))
  if (tipi.has('documento_duplicato')) {
    return { action: 'elimina_duplicato', label: 'Elimina duplicato', color: 'text-purple-200', border: 'border-purple-500/30', bg: 'bg-purple-500/10' }
  }
  if (tipi.has('riferimento_inesistente') || tipi.has('riferimento_assente')) {
    return { action: 'resetta', label: 'Resetta', color: 'text-amber-200', border: 'border-amber-500/30', bg: 'bg-amber-500/10' }
  }
  if (tipi.has('file_mancante')) {
    return { action: 'scarta', label: 'Scarta', color: 'text-rose-200', border: 'border-rose-500/30', bg: 'bg-rose-500/10' }
  }
  if (tipi.has('fornitore_mancante') || tipi.has('sede_mancante') || tipi.has('associazione_vecchia')) {
    return { action: 'resetta', label: 'Resetta', color: 'text-amber-200', border: 'border-amber-500/30', bg: 'bg-amber-500/10' }
  }
  return { action: 'resetta', label: 'Resetta', color: 'text-amber-200', border: 'border-amber-500/30', bg: 'bg-amber-500/10' }
}

type ViewerAction<A extends string> = {
  action: A
  label: string
  onClick: () => void
}

type Props = {
  bollaId?: string
  fatturaId?: string
  logId?: string
  documentoId?: string
  statementId?: string
  confermaOrdineId?: string
  fileUrl: string | null | undefined
  children: React.ReactNode
  /** Default: pill cyan da tabella bolle/fatture. */
  className?: string
  /** Es. righe tabella con `onClick` di navigazione. */
  stopTriggerPropagation?: boolean
  title?: string
  /**
   * ID HTML sul pulsante trigger per accesso programmatico (es. click via
   * `document.getElementById` dalla riga tabella).
   */
  buttonId?: string
  /**
   * Sostituisce la classe `z-*` sull’overlay del viewer (portal su `body`).
   * Usa es. `z-[292]` quando il trigger è dentro una modale con z &gt; 215 (es. anteprima Gestione duplicati).
   */
  viewerOverlayClassName?: string
  /** Se fornito, mostra una toolbar azioni dentro il viewer. */
  anomalie?: ActionAnomalia[]
  viewerActions?: ViewerAction<'scarta' | 'resetta' | 'elimina_duplicato'>[]
  /** Categoria del documento da mostrare nella toolbar (es. Fattura, Bolla, Estratto conto). */
  categoria?: string
  /** Quando fornito, la categoria diventa editabile tramite dropdown. */
  onCategoriaChange?: (nuovaCategoria: string) => void
  /** Override per `DocumentActionsModal` nel footer del viewer. */
  documentActionsItem?: DocumentActionItem | null
  fornitoreId?: string | null
}

const VIEWER_Z_MIN = 0.5
const VIEWER_Z_MAX = 3
const VIEWER_Z_STEP = 0.25

function clampViewerZoom(n: number): number {
  return Math.min(VIEWER_Z_MAX, Math.max(VIEWER_Z_MIN, Math.round(n * 100) / 100))
}

function touchPairDistance(t: TouchList): number {
  if (t.length < 2) return 0
  const a = t[0]!
  const b = t[1]!
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

/**
 * Apre PDF/immagine in un modale in-app (URL firmato via `/api/open-document?json=1`);
 * l’overlay è montato con portal su `body` (z-215) così resta sopra la bottom bar mobile.
 * Per tipi non PDF/immagine usa iframe come fallback (come nel layer fornitore).
 */
export function OpenDocumentInAppButton({
  bollaId,
  fatturaId,
  logId,
  documentoId,
  statementId,
  confermaOrdineId,
  fileUrl,
  children,
  className,
  stopTriggerPropagation,
  title,
  buttonId,
  viewerOverlayClassName,
  anomalie,
  viewerActions,
  categoria,
  onCategoriaChange,
  documentActionsItem: documentActionsItemProp,
  fornitoreId,
}: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const imageScrollRef = useRef<HTMLDivElement>(null)
  const imageZoomRef = useRef(1)
  /** Tracks the current blob: URL so we can revoke it when no longer needed. */
  const blobUrlRef = useRef<string | null>(null)

  // Drag state
  const modalRef = useRef<HTMLDivElement>(null)
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 })

  // Resize state
  const [modalSize, setModalSize] = useState<{ w: number | null; h: number | null }>({ w: null, h: null })
  const isResizing = useRef(false)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, px: dragPos.x, py: dragPos.y }
    e.preventDefault()
  }, [dragPos])

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    isResizing.current = true
    const el = modalRef.current
    if (!el) return
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: el.offsetWidth,
      h: el.offsetHeight,
    }
  }, [])

  // Global move/up for drag and resize
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setDragPos({
          x: dragStart.current.px + (e.clientX - dragStart.current.x),
          y: dragStart.current.py + (e.clientY - dragStart.current.y),
        })
      }
      if (isResizing.current) {
        const dx = e.clientX - resizeStart.current.x
        const dy = e.clientY - resizeStart.current.y
        setModalSize({
          w: Math.max(320, resizeStart.current.w + dx),
          h: Math.max(200, resizeStart.current.h + dy),
        })
      }
    }
    const onMouseUp = () => {
      isDragging.current = false
      isResizing.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const hrefs = resolveOpenDocumentHrefs({ bollaId, fatturaId, logId, documentoId, statementId, confermaOrdineId })
  const jsonHref = hrefs?.jsonHref ?? ''
  const tabHref = hrefs?.tabHref ?? ''
  const canOpen = Boolean(hrefs)
  const kind = fileUrl?.trim() ? attachmentKindFromFileUrl(fileUrl) : 'pdf'

  const documentActionsItem = useMemo(
    () =>
      documentActionsItemProp ??
      documentActionItemFromEntity({
        fatturaId,
        bollaId,
        documentoId,
        statementId,
        fileUrl,
        fornitoreId,
      }),
    [
      documentActionsItemProp,
      fatturaId,
      bollaId,
      documentoId,
      statementId,
      fileUrl,
      fornitoreId,
    ],
  )

  const aiEntity =
    fatturaId?.trim() ?
      ({ type: 'fattura' as const, id: fatturaId.trim() })
    : bollaId?.trim() ?
      ({ type: 'bolla' as const, id: bollaId.trim() })
    : null

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  const z = clampViewerZoom(imageZoom)
  useEffect(() => {
    imageZoomRef.current = z
  }, [z])

  useEffect(() => {
    setImageZoom(1)
  }, [open, signedUrl])

  useEffect(() => {
    const el = imageScrollRef.current
    if (!el || !open || kind !== 'image' || !signedUrl) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setImageZoom((prev) => clampViewerZoom(prev + (e.deltaY < 0 ? 0.12 : -0.12)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, signedUrl, kind, loading])

  useEffect(() => {
    const el = imageScrollRef.current
    if (!el || !open || kind !== 'image' || !signedUrl) return
    let startDist = 0
    let startZ = 1

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = touchPairDistance(e.touches)
        startZ = imageZoomRef.current
      }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 4) {
        e.preventDefault()
        const d = touchPairDistance(e.touches)
        if (d > 0) {
          setImageZoom(clampViewerZoom(startZ * (d / startDist)))
        }
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        startDist = 0
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [open, signedUrl, kind, loading])

  useEffect(() => {
    if (!open) {
      setSignedUrl(null)
      setLoading(false)
      setFetchError(null)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      return
    }
    if (!jsonHref) return
    let cancelled = false
    const controller = new AbortController()
    // 30 s covers both the API call and the PDF blob download
    const timeoutId = setTimeout(() => controller.abort(), 30_000)
    setLoading(true)
    setSignedUrl(null)
    setFetchError(null)

    void (async () => {
      try {
        // Step 1: resolve the signed URL from our API
        const res1 = await fetch(jsonHref, { credentials: 'include', signal: controller.signal })
        if (!res1.ok) {
          const body = await res1.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? String(res1.status))
        }
        const json = await res1.json() as { url?: string }
        const remoteUrl = json.url?.trim()
        if (!remoteUrl) throw new Error('No document URL')

        // Step 2: download PDF/file as a blob so the iframe receives a same-origin
        // blob: URL — this bypasses X-Frame-Options headers on the storage domain.
        const res2 = await fetch(remoteUrl, { signal: controller.signal })
        if (!res2.ok) throw new Error(`Could not download document (${res2.status})`)
        const blob = await res2.blob()
        if (cancelled) return

        // Revoke any previous blob URL before creating a new one
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const blobUrl = URL.createObjectURL(blob)
        blobUrlRef.current = blobUrl
        setSignedUrl(blobUrl)
      } catch (e: unknown) {
        if (!cancelled) {
          const isAbort = e instanceof DOMException && e.name === 'AbortError'
          setSignedUrl(null)
          setFetchError(
            isAbort
              ? 'Timeout (30 s) — document not available'
              : e instanceof Error
                ? e.message
                : 'Error loading document',
          )
        }
      } finally {
        clearTimeout(timeoutId)
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [open, jsonHref])

  // Revoke blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (!open || !canOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, canOpen])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!canOpen) return null

  const triggerClass = className ?? CYAN_TABLE_PILL_LINK_CLASSNAME
  const zoomBtn =
    'inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg border border-app-line-28 bg-black/25 px-2 text-sm font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-40'

  const overlayNode =
    open && portalReady ? (
      <div
        className={`fixed inset-0 flex items-center justify-center app-workspace-inset-bg app-aurora-modal-overlay p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3 ${viewerOverlayClassName?.trim() || 'z-[215]'}`}
        onClick={() => setOpen(false)}
        role="presentation"
      >
        <div
          ref={modalRef}
          className="app-aurora-doc-modal-shell relative flex h-[min(68dvh,calc(100dvh-7.5rem))] max-h-[min(68dvh,calc(100dvh-7.5rem))] w-full max-w-[min(92vw,1440px)] flex-col overflow-hidden rounded-xl border border-app-line-28 shadow-2xl md:h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-1.5rem)] md:max-w-[min(96vw,1440px)] md:rounded-lg backdrop-blur-xl"
          style={{
            transform: dragPos.x !== 0 || dragPos.y !== 0 ? `translate(${dragPos.x}px, ${dragPos.y}px)` : undefined,
            width: modalSize.w != null ? `${modalSize.w}px` : undefined,
            height: modalSize.h != null ? `${modalSize.h}px` : undefined,
            maxWidth: modalSize.w != null ? undefined : undefined,
            maxHeight: modalSize.h != null ? undefined : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t.common.attachment}
        >
          {/* Drag handle bar */}
          <div
            className="absolute inset-x-0 top-0 z-10 h-10 cursor-grab active:cursor-grabbing"
            onMouseDown={onDragStart}
          />
          {/* Resize handle — bottom-right corner */}
          <div
            className="absolute bottom-0 right-0 z-30 h-4 w-4 cursor-se-resize"
            onMouseDown={onResizeStart}
          >
            <svg className="h-full w-full text-app-fg-muted/40" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M16 16V0M16 16H0" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
            {tabHref && (
              <a
                href={tabHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-app-line-32 app-workspace-surface-elevated px-3 py-1.5 text-sm font-medium text-app-fg shadow-lg backdrop-blur-sm transition-colors hover:bg-app-line-15 hover:text-app-fg"
                onClick={(e) => e.stopPropagation()}
                title={t.common.openAttachment}
              >
                ↗
              </a>
            )}
            <button
              type="button"
              className="rounded-lg border border-app-line-32 app-workspace-surface-elevated px-3 py-1.5 text-sm font-medium text-app-fg shadow-lg backdrop-blur-sm transition-colors hover:bg-app-line-15 hover:text-app-fg"
              onClick={() => setOpen(false)}
            >
              {t.statements.btnClose}
            </button>
          </div>
          {/* Document type badge — always visible when categoria is set and there are no action buttons */}
          {categoria && !(anomalie && anomalie.length > 0 && viewerActions && viewerActions.length > 0) && (
            <div className="absolute left-2 top-2 z-20">
              <span className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-app-fg-muted">
                {categoria}
              </span>
            </div>
          )}
          {anomalie && anomalie.length > 0 && viewerActions && viewerActions.length > 0 && (
            <div className="absolute left-2 right-2 top-2 z-20 flex flex-wrap items-center gap-1.5 sm:right-auto sm:left-16">
              {categoria && onCategoriaChange ? (
                <CategoriaDropdown
                  categoria={categoria}
                  documentoId={documentoId ?? ''}
                  onCategoriaChange={onCategoriaChange}
                />
              ) : categoria ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-app-fg-muted">
                  {categoria}
                </span>
              ) : null}
              {(() => {
                const consiglio = viewerAnalizzaAzioneConsigliata(anomalie)
                return consiglio ? (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold ${consiglio.border} ${consiglio.bg} ${consiglio.color}`}
                  >
                    <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{consiglio.label}</span>
                    <span className="ml-0.5 text-[9px] opacity-60">Consigliato</span>
                  </span>
                ) : null
              })()}
              {viewerActions.map((a) => (
                <button
                  key={a.action}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    a.onClick()
                    setOpen(false)
                  }}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold transition-colors hover:opacity-80 ${
                    a.action === 'scarta'
                      ? 'border-rose-500/30 bg-rose-500/8 text-rose-200'
                      : a.action === 'elimina_duplicato'
                        ? 'border-purple-500/30 bg-purple-500/8 text-purple-200'
                        : 'border-amber-500/30 bg-amber-500/8 text-amber-200'
                  }`}
                >
                  {a.label === 'Scarta' && (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                  {a.label === 'Resetta' && (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {a.label === 'Elimina duplicato' && (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M23 1l-6 6m0 0l6 6m-6-6H1" />
                    </svg>
                  )}
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="app-aurora-viewer-fill flex min-h-0 flex-1 flex-col overflow-hidden pt-10 md:pt-12 bg-transparent">
            {loading ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                <svg className="h-8 w-8 animate-spin text-app-cyan-500/70" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
              </div>
            ) : null}
            {!loading && signedUrl && kind === 'image' ? (
              <>
                <div
                  className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-app-line-22/80 bg-[#0a1420]/95 px-2 py-1.5"
                  role="toolbar"
                  aria-label="Zoom"
                >
                  <button
                    type="button"
                    className={zoomBtn}
                    aria-label={t.common.viewerZoomOut}
                    title={t.common.viewerZoomOut}
                    disabled={z <= VIEWER_Z_MIN}
                    onClick={() => setImageZoom((x) => clampViewerZoom(x - VIEWER_Z_STEP))}
                  >
                    −
                  </button>
                  <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-app-fg-muted">
                    {Math.round(z * 100)}%
                  </span>
                  <button
                    type="button"
                    className={zoomBtn}
                    aria-label={t.common.viewerZoomIn}
                    title={t.common.viewerZoomIn}
                    disabled={z >= VIEWER_Z_MAX}
                    onClick={() => setImageZoom((x) => clampViewerZoom(x + VIEWER_Z_STEP))}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={`${zoomBtn} text-xs font-medium`}
                    aria-label={t.common.viewerZoomReset}
                    title={t.common.viewerZoomReset}
                    onClick={() => setImageZoom(1)}
                  >
                    100%
                  </button>
                  <span className="w-full text-center text-[10px] text-app-fg-muted sm:ml-1 sm:inline sm:w-auto">
                    {t.common.viewerZoomHint}
                  </span>
                </div>
                <div
                  ref={imageScrollRef}
                  className="min-h-0 flex-1 overflow-auto overscroll-contain touch-pan-x touch-pan-y"
                >
                  <div className="flex w-full min-w-full justify-center p-1 sm:p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL firmato storage */}
                    <img
                      src={signedUrl}
                      alt=""
                      style={{ width: `${z * 100}%`, maxWidth: z > 1 ? 'none' : undefined, height: 'auto' }}
                      className="mx-auto h-auto max-h-full w-full min-h-0 max-w-full object-contain"
                    />
                  </div>
                </div>
              </>
            ) : null}
            {!loading && signedUrl && kind !== 'image' ? (
              <iframe
                title={t.common.attachment}
                src={embedSrcForInlineViewer(signedUrl, kind)}
                className="app-aurora-viewer-fill min-h-0 w-full flex-1 border-0 bg-transparent"
              />
            ) : null}
            {!loading && !signedUrl ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                <div className="max-w-sm space-y-2 text-center">
                  <svg className="mx-auto h-10 w-10 text-app-fg-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-app-fg-muted">{t.common.document}: {t.common.noData}</p>
                  {fetchError && <p className="text-xs text-app-fg-muted/60">{fetchError}</p>}
                  {tabHref && (
                    <a
                      href={tabHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-app-cyan-500 hover:underline"
                    >
                      {t.common.openAttachment} ↗
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          {documentActionsItem ? (
            <DocumentModalFooter>
              {aiEntity ? (
                <AiAnalysisButton
                  entityType={aiEntity.type}
                  entityId={aiEntity.id}
                  fornitoreId={fornitoreId}
                />
              ) : null}
              <DocumentActionsButton item={documentActionsItem} variant="link" />
            </DocumentModalFooter>
          ) : null}
          </div>
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        type="button"
        id={buttonId}
        title={title}
        className={triggerClass}
        onClick={(e) => {
          if (stopTriggerPropagation) e.stopPropagation()
          setOpen(true)
        }}
      >
        {children}
      </button>
      {overlayNode ? createPortal(overlayNode, document.body) : null}
    </>
  )
}
