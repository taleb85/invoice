'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useT } from '@/lib/use-t'
import { attachmentKindFromFileUrl, embedSrcForInlineViewer } from '@/lib/attachment-kind'

export type PublicPdfOpenMenuLabels = {
  preview: string
  copyLink: string
  linkCopied: string
}

type Props = {
  fileUrl: string
  /** Shown when `children` is omitted */
  triggerLabel?: string
  triggerClassName?: string
  labels: PublicPdfOpenMenuLabels
  children?: ReactNode
}

/**
 * Trigger opens a small menu: anteprima in popup e copia link (nessuna nuova scheda).
 */
export function PublicPdfOpenMenu({ fileUrl, triggerLabel, triggerClassName, labels, children }: Props) {
  const t = useT()
  const menuId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = fileUrl?.trim() ?? ''
  const attachKind = attachmentKindFromFileUrl(url)
  const previewSrc = embedSrcForInlineViewer(url, attachKind)

  const closeMenu = useCallback(() => setMenuOpen(false), [])

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
    if (!url || !previewOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewOpen, url])

  if (!url) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const openPreview = () => {
    closeMenu()
    setPreviewOpen(true)
  }

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
            className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-slate-600/60 bg-slate-900 py-1 shadow-xl ring-1 ring-black/20"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700/80"
              onClick={openPreview}
            >
              {labels.preview}
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700/80"
              onClick={() => void copy()}
            >
              {copied ? labels.linkCopied : labels.copyLink}
            </button>
          </div>
        ) : null}
      </div>
      {previewOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:p-3"
          onClick={() => setPreviewOpen(false)}
          role="presentation"
        >
          <div
            className="relative flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-[min(96vw,1440px)] flex-col overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-950 shadow-2xl sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t.common.document}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-20 rounded-lg border border-slate-600/80 bg-slate-900/90 px-3 py-1.5 text-sm font-medium text-slate-100 shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-800 hover:text-white"
              onClick={() => setPreviewOpen(false)}
            >
              {t.statements.btnClose}
            </button>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-12">
              <iframe
                title={t.common.document}
                src={previewSrc}
                className="min-h-0 w-full flex-1 border-0 bg-slate-950"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
