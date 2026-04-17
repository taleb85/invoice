'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type AppSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Contenuto sotto l’intestazione (scrollabile). */
  children: ReactNode
  /** Etichetta pulsante chiusura (es. «Chiudi»). */
  closeLabel: string
  /** Etichetta accessibile per lo scrim. */
  scrimCloseLabel: string
  /** Larghezza pannello (default stretto; `wide` per iframe / contenuti larghi; con `variant="center"` il modale `wide` usa quasi tutto lo schermo). */
  size?: 'default' | 'wide'
  /** `side`: slide da destra; `center`: finestra modale centrata (popup in-app). */
  variant?: 'side' | 'center'
  /** Classi aggiuntive sul wrapper del corpo (es. `overflow-hidden p-0` per iframe a tutta altezza). */
  bodyClassName?: string
}

/**
 * Pannello laterale stile Shadcn Sheet (slide da destra), senza dipendenze Radix.
 */
export function AppSheet({
  open,
  onOpenChange,
  title,
  children,
  closeLabel,
  scrimCloseLabel,
  size = 'default',
  variant = 'side',
  bodyClassName = '',
}: AppSheetProps) {
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

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

  if (!open || !mounted) return null

  const sidePanelClass =
    size === 'wide'
      ? 'pointer-events-auto absolute inset-y-0 right-0 z-[212] flex h-[100dvh] w-full max-w-[min(100vw,56rem)] flex-col border-l border-app-line-25 shadow-2xl sm:max-w-[min(100vw,56rem)] backdrop-blur-xl'
      : 'pointer-events-auto absolute inset-y-0 right-0 z-[212] flex h-[100dvh] w-full max-w-[min(100vw,28rem)] flex-col border-l border-app-line-25 shadow-2xl sm:max-w-md backdrop-blur-xl'

  const centerPanelClass =
    size === 'wide'
      ? 'pointer-events-auto absolute left-1/2 top-1/2 z-[212] flex h-[min(96dvh,64rem)] w-[min(calc(100vw-1rem),90rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-app-line-25 shadow-2xl backdrop-blur-xl'
      : 'pointer-events-auto absolute left-1/2 top-1/2 z-[212] flex max-h-[min(92dvh,40rem)] w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-app-line-25 shadow-2xl backdrop-blur-xl'

  const panelClassName = variant === 'center' ? centerPanelClass : sidePanelClass
  const panelStyle = {
    background: 'linear-gradient(to bottom right, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.92))',
    boxShadow: '0 0 40px -10px rgba(6, 182, 212, 0.2), 0 24px 48px -12px rgba(0, 0, 0, 0.5)'
  }

  return createPortal(
    <div className="fixed inset-0 z-[210]">
      <button
        type="button"
        className="absolute inset-0 z-[211] app-workspace-inset-bg/80 backdrop-blur-sm"
        aria-label={scrimCloseLabel}
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={panelClassName}
        style={panelStyle}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-app-line-22 px-4 py-3 sm:px-5">
          <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold text-app-fg">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg border border-app-line-32 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-app-fg transition-colors hover:bg-white/[0.1]"
          >
            {closeLabel}
          </button>
        </div>
        <div
          className={
            bodyClassName
              ? `min-h-0 flex-1 ${bodyClassName}`
              : 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
          }
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
