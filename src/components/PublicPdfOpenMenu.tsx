'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/use-t'
import { attachmentKindFromFileUrl, embedSrcForInlineViewer } from '@/lib/attachment-kind'
import { resolveOpenDocumentHrefs } from '@/lib/open-document-url'

export type PublicPdfOpenMenuLabels = {
  preview: string
  copyLink: string
  linkCopied: string
}

type Props = {
  fileUrl: string
  bollaId?: string
  fatturaId?: string
  logId?: string
  documentoId?: string
  statementId?: string
  confermaOrdineId?: string
  /** Shown when `children` is omitted */
  triggerLabel?: string
  triggerClassName?: string
  labels: PublicPdfOpenMenuLabels
  children?: ReactNode
}

async function fetchBlobUrlForViewer(jsonHref: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 30_000)
  try {
    const res1 = await fetch(jsonHref, { credentials: 'include', signal: controller.signal })
    if (!res1.ok) {
      const body = (await res1.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error?.trim() || `HTTP ${res1.status}`)
    }
    const json = (await res1.json()) as { url?: string }
    const remoteUrl = json.url?.trim()
    if (!remoteUrl) throw new Error('No document URL')

    const res2 = await fetch(remoteUrl, { signal: controller.signal })
    if (!res2.ok) throw new Error(`Could not download document (${res2.status})`)
    const blob = await res2.blob()
    return URL.createObjectURL(blob)
  } finally {
    window.clearTimeout(timeoutId)
  }
}

/**
 * Menu anteprima / copia link. L’anteprima usa `/api/open-document` + blob (come il viewer in-app)
 * così i PDF su Storage privato non restano con iframe vuoto (X-Frame-Options / token scaduto).
 */
