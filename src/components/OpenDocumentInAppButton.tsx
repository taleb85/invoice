'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { openDocumentUrl } from '@/lib/open-document-url'
import { attachmentKindFromFileUrl, embedSrcForInlineViewer } from '@/lib/attachment-kind'
import { useT } from '@/lib/use-t'
import { CYAN_TABLE_PILL_LINK_CLASSNAME } from '@/components/CyanTablePillLink'

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
  const canOpen = Boolean(hrefs && fileUrl?.trim())
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
        className="fixed inset-0 z-[215] flex items-center justify-center app-workspace-inset-bg p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:p-3"
        onClick={() => setOpen(false)}
        role="presentation"
      >
        <div
          className="relative flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-[min(96vw,1440px)] flex-col overflow-hidden rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 shadow-2xl sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] backdrop-blur-xl"
          style={{
            background: 'linear-gradient(to bottom right, rgba(15, 23, 42, 0.98), rgba(30, 27, 75, 0.95))',
            boxShadow: '0 0 40px -10px rgba(6, 182, 212, 0.2), 0 24px 48px -12px rgba(0, 0, 0, 0.5)',
          }}
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-12" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
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
                  <span className="w-full text-center text-[10px] text-app-fg-muted/90 sm:ml-1 sm:inline sm:w-auto">
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
                className="min-h-0 w-full flex-1 border-0"
                style={{ background: 'rgba(15, 23, 42, 0.95)' }}
              />
            ) : null}
            {!loading && !signedUrl ? (
              <iframe
                title={t.common.attachment}
                src={embedSrcForInlineViewer(tabHref, kind)}
                className="min-h-0 w-full min-h-[50vh] flex-1 border-0"
                style={{ background: 'rgba(15, 23, 42, 0.95)' }}
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
