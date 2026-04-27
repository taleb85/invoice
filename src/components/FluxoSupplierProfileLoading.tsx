'use client'

/**
 * Schermata di attesa al caricamento della scheda fornitore (sostituisce lo skeleton a “schede schiacciate”).
 * Stesso wordmark e icona usati in shell / login (non il vecchio logo “onda”).
 */
export default function FluxoSupplierProfileLoading({
  message,
  tagline,
}: {
  message: string
  tagline: string
}) {
  return (
    <div className="mx-auto flex min-h-[min(70vh,32rem)] max-w-6xl flex-col items-center justify-center px-4 py-12 md:px-5 md:py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0f2a4a] shadow-[0_0_32px_rgba(34,211,238,0.2)] ring-1 ring-[#22d3ee]/30 sm:h-[4.5rem] sm:w-[4.5rem]">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" className="sm:h-[3.5rem] sm:w-[3.5rem]" aria-hidden>
              <path
                d="M8 32 L22 18 L22 26 L42 26 L42 32"
                stroke="#22d3ee"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d="M56 32 L42 46 L42 38 L22 38 L22 32"
                stroke="#5b7cf9"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="flex flex-col items-center gap-1.5 sm:items-start">
            <div className="flex items-baseline gap-1.5">
              <span className="font-outfit text-2xl font-medium text-[#22d3ee] sm:text-3xl">Smart</span>
              <span className="font-outfit text-2xl font-light text-white/85 sm:text-3xl">Pair</span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-app-fg-muted sm:text-left">
              {tagline}
            </span>
          </div>
        </div>

        <div className="w-full space-y-4" role="status" aria-live="polite">
          <p className="text-sm font-medium leading-relaxed text-app-fg-muted sm:text-base">{message}</p>
          <div
            className="app-workspace-surface-elevated relative mx-auto h-1 w-40 overflow-hidden rounded-full sm:w-48"
            aria-hidden
          >
            <div className="animate-fluxo-supplier-profile-loading-bar absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-app-line-85 via-app-cyan-400 to-emerald-400/90 shadow-[0_0_12px_rgba(34,211,238,0.28)]" />
          </div>
        </div>
      </div>
    </div>
  )
}
