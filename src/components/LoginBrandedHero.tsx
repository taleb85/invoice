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
    <div className="mb-6 flex w-full flex-col items-center text-center">

      {/* ── Brand area ── */}
      <div className="mb-5 flex flex-col items-center gap-2.5">

        {/* Icon — corrected arrow paths */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0f2a4a] ring-1 ring-[#22d3ee]/30 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
          <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden>
            <path
              d="M6 22 L18 10 L18 17 L32 17 L32 22"
              stroke="#22d3ee"
              strokeWidth="3.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M34 22 L22 34 L22 27 L8 27 L8 22"
              stroke="#5b7cf9"
              strokeWidth="3.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Wordmark + tagline — shown in both states */}
        <div className="mt-3 flex flex-col items-center gap-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-outfit text-lg font-medium" style={{ color: '#22d3ee' }}>
              Smart
            </span>
            <span className="font-outfit text-lg font-light text-white/85">
              Pair
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-[3px]" style={{ color: 'rgb(34 211 238 / 0.4)' }}>
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

      {/* Sottotitolo dinamico */}
      {mode === 'name' ? (
        <p className="mt-4 max-w-xs px-1 text-xs leading-relaxed text-white/45 text-balance">
          {t.login.subtitle}
        </p>
      ) : (
        <div className="mt-4 flex max-w-xs flex-col items-center gap-1 px-1 text-center">
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
