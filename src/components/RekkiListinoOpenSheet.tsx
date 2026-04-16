'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ActionButton, ActionLink } from '@/components/ui/ActionButton'
import { useT } from '@/lib/use-t'

const REKKI_POPUP = 'width=800,height=900,scrollbars=yes,resizable=yes,noopener,noreferrer'

type Props = {
  supplierDisplayName: string
  /** URL Rekki profilo o ricerca Google `site:rekki.com …` */
  listinoHref: string | null
  disabled?: boolean
}

/**
 * Sheet laterale (stile app): messaggio + anteprima `object`/`embed` e CTA verso Rekki/Google.
 * Il trigger non usa `href` (evita doppia apertura); il link principale è un `ActionLink` con `href` reale.
 */
export default function RekkiListinoOpenSheet({ supplierDisplayName, listinoHref, disabled }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    queueMicrotask(() => closeRef.current?.focus())
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const name = supplierDisplayName.replace(/\s+/g, ' ').trim() || '—'
  const intro = t.fornitori.rekkiSheetIntro.replace('{name}', name)

  const openManagedWindow = useCallback(() => {
    if (!listinoHref) return
    window.open(listinoHref, 'rekkiListino', REKKI_POPUP)
    close()
  }, [listinoHref, close])

  const sheet =
    open && mounted && listinoHref
      ? createPortal(
          <div className="pointer-events-none fixed inset-0 z-[210]">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="pointer-events-auto absolute inset-y-0 right-0 z-[212] flex h-[100dvh] w-full max-w-[min(100vw,28rem)] flex-col border-l border-app-line-25 bg-slate-950 shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-line-22 px-4 py-3 sm:px-5">
                <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold text-app-fg">
                  {t.fornitori.rekkiEmbedPanelTitle}
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  className="shrink-0 rounded-lg border border-app-line-32 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:bg-white/[0.1]"
                >
                  {t.statements.btnClose}
                </button>
              </div>
              <div className="shrink-0 space-y-2 border-b border-app-line-22 px-4 py-4 sm:px-5">
                <p className="text-sm leading-relaxed text-app-fg">{intro}</p>
                <ActionLink
                  intent="integration"
                  size="md"
                  href={listinoHref}
                  prefetch={false}
                  className="flex w-full justify-center py-3 text-base font-bold"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault()
                    openManagedWindow()
                  }}
                >
                  {t.fornitori.rekkiGoToListinoButton}
                </ActionLink>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-4 py-3 sm:px-5">
                <p className="text-[10px] leading-snug text-app-fg-muted">{t.fornitori.rekkiEmbedProbeHint}</p>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-app-line-28 bg-black/40">
                  <object
                    data={listinoHref}
                    type="text/html"
                    className="min-h-0 w-full flex-1 border-0"
                    aria-label={t.fornitori.rekkiEmbedPanelTitle}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="pointer-events-auto absolute inset-0 z-[211] app-workspace-inset-bg/80 backdrop-blur-sm"
              aria-label={t.ui.closeMenu}
              onClick={close}
            />
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <ActionButton
        intent="integration"
        size="sm"
        type="button"
        disabled={disabled || !listinoHref}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <svg className="size-3.5 shrink-0 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        {t.fornitori.rekkiOpenInApp}
      </ActionButton>
      {sheet}
    </>
  )
}
