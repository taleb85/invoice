'use client'

import { useLocale } from '@/lib/locale-context'
import { SmartPairLogo } from '@/components/smart-pair-logo'

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

      {/* ── Brand sede dinamico ── */}
      <div className="mb-5 flex flex-col items-center gap-2.5">
        {/* Icona / placeholder logo */}
        <div
          className={[
            'flex h-16 w-16 items-center justify-center rounded-2xl ring-1 transition-all duration-300',
            displayName
              ? 'bg-gradient-to-br from-emerald-700/70 to-emerald-900/80 shadow-[0_0_32px_rgba(16,185,129,0.28)] ring-emerald-500/30'
              : 'bg-gradient-to-br from-slate-700/60 to-slate-900/70 shadow-[0_0_24px_rgba(99,102,241,0.18)] ring-white/10',
          ].join(' ')}
        >
          {displayName ? (
            /* Foglia basilico stilizzata */
            <svg
              className="h-9 w-9 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 3C7 3 3 7.5 3 12c0 4 2.5 7.5 6 9 .5-3 1-5 3-7-2 2-2.5 4-2.5 6.5M12 3c5 0 9 4.5 9 9 0 4-2.5 7.5-6 9-.5-3-1-5-3-7 2 2 2.5 4 2.5 6.5"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v18" />
            </svg>
          ) : (
            /* Icona generica (casa/azienda) quando la sede non è nota */
            <svg
              className="h-8 w-8 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
            </svg>
          )}
        </div>

        {/* Nome sede o titolo generico */}
        <div>
          {displayName ? (
            <>
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
            </>
          ) : (
            <h1 className="text-base font-semibold tracking-wide text-white/60">
              Smart Pair
            </h1>
          )}
        </div>
      </div>

      {/* ── Powered by Smart Pair ── */}
      <div className="flex items-center gap-2 opacity-60">
        <SmartPairLogo variant="icon" size="sm" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          powered by Smart Pair
        </span>
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
