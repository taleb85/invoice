'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CategoriaDropdown } from '@/components/CategoriaDropdown'
import { openDocumentUrl } from '@/lib/open-document-url'
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
  fileUrl: string | null | undefined
  children: React.ReactNode
  /** Default: pill cyan da tabella bolle/fatture. */
  className?: string
  /** Es. righe tabella con `onClick` di navigazione. */
  stopTriggerPropagation?: boolean
  title?: string
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
}

function resolveOpenHrefs(p: Pick<Props, 'bollaId' | 'fatturaId' | 'logId' | 'documentoId' | 'statementId'>): {
  jsonHref: string
  tabHref: string
} | null {
  const b = p.bollaId?.trim()
  const f = p.fatturaId?.trim()
  const l = p.logId?.trim()
  const d = p.documentoId?.trim()
  const s = p.statementId?.trim()
  const count = [b, f, l, d, s].filter(Boolean).length
  if (count !== 1) return null
  if (b) {
    return {
      jsonHref: openDocumentUrl({ bollaId: b, json: true }),
      tabHref: openDocumentUrl({ bollaId: b }),
    }
  }
  if (f) {
    return {
      jsonHref: openDocumentUrl({ fatturaId: f, json: true }),
      tabHref: openDocumentUrl({ fatturaId: f }),
    }
  }
  if (l) {
    return {
      jsonHref: openDocumentUrl({ logId: l, json: true }),
      tabHref: openDocumentUrl({ logId: l }),
    }
  }
  if (d) {
    return {
      jsonHref: openDocumentUrl({ documentoId: d, json: true }),
      tabHref: openDocumentUrl({ documentoId: d }),
    }
  }
  if (s) {
    return {
      jsonHref: openDocumentUrl({ statementId: s, json: true }),
      tabHref: openDocumentUrl({ statementId: s }),
    }
  }
  return null
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
  fileUrl,
  children,
  className,
  stopTriggerPropagation,
  title,
  viewerOverlayClassName,
  anomalie,
  viewerActions,
  categoria,
  onCategoriaChange,
}: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const imageScrollRef = useRef<HTMLDivElement>(null)
  const imageZoomRef = useRef(1)

  const hrefs = resolveOpenHrefs({ bollaId, fatturaId, logId, documentoId, statementId })
  const jsonHref = hrefs?.jsonHref ?? ''
  const tabHref = hrefs?.tabHref ?? ''
  const canOpen = Boolean(hrefs)
  const kind = fileUrl?.trim() ? attachmentKindFromFileUrl(fileUrl) : 'pdf'

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
      return
    }
    if (!jsonHref) return
    let cancelled = false
    setLoading(true)
    setSignedUrl(null)
    void fetch(jsonHref, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<{ url?: string }>
      })
      .then((j) => {
        if (!cancelled) setSignedUrl(j.url?.trim() ?? null)
      })
      .catch(() => {
        if (!cancelled) setSignedUrl(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, jsonHref])

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
          className="app-aurora-doc-modal-shell relative flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-[min(96vw,1440px)] flex-col overflow-hidden rounded-lg border border-app-line-28 shadow-2xl sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t.common.attachment}
        >
          <button
            type="button"
            className="absolute right-2 top-2 z-20 rounded-lg border border-app-line-32 app-workspace-surface-elevated px-3 py-1.5 text-sm font-medium text-app-fg shadow-lg backdrop-blur-sm transition-colors hover:bg-app-line-15 hover:text-app-fg"
            onClick={() => setOpen(false)}
          >
            {t.statements.btnClose}
          </button>
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
          <div className="app-aurora-viewer-fill flex min-h-0 flex-1 flex-col overflow-hidden pt-12 bg-slate-950/35">
            {loading ? (
              <div className="flex min-h-0 flex-1 items-center justify-center">
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
                className="app-aurora-viewer-fill min-h-0 w-full flex-1 border-0 bg-slate-950/35"
              />
            ) : null}
            {!loading && !signedUrl ? (
              <iframe
                title={t.common.attachment}
                src={embedSrcForInlineViewer(tabHref, kind)}
                className="app-aurora-viewer-fill min-h-0 w-full min-h-[50vh] flex-1 border-0 bg-slate-950/35"
              />
            ) : null}
          </div>
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        type="button"
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
