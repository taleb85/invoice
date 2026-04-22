'use client'

import { useLocale } from '@/lib/locale-context'

interface Props {
  mode: 'name' | 'admin'
  /** Nome sede risolto dal lookup corrente o dalla memoria localStorage. */
  sedeNome?: string | null
  /** true = sede proveniente da localStorage (ultima sede), non ancora confermata dal lookup. */
  remembered?: boolean
}

export default function LoginBrandedHero({ mode, sedeNome, remembered }: Props) {
  const { t } = useLocale()

  const displayName = sedeNome?.trim() || null

  return (
    <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6">

      {/* ── Brand area ── */}
      <div className="mb-3 flex flex-col items-center gap-2 sm:mb-5 sm:gap-2.5">

        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f2a4a] ring-1 ring-[#22d3ee]/30 shadow-[0_0_24px_rgba(34,211,238,0.2)] sm:h-16 sm:w-16">
          <svg width="36" height="36" viewBox="0 0 64 64" fill="none" aria-hidden className="sm:hidden">
            <path d="M8 32 L22 18 L22 26 L42 26 L42 32" stroke="#22d3ee" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M56 32 L42 46 L42 38 L22 38 L22 32" stroke="#5b7cf9" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" aria-hidden className="hidden sm:block">
            <path d="M8 32 L22 18 L22 26 L42 26 L42 32" stroke="#22d3ee" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M56 32 L42 46 L42 38 L22 38 L22 32" stroke="#5b7cf9" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>

        {/* Wordmark + tagline — shown in both states */}
        <div className="mt-1.5 flex flex-col items-center gap-0.5 sm:mt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-outfit text-xl font-medium sm:text-2xl" style={{ color: '#22d3ee' }}>
              Smart
            </span>
            <span className="font-outfit text-xl font-light text-white/85 sm:text-2xl">
              Pair
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[3px]" style={{ color: 'rgb(34 211 238 / 0.4)' }}>
            Invoice Management
          </span>
        </div>

        {/* Sede name + "last branch" label — sede-selected state only */}
        {displayName && (
          <div>
            <h1
              className={[
                'text-lg font-bold tracking-wide transition-all duration-300',
                remembered
                  ? 'text-white/70 drop-shadow-[0_0_8px_rgba(255,255,255,0.08)]'
                  : 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]',
              ].join(' ')}
            >
              {displayName}
            </h1>
            {remembered && (
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                last branch
              </p>
            )}
          </div>
        )}
      </div>

      {/* Sottotitolo dinamico — nascosto su mobile per risparmiare spazio */}
      {mode === 'name' ? (
        <p className="hidden max-w-xs px-1 text-xs leading-relaxed text-white/45 text-balance sm:mt-4 sm:block">
          {t.login.subtitle}
        </p>
      ) : (
        <div className="hidden max-w-xs flex-col items-center gap-1 px-1 text-center sm:mt-4 sm:flex">
          <p className="text-[0.8125rem] font-semibold leading-snug text-white/80 text-balance">
            {t.login.adminSubtitle}
          </p>
          <p className="text-[11px] leading-relaxed text-white/45 text-balance">
            {t.login.adminSubtitleHint}
          </p>
        </div>
      )}
    </div>
  )
}
