'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
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

/**
 * Apre PDF/immagine in un overlay in-app (URL firmato via `/api/open-document?json=1`).
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

  const hrefs = resolveOpenHrefs({ bollaId, fatturaId, logId, documentoId, statementId })
  if (!hrefs) return null
  if (!fileUrl?.trim()) return null

  const { jsonHref, tabHref } = hrefs
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
      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-md sm:p-3"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="relative flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-[min(96vw,1440px)] flex-col overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-950 shadow-2xl sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)]"
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 pt-12">
              {loading ? (
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <p className="text-sm text-slate-400">{t.common.loading}</p>
                </div>
              ) : null}
              {!loading && signedUrl && kind === 'image' ? (
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-1">
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
                  src={embedSrcForInlineViewer(signedUrl, kind)}
                  className="min-h-0 w-full flex-1 border-0 bg-slate-950"
                />
              ) : null}
              {!loading && !signedUrl ? (
                <iframe
                  title={t.common.attachment}
                  src={embedSrcForInlineViewer(tabHref, kind)}
                  className="min-h-0 w-full min-h-[50vh] flex-1 border-0 bg-slate-950"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
