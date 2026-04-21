'use client'

import { useState } from 'react'

type ApprovalStatus = 'pending' | 'approved' | 'rejected'

type ApprovalBadgeProps = {
  status: ApprovalStatus
  rejectionReason?: string | null
  size?: 'sm' | 'md'
}

export function ApprovalBadge({ status, rejectionReason, size = 'sm' }: ApprovalBadgeProps) {
  const [showReason, setShowReason] = useState(false)

  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  if (status === 'approved') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-400 ring-1 ring-emerald-500/30 ${textSize}`}
      >
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Approvata
      </span>
    )
  }

  if (status === 'rejected') {
    return (
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={() => setShowReason((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 font-semibold text-rose-400 ring-1 ring-rose-500/30 ${textSize} ${rejectionReason ? 'cursor-pointer hover:bg-rose-500/25' : ''}`}
        >
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Rifiutata
        </button>
        {showReason && rejectionReason && (
          <div className="absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-xl border border-rose-500/30 bg-[#1a1f35] p-3 shadow-xl">
            <p className="text-[11px] font-semibold text-rose-400">Motivo rifiuto</p>
            <p className="mt-1 text-[11px] text-app-fg-muted">{rejectionReason}</p>
          </div>
        )}
      </span>
    )
  }

  // pending
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-400 ring-1 ring-amber-500/30 ${textSize}`}
    >
      <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      In attesa
    </span>
  )
}
