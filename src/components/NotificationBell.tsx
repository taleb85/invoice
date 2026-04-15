'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useNotificationCounts } from '@/lib/use-notification-counts'

type Props = {
  variant: 'inline' | 'fab' | 'header'
  isAdmin: boolean
  initialAdminErrors: number
  initialOperatorPending: number
  /** Errori sincronizzazione 24h (operatore) — sommati al badge con i documenti in coda. */
  initialOperatorLogErrors?: number
}

export default function NotificationBell({
  variant,
  isAdmin,
  initialAdminErrors,
  initialOperatorPending,
  initialOperatorLogErrors = 0,
}: Props) {
  const t = useT()
  const { effectiveSedeId } = useManualDeliverySede()
  const { adminLogErrors24h, operatorPendingDocs, operatorLogErrors24h, badgeCount, badgeVariant } =
    useNotificationCounts({
      isAdmin,
      effectiveSedeId,
      initialAdminErrors,
      initialOperatorPending,
      initialOperatorLogErrors,
    })

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnId = useId()
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
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

  const toggle = useCallback(() => setOpen((o) => !o), [])

  const showBadge = badgeCount > 0
  const badgeColor =
    badgeVariant === 'error'
      ? 'bg-red-600 text-white ring-2 ring-cyan-950/80'
      : badgeVariant === 'pending'
        ? 'bg-amber-500 text-cyan-950 ring-2 ring-cyan-950/80'
        : ''

  const buttonClass =
    variant === 'header'
      ? `relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-visible rounded-xl border border-app-line-40 bg-app-line-15 text-app-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_-8px_rgba(34,211,238,0.2)] transition-colors hover:border-app-a-55 hover:bg-app-line-25 hover:text-app-fg touch-manipulation`
      : variant === 'inline'
        ? `relative inline-flex h-8 min-w-8 shrink-0 items-center justify-center overflow-visible rounded-lg border border-app-line-35 app-workspace-inset-bg px-1 text-app-fg-muted transition-colors hover:border-app-a-45 hover:bg-app-line-10 touch-manipulation`
        : `relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full border border-app-line-40 app-workspace-inset-bg text-app-fg shadow-lg shadow-cyan-950/50 backdrop-blur-sm transition-colors hover:border-app-a-55 hover:bg-app-line-15 touch-manipulation`

  const menuPosition =
    variant === 'fab' ? 'bottom-full right-0 mb-2' : 'right-0 top-full mt-1.5'

  const menuSurface =
    variant === 'header'
      ? 'border border-app-line-30 app-workspace-surface-elevated shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5),0_0_28px_-10px_rgba(34,211,238,0.12)] ring-1 ring-inset ring-white/10 backdrop-blur-xl'
      : 'border border-app-line-30 app-workspace-surface-elevated shadow-xl shadow-black/40 ring-1 ring-inset ring-white/10 backdrop-blur-xl'

  const menu = open ? (
    <div
      id={menuId}
      role="menu"
      aria-labelledby={btnId}
      className={`absolute z-[120] min-w-[14rem] rounded-xl py-2 ${menuSurface} ${menuPosition}`}
    >
      <p className="border-b border-app-soft-border px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-app-fg-muted">
        {t.nav.notifications}
      </p>
      <div className="px-2 pt-2">
        {isAdmin ? (
          adminLogErrors24h > 0 ? (
            <Link
              href="/log"
              role="menuitem"
              className="block rounded-lg px-2 py-2 text-sm text-red-200 transition-colors hover:bg-red-950/40"
              onClick={() => setOpen(false)}
            >
              <span className="font-medium">{t.nav.errorAlert}</span>
              <span className="mt-0.5 block text-xs text-red-300/80">
                {adminLogErrors24h > 9 ? '9+' : adminLogErrors24h}
              </span>
            </Link>
          ) : (
            <p className="px-2 py-2 text-sm text-app-fg-muted">{t.nav.noNotifications}</p>
          )
        ) : operatorPendingDocs > 0 || operatorLogErrors24h > 0 ? (
          <div className="flex flex-col gap-1 px-2 pt-2">
            {operatorPendingDocs > 0 ? (
              <Link
                href="/statements/da-processare"
                role="menuitem"
                className="block rounded-lg px-2 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-950/30"
                onClick={() => setOpen(false)}
              >
                <span className="font-medium">{t.statements.tabDocumenti}</span>
                <span className="mt-0.5 block text-xs text-amber-200/70">
                  {operatorPendingDocs > 9 ? '9+' : operatorPendingDocs}
                </span>
              </Link>
            ) : null}
            {operatorLogErrors24h > 0 ? (
              <Link
                href="/log"
                role="menuitem"
                className="block rounded-lg px-2 py-2 text-sm text-red-200 transition-colors hover:bg-red-950/40"
                onClick={() => setOpen(false)}
              >
                <span className="font-medium">{t.nav.errorAlert}</span>
                <span className="mt-0.5 block text-xs text-red-300/80">
                  {operatorLogErrors24h > 9 ? '9+' : operatorLogErrors24h}
                </span>
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="px-2 py-2 text-sm text-app-fg-muted">{t.nav.noNotifications}</p>
        )}
      </div>
    </div>
  ) : null

  const inner = (
    <div className={`relative ${variant === 'fab' ? '' : ''}`} ref={wrapRef}>
      <button
        type="button"
        id={btnId}
        className={buttonClass}
        aria-label={t.nav.notifications}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        <Bell
          className={variant === 'fab' ? 'h-6 w-6' : variant === 'header' ? 'h-[18px] w-[18px]' : 'h-4 w-4'}
          aria-hidden
        />
        {showBadge ? (
          <span
            className={`pointer-events-none absolute right-0 top-0 z-10 flex h-4 min-w-4 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none ${badgeColor}`}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </button>
      {menu}
    </div>
  )

  if (variant === 'fab') {
    return (
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[101] flex justify-end px-3 md:hidden pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="pointer-events-auto">{inner}</div>
      </div>
    )
  }

  return inner
}
