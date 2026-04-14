'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { openDocumentUrl } from '@/lib/open-document-url'
import { attachmentKindFromFileUrl } from '@/lib/attachment-kind'
import { useT } from '@/lib/use-t'
import { CYAN_TABLE_PILL_LINK_CLASSNAME } from '@/components/CyanTablePillLink'

type Props = {
  bollaId?: string
  fatturaId?: string
  fileUrl: string | null | undefined
  children: React.ReactNode
  /** Default: pill cyan da tabella bolle/fatture. */
  className?: string
}

/**
 * Apre PDF/immagine in un overlay in-app (URL firmato via `/api/open-document?json=1`).
 * Per tipi non PDF/immagine usa iframe come fallback (come nel layer fornitore).
 */
export function OpenDocumentInAppButton({ bollaId, fatturaId, fileUrl, children, className }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const hasBolla = Boolean(bollaId?.trim())
  const hasFattura = Boolean(fatturaId?.trim())
  if (!hasBolla && !hasFattura) return null
  if (hasBolla && hasFattura) return null
  if (!fileUrl?.trim()) return null

  const docId = (bollaId ?? fatturaId)!.trim()
  const jsonHref = hasBolla
    ? openDocumentUrl({ bollaId: docId, json: true })
    : openDocumentUrl({ fatturaId: docId, json: true })
  const tabHref = hasBolla ? openDocumentUrl({ bollaId: docId }) : openDocumentUrl({ fatturaId: docId })
  const kind = attachmentKindFromFileUrl(fileUrl)
  const triggerClass = className ?? CYAN_TABLE_PILL_LINK_CLASSNAME

  useEffect(() => {
    if (!open) {
      setSignedUrl(null)
      setLoading(false)
      return
    }
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
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button type="button" className={triggerClass} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="relative flex h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t.common.attachment}
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-20 rounded-lg border border-slate-600/80 bg-slate-900/90 px-3 py-1.5 text-sm font-medium text-slate-100 shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-800 hover:text-white"
              onClick={() => setOpen(false)}
            >
              {t.statements.btnClose}
            </button>
            <div className="min-h-0 flex-1 overflow-hidden bg-slate-950">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-400">{t.common.loading}</p>
                </div>
              ) : null}
              {!loading && signedUrl && kind === 'image' ? (
                <div className="flex h-full items-center justify-center overflow-auto p-1">
                  <Image
                    src={signedUrl}
                    alt=""
                    width={1200}
                    height={1600}
                    unoptimized
                    className="h-auto max-h-full w-full object-contain"
                  />
                </div>
              ) : null}
              {!loading && signedUrl && kind !== 'image' ? (
                <iframe
                  title={t.common.attachment}
                  src={signedUrl}
                  className="h-full w-full border-0 bg-slate-950"
                />
              ) : null}
              {!loading && !signedUrl ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
                  <p className="text-sm text-slate-400">{t.common.error}</p>
                  <a
                    href={tabHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    {t.common.openAttachment}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
