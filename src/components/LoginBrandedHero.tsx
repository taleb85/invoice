'use client'

import { useLocale } from '@/lib/locale-context'

export default function LoginBrandedHero({ mode }: { mode: 'name' | 'admin' }) {
  const { t } = useLocale()

  return (
    <div className="flex flex-col items-center text-center mb-6 -mt-4">
      <svg
        viewBox="0 0 96 56"
        xmlns="http://www.w3.org/2000/svg"
        className="w-28 h-[68px] shrink-0 drop-shadow-[0_6px_24px_rgba(6,182,212,0.45)] mb-4"
        aria-hidden
      >
        <defs>
          <linearGradient id="lg-card" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>
          <linearGradient id="lg-wave" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5b7cf9" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect width="56" height="56" rx="13" fill="url(#lg-card)" />
        <path
          d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28"
          stroke="url(#lg-wave)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="7" cy="28" r="3.5" fill="#5b7cf9" />
        <circle cx="48" cy="28" r="3.5" fill="#38bdf8" />
        <circle cx="88" cy="28" r="3.5" fill="#22d3ee" />
      </svg>
      <h1 className="text-5xl font-extrabold tracking-widest bg-gradient-to-r from-[#7c9dff] via-[#5dd8ff] to-[#2ee8ff] bg-clip-text text-transparent leading-none drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
        FLUXO
      </h1>
      <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mt-2 bg-gradient-to-r from-[#7c9dff] via-[#5dd8ff] to-[#2ee8ff] bg-clip-text text-transparent opacity-80">
        {t.login.brandTagline}
      </p>
      {mode === 'name' ? (
        <p className="mt-6 max-w-[20rem] px-1 text-xs leading-snug text-white/90 text-balance">{t.login.subtitle}</p>
      ) : (
        <div className="mt-6 flex max-w-[20rem] flex-col items-center gap-1.5 px-1 text-center">
          <p className="text-[0.8125rem] font-semibold leading-snug tracking-tight text-cyan-200/95 text-balance">
            {t.login.adminSubtitle}
          </p>
          <p className="text-[11px] leading-relaxed text-slate-200 text-balance">{t.login.adminSubtitleHint}</p>
        </div>
      )}
    </div>
  )
}
