'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface ScannerCameraModalProps {
  open: boolean
  onClose: () => void
  onCapture: () => void
  videoRef: RefObject<HTMLVideoElement | null>
  cancelLabel: string
  captureLabel: string
}

export default function ScannerCameraModal({
  open,
  onClose,
  onCapture,
  videoRef,
  cancelLabel,
  captureLabel,
}: ScannerCameraModalProps) {
  const [portalReady, setPortalReady] = useState(false)
  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  if (!open || !portalReady) return null

  /**
   * `DashboardMobileBottomNav` è sibling di `AppShellMain` (z-100): un `fixed` dentro
   * `#app-main` non può coprire il dock. Portal su `body`, z tra dock (100) e OperatorSwitchModal (220).
   */
  return createPortal(
    <div
      className="app-workspace-overlay fixed inset-0 z-[215] flex flex-col p-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-camera-title"
    >
      <p id="scanner-camera-title" className="sr-only">
        {captureLabel}
      </p>
      <video
        ref={videoRef}
        className="min-h-0 w-full flex-1 rounded-xl border border-app-line-25 bg-black object-contain"
        playsInline
        muted
        autoPlay
      />
      <div className="mt-3 flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-app-line-30 app-workspace-inset-bg-soft py-3 text-sm font-bold text-app-fg-muted transition-colors hover:border-app-a-45 hover:brightness-110 hover:text-app-fg"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onCapture}
          className="app-glow-cyan flex-1 rounded-xl border border-app-line-35 bg-app-cyan-500 py-3 text-sm font-extrabold text-cyan-950 transition-colors hover:bg-app-cyan-400 active:bg-cyan-600"
        >
          {captureLabel}
        </button>
      </div>
    </div>,
    document.body,
  )
}
