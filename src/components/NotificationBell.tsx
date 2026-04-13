'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { useNotificationCounts } from '@/lib/use-notification-counts'

type Props = {
  variant: 'inline' | 'fab'
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
  const { adminLogErrors24h, operatorPendingDocs, badgeCount, badgeVariant } =
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
      ? 'bg-red-600 text-white ring-2 ring-slate-950'
      : badgeVariant === 'pending'
        ? 'bg-amber-500 text-slate-950 ring-2 ring-slate-950'
        : ''

  const buttonClass =
    variant === 'inline'
      ? `relative inline-flex h-10 min-w-10 shrink-0 items-center justify-center overflow-visible rounded-lg border border-slate-700/80 bg-slate-800/90 px-1 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 touch-manipulation`
      : `relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full border border-slate-600/90 bg-slate-900/95 text-slate-100 shadow-lg shadow-black/40 backdrop-blur-sm transition-colors hover:border-cyan-500/40 hover:bg-slate-800/95 touch-manipulation`

  const menu = open ? (
    <div
      id={menuId}
      role="menu"
      aria-labelledby={btnId}
      className={`absolute z-[120] min-w-[14rem] rounded-xl border border-slate-700/80 bg-slate-900/98 py-2 shadow-xl shadow-black/50 backdrop-blur-md ${
        variant === 'fab' ? 'bottom-full right-0 mb-2' : 'right-0 top-full mt-2'
      }`}
    >
      <p className="border-b border-slate-800 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
            <p className="px-2 py-2 text-sm text-slate-500">{t.nav.noNotifications}</p>
          )
        ) : operatorPendingDocs > 0 ? (
          <div className="flex flex-col gap-1 px-2 pt-2">
            <Link
              href="/archivio"
              role="menuitem"
              className="block rounded-lg px-2 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-950/30"
              onClick={() => setOpen(false)}
            >
              <span className="font-medium">{t.archivio.title}</span>
              <span className="mt-0.5 block text-xs text-amber-200/70">
                {operatorPendingDocs > 9 ? '9+' : operatorPendingDocs}
              </span>
            </Link>
          </div>
        ) : (
          <p className="px-2 py-2 text-sm text-slate-500">{t.nav.noNotifications}</p>
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
        <Bell className={variant === 'fab' ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden />
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
