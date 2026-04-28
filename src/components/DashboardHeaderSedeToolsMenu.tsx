'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import SollecitiButton from '@/components/SollecitiButton'

import EmailSyncToolbarStatus from '@/components/EmailSyncToolbarStatus'

const TOOLBAR_ROW_CLS =
  'flex min-w-0 max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 md:flex-nowrap'

const TOOLBAR_ICON_BTN_CLS =
  'inline-flex h-7 min-h-7 max-h-7 shrink-0 items-center justify-center gap-0.5 rounded-md border border-app-line-35 app-workspace-inset-bg px-2 text-[10px] font-bold leading-none text-app-fg shadow-sm transition-colors hover:border-app-a-45 hover:shadow-[0_0_18px_-6px_rgba(34,211,238,0.28)] hover:brightness-110 active:brightness-95 whitespace-nowrap touch-manipulation sm:gap-1 sm:rounded-lg sm:px-2.5 sm:text-[11px]'

type PanelRect = { top: number; left: number; width: number }

/**
 * Solo master admin con più sedi: cambio sede attiva dal cookie (stessa logica del vecchio pannello «Strumenti»).
 */
function AdminSedeSwitcherToolbar() {
  const t = useT()
  const { me } = useMe()
  const { clearActiveOperator } = useActiveOperator()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null)
  const [activeSede, setActiveSede] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (typeof document === 'undefined') return
    const match = document.cookie.match(/(?:^|; )admin-sede-id=([^;]*)/)
    setActiveSede(match ? decodeURIComponent(match[1]) : null)
  }, [])

  const updatePanelRect = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const width = Math.min(320, Math.max(240, window.innerWidth - 16))
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const top = rect.bottom + 6
    setPanelRect({ top, left, width })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelRect(null)
      return
    }
    updatePanelRect()
    const onWin = () => updatePanelRect()
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open, updatePanelRect])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node
      if (triggerRef.current?.contains(node) || panelRef.current?.contains(node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isMasterAdmin = me?.role === 'admin'
  const sedi = me?.all_sedi ?? []
  if (!isMasterAdmin || sedi.length < 2) return null

  const switchSede = (sedeId: string) => {
    clearActiveOperator()
    document.cookie = 'fluxo-acting-role=; path=/; Max-Age=0; SameSite=Strict'
    document.cookie = `admin-sede-id=${sedeId}; path=/; SameSite=Strict`
    setActiveSede(sedeId)
    router.push('/')
    router.refresh()
    setOpen(false)
  }

  const panel =
    open && panelRect != null ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={t.dashboard.desktopHeaderSedeToolsMenuAria}
        style={{
          position: 'fixed',
          top: panelRect.top,
          left: panelRect.left,
          width: panelRect.width,
          zIndex: 500,
        }}
        className="rounded-xl border border-app-line-25 app-workspace-surface-elevated shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65)] backdrop-blur-md"
      >
        <div className="max-h-[min(70vh,22rem)] w-full overflow-y-auto p-3">
          <div className="flex w-full flex-col gap-1">
              {sedi.map((s) => {
                const isActive = s.id === activeSede
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => switchSede(s.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors touch-manipulation ${
                      isActive
                        ? 'border border-cyan-500/40 bg-cyan-500/12 text-cyan-100'
                        : 'border border-transparent text-app-fg-muted hover:border-app-line-22 hover:bg-app-line-10 hover:text-app-fg'
                    }`}
                  >
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-app-fg-muted/40'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">{s.nome}</span>
                    {isActive && (
                      <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
        </div>
      </div>
    ) : null

  return (
    <>
      <div className="relative flex shrink-0 items-center">
        <button
          ref={triggerRef}
          type="button"
          className={TOOLBAR_ICON_BTN_CLS}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? panelId : undefined}
          aria-label={t.dashboard.desktopHeaderSedeToolsMenuAria}
          onClick={() => setOpen((o) => !o)}
        >
          <svg className="h-3 w-3 shrink-0 text-cyan-300/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span className="hidden min-[380px]:inline">{t.sedi.titleGlobalAdmin}</span>
          <svg
            className={`h-3 w-3 shrink-0 text-app-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </>
  )
}

/**
 * Barra operatore desktop: solleciti (se >0), sync email (dropdown). Opzionale: switch sede admin.
 */
export default function DashboardHeaderSedeToolsMenu({
  fornitoriInScadenza = 0,
  lastImapSyncAt,
  lastImapSyncError,
}: {
  fornitoriInScadenza?: number
  lastImapSyncAt?: string | null
  lastImapSyncError?: string | null
}) {
  return (
    <div className={TOOLBAR_ROW_CLS}>
      <AdminSedeSwitcherToolbar />
      {fornitoriInScadenza > 0 ? (
        <SollecitiButton fornitoriInScadenza={fornitoriInScadenza} toolbarStrip />
      ) : null}
      <span className={`${TOOLBAR_ICON_BTN_CLS} max-w-[min(100%,280px)] cursor-default hover:brightness-100`}>
        <EmailSyncToolbarStatus lastImapSyncAt={lastImapSyncAt ?? null} lastImapSyncError={lastImapSyncError ?? null} />
      </span>
    </div>
  )
}
