'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogOut } from 'lucide-react'
import {
  fornitoreIdFromProfilePath,
  isFornitoreProfileRoute,
  normalizeAppPath,
} from '@/lib/mobile-hub-routes'
import { useLocale } from '@/lib/locale-context'
import { LOCALES } from '@/lib/translations'
import { LocaleCodeChip } from '@/components/ui/glyph-icons'
import { useT } from '@/lib/use-t'
import { createClient } from '@/utils/supabase/client'
import { clearSessionOperatorGate } from '@/lib/session-operator-gate'
import ConnectionStatusDot from '@/components/ConnectionStatusDot'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

const LANG_DIALOG_ID = 'mobile-topbar-lang-dialog'

export default function MobileTopbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const t = useT()
  const { locale, setLocale } = useLocale()
  const [langOpen, setLangOpen] = useState(false)
  const langTitleId = useId()
  const langCloseBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!langOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const raf = requestAnimationFrame(() => {
      langCloseBtnRef.current?.focus()
    })
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
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
    clearSessionOperatorGate()
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
    <header className="app-desktop-header-glass fixed top-0 left-1/2 z-30 w-[min(100vw-1rem,var(--app-layout-max-width))] max-w-[var(--app-layout-max-width)] -translate-x-1/2 pt-[env(safe-area-inset-top,0px)] md:hidden">
      <div className="flex h-[52px] min-h-[52px] items-center gap-1.5 px-2.5 ps-[max(0.625rem,env(safe-area-inset-left,0px))] pe-[max(0.625rem,env(safe-area-inset-right,0px))] sm:gap-2 sm:px-3">
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 sm:gap-2.5 pl-0.5 touch-manipulation"
          onClick={goLogoHome}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              goLogoHome()
            }
          }}
        >
          {/* Icon container — 32×32 */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f2a4a] ring-1 ring-[#22d3ee]/30">
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none" aria-hidden>
              <path
                d="M4 20 L16 8 L16 15 L28 15 L28 20"
                stroke="#22d3ee"
                strokeWidth="4.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d="M36 20 L24 32 L24 25 L12 25 L12 20"
                stroke="#5b7cf9"
                strokeWidth="4.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Wordmark */}
          <div className="flex items-baseline gap-1 leading-none">
            <span
              className="font-outfit text-[15px] tracking-tight sm:text-base"
              style={{ fontWeight: 600, color: '#22d3ee' }}
            >
              Smart
            </span>
            <span
              className="font-outfit text-[15px] tracking-tight sm:text-base"
              style={{ fontWeight: 300, color: 'rgb(255 255 255 / 0.85)' }}
            >
              Pair
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <ConnectionStatusDot />
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              className={`flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center gap-1 rounded-xl px-2 transition-colors ${
                langOpen
                  ? 'bg-app-line-15 text-app-fg ring-1 ring-app-a-30'
                  : 'text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15'
              }`}
              aria-expanded={langOpen}
              aria-haspopup="dialog"
              aria-controls={LANG_DIALOG_ID}
              aria-label={t.ui.languageTooltip}
              title={currentLocale ? `${t.ui.languageTooltip}: ${currentLocale.label}` : t.ui.languageTooltip}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-app-fg-muted">{locale}</span>
              <svg
                className={`h-3 w-3 shrink-0 text-app-cyan-500 opacity-70 transition-transform ${langOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {langOpen &&
              createPortal(
                <div
                  id={LANG_DIALOG_ID}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={langTitleId}
                  className="fixed inset-0 z-[200] flex items-center justify-center app-workspace-scrim px-4 pt-4 ring-1 ring-inset ring-app-line-10 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-4"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setLangOpen(false)
                  }}
                >
                  <div
                    className="app-card pointer-events-auto flex w-full max-w-sm flex-col overflow-hidden p-0 text-app-fg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="app-card-bar shrink-0" aria-hidden />
                    <div className="flex shrink-0 items-center justify-between border-b border-app-line-15 app-workspace-inset-bg-soft px-3 py-2.5 sm:px-4 sm:py-3">
                      <p id={langTitleId} className="text-base font-semibold tracking-tight text-app-fg">
                        {t.ui.languageTooltip}
                      </p>
                      <button
                        ref={langCloseBtnRef}
                        type="button"
                        onClick={() => setLangOpen(false)}
                        className="flex min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-xl text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg"
                        aria-label={t.ui.closeMenu}
                      >
                        <svg className={`h-5 w-5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div
                      className="max-h-[min(60dvh,22rem)] divide-y divide-app-line-10 overflow-y-auto overscroll-contain app-workspace-inset-bg py-0"
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
                          className={`flex w-full touch-manipulation items-center gap-2.5 px-4 py-3 text-left text-sm font-medium transition-colors sm:px-5 sm:py-3.5 ${
                            locale === l.code
                              ? 'bg-app-line-18 text-app-fg'
                              : 'text-app-fg-muted hover:bg-app-line-12 hover:text-app-fg'
                          }`}
                        >
                          <LocaleCodeChip code={l.code} className="h-7 min-w-[1.75rem] text-[10px]" />
                          <span className="truncate">{l.label}</span>
                          {locale === l.code && (
                            <svg
                              className="ml-auto h-4 w-4 shrink-0 text-app-cyan-500"
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
                  </div>
                </div>,
                document.body,
              )}
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-xl text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15"
            aria-label={t.nav.esci}
            title={t.nav.esci}
          >
            <LogOut className={`size-5 shrink-0 ${icon.destructive}`} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </header>
  )
}
