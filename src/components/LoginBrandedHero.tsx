'use client'

import { useLocale } from '@/lib/locale-context'

export default function LoginBrandedHero({ mode }: { mode: 'name' | 'admin' }) {
  const { t } = useLocale()

  return (
    <div className="mb-6 flex w-full flex-col items-center text-center">

      {/* ── Brand ristorante ── */}
      <div className="mb-5 flex flex-col items-center gap-2">
        {/* Icona foglia/ristorante — placeholder logo Osteria Basilico */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-700/70 to-emerald-900/80 shadow-[0_0_32px_rgba(16,185,129,0.28)] ring-1 ring-emerald-500/30">
          <svg
            className="h-9 w-9 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.55)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            {/* Foglia basilico stilizzata */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 3C7 3 3 7.5 3 12c0 4 2.5 7.5 6 9 .5-3 1-5 3-7-2 2-2.5 4-2.5 6.5M12 3c5 0 9 4.5 9 9 0 4-2.5 7.5-6 9-.5-3-1-5-3-7 2 2 2.5 4 2.5 6.5"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v18" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
            Osteria Basilico
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400/80">
            Gestionale Acquisti
          </p>
        </div>
      </div>

      {/* ── Powered by FLUXO ── */}
      <div className="flex items-center gap-2">
        <svg
          viewBox="0 0 96 56"
          xmlns="http://www.w3.org/2000/svg"
          className="h-[22px] w-9 shrink-0 opacity-70"
          aria-hidden
        >
          <defs>
            <linearGradient id="lg-card-sm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#172554" />
            </linearGradient>
            <linearGradient id="lg-wave-sm" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5b7cf9" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <rect width="56" height="56" rx="13" fill="url(#lg-card-sm)" />
          <path d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28" stroke="url(#lg-wave-sm)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="7" cy="28" r="3.5" fill="#5b7cf9" />
          <circle cx="48" cy="28" r="3.5" fill="#38bdf8" />
          <circle cx="88" cy="28" r="3.5" fill="#22d3ee" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          powered by FLUXO
        </span>
      </div>

      {/* Sottotitolo dinamico */}
      {mode === 'name' ? (
        <p className="mt-4 max-w-xs px-1 text-xs leading-relaxed text-white/50 text-balance">
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
