'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/use-t'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id:      number
  type:    ToastType
  message: string
}

interface ToastCtx {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })

/** Stesso messaggio/tipo dell’ultimo toast: barra desktop `#app-desktop-header-nav-progress`. */
export type DesktopHeaderToastBanner = {
  message: string
  type: ToastType
} | null

const DesktopHeaderToastBannerContext = createContext<DesktopHeaderToastBanner>(null)

export function useToast() {
  return useContext(ToastContext)
}

export function useDesktopHeaderToastBanner(): DesktopHeaderToastBanner {
  return useContext(DesktopHeaderToastBannerContext)
}

/** Barra `#app-desktop-header-nav-progress` e riga logo sidebar: stesso bordo/sfondo (toast inclusi). */
export function desktopHeaderBarSurfaceClass(banner: DesktopHeaderToastBanner): string {
  if (!banner) {
    return 'border-b border-slate-800/30 bg-slate-950/40 shadow-none'
  }
  if (banner.type === 'success') {
    return 'border-b border-emerald-400/55 bg-gradient-to-r from-[#042f23]/98 via-emerald-950/92 to-[#042f23]/98 shadow-[0_6px_36px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(52,211,153,0.16)]'
  }
  if (banner.type === 'error') {
    return 'border-b border-red-400/55 bg-gradient-to-r from-[#3a0a0f]/98 via-red-950/92 to-[#3a0a0f]/98 shadow-[0_6px_36px_rgba(239,68,68,0.24),inset_0_1px_0_rgba(248,113,113,0.14)]'
  }
  return 'border-b border-cyan-500/40 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95 shadow-[0_6px_28px_rgba(6,182,212,0.14),inset_0_1px_0_rgba(34,211,238,0.1)]'
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [headerBanner, setHeaderBanner] = useState<DesktopHeaderToastBanner>(null)
  const counter = useRef(0)
  const headerBannerToastIdRef = useRef<number | null>(null)
  const headerBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHeaderBannerTimer = useCallback(() => {
    if (headerBannerTimerRef.current !== null) {
      clearTimeout(headerBannerTimerRef.current)
      headerBannerTimerRef.current = null
    }
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++counter.current
      setToasts((prev) => [...prev, { id, type, message }])

      clearHeaderBannerTimer()
      headerBannerToastIdRef.current = id
      setHeaderBanner({ message, type })
      headerBannerTimerRef.current = setTimeout(() => {
        headerBannerTimerRef.current = null
        if (headerBannerToastIdRef.current === id) {
          headerBannerToastIdRef.current = null
          setHeaderBanner(null)
        }
      }, 4500)

      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
      }, 4500)
    },
    [clearHeaderBannerTimer]
  )

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
      if (headerBannerToastIdRef.current === id) {
        headerBannerToastIdRef.current = null
        clearHeaderBannerTimer()
        setHeaderBanner(null)
      }
    },
    [clearHeaderBannerTimer]
  )

  return (
    <DesktopHeaderToastBannerContext.Provider value={headerBanner}>
      <ToastContext.Provider value={{ showToast }}>
        {children}
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </ToastContext.Provider>
    </DesktopHeaderToastBannerContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const tr = useT()
  if (typeof document === 'undefined' || toasts.length === 0) return null

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-[9999] flex flex-col gap-2 items-end sm:right-5 sm:top-5"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex max-w-xs animate-[slideInDown_0.2s_ease-out] items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-md ${
            toast.type === 'success'
              ? 'border-emerald-500/35 bg-emerald-950/90 text-emerald-50'
              : toast.type === 'error'
              ? 'border-red-500/35 bg-red-950/90 text-red-50'
              : 'border-slate-600/70 bg-slate-900/95 text-slate-100'
          }`}
        >
          {toast.type === 'success' && (
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}

          <span className="leading-snug">{toast.message}</span>

          <button
            onClick={() => onDismiss(toast.id)}
            className={`ml-1 shrink-0 opacity-60 transition-opacity hover:opacity-100 ${
              toast.type === 'success'
                ? 'text-emerald-200/80'
                : toast.type === 'error'
                  ? 'text-red-200/80'
                  : 'text-slate-400'
            }`}
            aria-label={tr.appStrings.toastDismiss}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
