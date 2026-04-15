'use client'

import { useId } from 'react'

/**
 * Schermata di attesa al caricamento della scheda fornitore (sostituisce lo skeleton a “schede schiacciate”).
 */
export default function FluxoSupplierProfileLoading({
  message,
  tagline,
}: {
  message: string
  tagline: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const cardBg = `fpl-bg-${uid}`
  const wave = `fpl-wave-${uid}`
  const textGrad = `fpl-tx-${uid}`

  return (
    <div className="mx-auto flex min-h-[min(70vh,32rem)] max-w-6xl flex-col items-center justify-center px-4 py-12 md:px-5 md:py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          <svg
            viewBox="0 0 96 56"
            xmlns="http://www.w3.org/2000/svg"
            className="h-[4.5rem] w-[6.75rem] shrink-0 sm:h-[5.25rem] sm:w-[7.875rem]"
            aria-hidden
          >
            <defs>
              <linearGradient id={cardBg} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a5f" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>
              <linearGradient id={wave} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5b7cf9" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <rect width="56" height="56" rx="13" fill={`url(#${cardBg})`} />
            <path
              d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28"
              stroke={`url(#${wave})`}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="7" cy="28" r="3.5" fill="#5b7cf9" />
            <circle cx="48" cy="28" r="3.5" fill="#38bdf8" />
            <circle cx="88" cy="28" r="3.5" fill="#22d3ee" />
          </svg>

          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <svg viewBox="0 0 130 32" className="h-9 w-[7.25rem] sm:h-10 sm:w-32" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <defs>
                <linearGradient id={textGrad} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6b8ef5" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <text
                x="0"
                y="24"
                fontFamily="Arial Black, Arial, sans-serif"
                fontWeight="900"
                fontSize="26"
                fill={`url(#${textGrad})`}
              >
                FLUXO
              </text>
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-fg-muted sm:text-left">{tagline}</span>
          </div>
        </div>

        <div className="w-full space-y-4" role="status" aria-live="polite">
          <p className="text-sm font-medium leading-relaxed text-app-fg-muted sm:text-base">{message}</p>
          <div
            className="relative mx-auto h-1 w-40 overflow-hidden rounded-full app-workspace-surface-elevated sm:w-48"
            aria-hidden
          >
            <div className="animate-fluxo-supplier-profile-loading-bar absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-app-line-85 via-app-cyan-400 to-emerald-400/90 shadow-[0_0_12px_rgba(34,211,238,0.28)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
