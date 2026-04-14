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
      ? 'bg-red-600 text-white ring-2 ring-slate-700'
      : badgeVariant === 'pending'
        ? 'bg-amber-500 text-slate-950 ring-2 ring-slate-700'
        : ''

  const buttonClass =
    variant === 'header'
      ? `relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-visible rounded-xl border border-slate-500/45 bg-slate-600/35 text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:border-cyan-500/35 hover:bg-slate-600/55 hover:text-cyan-100 touch-manipulation`
      : variant === 'inline'
        ? `relative inline-flex h-8 min-w-8 shrink-0 items-center justify-center overflow-visible rounded-lg border border-slate-700/80 bg-slate-700/90 px-1 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 touch-manipulation`
        : `relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full border border-slate-600/90 bg-slate-700/95 text-slate-100 shadow-lg shadow-black/40 backdrop-blur-sm transition-colors hover:border-cyan-500/40 hover:bg-slate-700/95 touch-manipulation`

  const menuPosition =
    variant === 'fab' ? 'bottom-full right-0 mb-2' : 'right-0 top-full mt-1.5'

  const menuSurface =
    variant === 'header'
      ? 'border border-slate-500/50 bg-slate-600 shadow-2xl shadow-black/40 backdrop-blur-md'
      : 'border border-slate-700/80 bg-slate-700/98 shadow-xl shadow-black/50 backdrop-blur-md'

  const menu = open ? (
    <div
      id={menuId}
      role="menu"
      aria-labelledby={btnId}
      className={`absolute z-[120] min-w-[14rem] rounded-xl py-2 ${menuSurface} ${menuPosition}`}
    >
      <p className="border-b border-slate-600/80 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
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