export function PublicPdfOpenMenu({
  fileUrl,
  bollaId,
  fatturaId,
  logId,
  documentoId,
  statementId,
  confermaOrdineId,
  triggerLabel,
  triggerClassName,
  labels,
  children,
}: Props) {
  const t = useT()
  const menuId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const blobUrlRef = useRef<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const url = fileUrl?.trim() ?? ''
  const hrefs = resolveOpenDocumentHrefs({
    bollaId,
    fatturaId,
    logId,
    documentoId,
    statementId,
    confermaOrdineId,
  })
  const attachKind = attachmentKindFromFileUrl(url)
  const kind = url ? attachKind : 'pdf'

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!url || !menuOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, closeMenu, url])

  useEffect(() => {
    if (!previewOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewOpen])

  useEffect(() => {
    if (!previewOpen) {
      setSignedUrl(null)
      setLoading(false)
      setFetchError(null)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      return
    }

    const jsonHref = hrefs?.jsonHref
    if (!jsonHref) {
      setFetchError('Documento non collegato')
      return
    }

    let cancelled = false
    setLoading(true)
    setSignedUrl(null)
    setFetchError(null)

    void fetchBlobUrlForViewer(jsonHref)
      .then((blobUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(blobUrl)
          return
        }
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = blobUrl
        setSignedUrl(blobUrl)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const isAbort = e instanceof DOMException && e.name === 'AbortError'
        setFetchError(
          isAbort
            ? 'Timeout (30 s) — documento non disponibile'
            : e instanceof Error
              ? e.message
              : 'Errore caricamento documento',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [previewOpen, hrefs?.jsonHref])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (!previewOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [previewOpen])

  if (!url && !hrefs) return null

  const copyLinkTarget =
    hrefs?.tabHref ?
      `${typeof window !== 'undefined' ? window.location.origin : ''}${hrefs.tabHref}`
    : url

  const copy = async () => {
    if (!copyLinkTarget) return
    try {
      await navigator.clipboard.writeText(copyLinkTarget)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const openPreview = () => {
    if (!hrefs?.jsonHref) return
    closeMenu()
    setPreviewOpen(true)
  }

  const previewNode =
    previewOpen && portalReady ? (
      <div
        className="fixed inset-0 z-[215] flex items-center justify-center app-workspace-inset-bg app-aurora-modal-overlay p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3"
        onClick={() => setPreviewOpen(false)}
        role="presentation"
      >
        <div
          className="app-aurora-doc-modal-shell relative flex h-[min(68dvh,calc(100dvh-7.5rem))] max-h-[min(68dvh,calc(100dvh-7.5rem))] w-full max-w-[min(92vw,1440px)] flex-col overflow-hidden rounded-xl border border-app-line-28 shadow-2xl md:h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-1.5rem)] md:max-w-[min(96vw,1440px)] md:rounded-lg backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t.common.document}
        >
          {hrefs?.tabHref ? (
            <a
              href={hrefs.tabHref}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute left-2 top-2 z-20 rounded-lg border border-app-line-32 app-workspace-surface-elevated px-3 py-1.5 text-sm font-medium text-app-fg shadow-lg backdrop-blur-sm transition-colors hover:bg-app-line-15"
              onClick={(e) => e.stopPropagation()}
              title={t.common.openAttachment}
            >
              ↗
            </a>
          ) : null}
          <button
            type="button"
            className="absolute right-2 top-2 z-20 rounded-lg border border-app-line-32 app-workspace-surface-elevated px-3 py-1.5 text-sm font-medium text-app-fg shadow-lg backdrop-blur-sm transition-colors hover:bg-app-line-15 hover:text-app-fg"
            onClick={() => setPreviewOpen(false)}
          >
            {t.statements.btnClose}
          </button>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-10 md:pt-12">
            {loading ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                <span
                  className="h-8 w-8 animate-spin rounded-full border-2 border-app-cyan-500/70 border-t-transparent"
                  aria-hidden
                />
                <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
              </div>
            ) : null}
            {!loading && signedUrl && kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob URL locale
              <img
                src={signedUrl}
                alt=""
                className="app-aurora-viewer-fill mx-auto min-h-0 w-full flex-1 object-contain"
              />
            ) : null}
            {!loading && signedUrl && kind !== 'image' ? (
              <iframe
                title={t.common.document}
                src={embedSrcForInlineViewer(signedUrl, kind)}
                className="app-aurora-viewer-fill min-h-0 w-full flex-1 border-0 bg-slate-950/35"
              />
            ) : null}
            {!loading && !signedUrl ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-sm text-app-fg-muted">{t.common.document}: {t.common.noData}</p>
                {fetchError ? <p className="text-xs text-rose-200/90">{fetchError}</p> : null}
                {hrefs?.tabHref ? (
                  <a
                    href={hrefs.tabHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-app-cyan-400 hover:underline"
                  >
                    {t.common.openAttachment} ↗
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ) : null

  return (
    <>
      <div ref={wrapRef} className="relative inline-block text-left">
        <button
          type="button"
          className={triggerClassName}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls={menuId}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="inline-flex items-center gap-1">
            {children ?? triggerLabel}
            {!children ? (
              <svg className="h-3 w-3 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : null}
          </span>
        </button>
        {menuOpen ? (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-app-line-28 app-workspace-surface-elevated py-1 shadow-xl ring-1 ring-black/20"
          >
            <button
              type="button"
              role="menuitem"
              disabled={!hrefs?.jsonHref}
              className="block w-full px-3 py-2 text-left text-xs font-medium text-app-fg transition-colors hover:bg-black/18 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={openPreview}
            >
              {labels.preview}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!copyLinkTarget}
              className="block w-full px-3 py-2 text-left text-xs font-medium text-app-fg transition-colors hover:bg-black/18 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => void copy()}
            >
              {copied ? labels.linkCopied : labels.copyLink}
            </button>
          </div>
        ) : null}
      </div>
      {previewNode ? createPortal(previewNode, document.body) : null}
    </>
  )
}
