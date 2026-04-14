'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  fornitoreIdFromProfilePath,
  isFornitoreProfileRoute,
  normalizeAppPath,
} from '@/lib/mobile-hub-routes'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { LOCALES } from '@/lib/translations'
import { useT } from '@/lib/use-t'
import { createClient } from '@/utils/supabase/client'
import ConnectionStatusDot from '@/components/ConnectionStatusDot'
import NotificationBell from '@/components/NotificationBell'

export default function MobileTopbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const { me } = useMe()
  const { locale, setLocale } = useLocale()
  const [langOpen, setLangOpen] = useState(false)
  const langWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!langOpen) return
    const onDoc = (e: MouseEvent) => {
      if (langWrapRef.current && !langWrapRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [langOpen])

  const currentLocale = LOCALES.find((l) => l.code === locale)

  const handleLogout = async () => {
    try {
      localStorage.removeItem('fluxo-active-operator')
      localStorage.removeItem('fluxo-active-operator-user')
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const normalizedPath = normalizeAppPath(pathname ?? '')
  const fornitoreProfileId = fornitoreIdFromProfilePath(normalizedPath)
  const onFornitoreProfile = isFornitoreProfileRoute(normalizedPath) && !!fornitoreProfileId

  const goLogoHome = () => {
    if (onFornitoreProfile && fornitoreProfileId) {
      router.push(`/fornitori/${fornitoreProfileId}`, { scroll: false })
      return
    }
    router.push('/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-slate-500/40 bg-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_-6px_rgba(0,0,0,0.22)] md:hidden">
      <div className="flex h-14 items-center gap-2 px-3">
        <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 pl-0.5" onClick={goLogoHome}>
          <svg viewBox="0 0 96 56" xmlns="http://www.w3.org/2000/svg" className="h-7 w-12 shrink-0">
            <defs>
              <linearGradient id="tb-card-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a5f" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>
              <linearGradient id="tb-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5b7cf9" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <rect width="56" height="56" rx="13" fill="url(#tb-card-bg)" />
            <path
              d="M7 28 C18 10, 34 10, 48 28 S72 46, 88 28"
              stroke="url(#tb-wave)"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="7" cy="28" r="3.5" fill="#5b7cf9" />
            <circle cx="48" cy="28" r="3.5" fill="#38bdf8" />
            <circle cx="88" cy="28" r="3.5" fill="#22d3ee" />
          </svg>

          <div className="flex flex-col gap-0.5 leading-none">
            <svg viewBox="0 0 130 32" className="h-auto w-20" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="tb-text" x1="0%" y1="0%" x2="100%" y2="0%">
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
                fill="url(#tb-text)"
              >
                FLUXO
              </text>
            </svg>
            <span className="-mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-200">
              {t.ui.tagline}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ConnectionStatusDot />
          <NotificationBell
            variant="header"
            isAdmin={Boolean(me?.is_admin)}
            initialAdminErrors={0}
            initialOperatorPending={0}
            initialOperatorLogErrors={0}
          />
        </div>

        <div className="relative shrink-0" ref={langWrapRef}>
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className={`flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center gap-1 rounded-xl px-2 transition-colors ${
              langOpen
                ? 'bg-white/12 text-slate-100'
                : 'text-slate-200 hover:bg-white/10 hover:text-white active:bg-white/15'
            }`}
            aria-expanded={langOpen}
            aria-haspopup="listbox"
            aria-label={t.ui.languageTooltip}
            title={currentLocale ? `${t.ui.languageTooltip}: ${currentLocale.label}` : t.ui.languageTooltip}
          >
            <span className="text-xs font-bold uppercase tracking-wide text-slate-200">{locale}</span>
            <svg
              className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${langOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {langOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-500/50 bg-slate-600 py-1 shadow-2xl shadow-black/40"
              role="listbox"
            >
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={locale === l.code}
                  onClick={() => {
                    if (l.code === locale) {
                      setLangOpen(false)
                      return
                    }
                    setLocale(l.code)
                    setLangOpen(false)
                  }}
                  className={`flex w-full touch-manipulation items-center gap-2.5 px-3 py-2.5 text-left text-[11px] font-medium transition-colors ${
                    locale === l.code
                      ? 'bg-cyan-500/15 text-white'
                      : 'text-slate-200 hover:bg-white/10 hover:text-slate-100'
                  }`}
                >
                  <span className="text-base leading-none">{l.flag}</span>
                  <span className="truncate">{l.label}</span>
                  {locale === l.code && (
                    <svg
                      className="ml-auto h-3 w-3 shrink-0 text-cyan-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-xl text-slate-200 transition-colors hover:bg-white/10 hover:text-cyan-300 active:bg-white/15"
          aria-label={t.nav.esci}
          title={t.nav.esci}
        >
          <svg className="size-5 shrink-0 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}
