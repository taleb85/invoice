import Link from 'next/link'
import { cookies } from 'next/headers'
import LoginBrandedShell from '@/components/LoginBrandedShell'
import { getTranslations, type Locale } from '@/lib/translations'

const SUPPORTED: Locale[] = ['it', 'en', 'fr', 'de', 'es']

export default async function NotFound() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('app-locale')?.value ?? 'en'
  const locale: Locale = SUPPORTED.includes(raw as Locale) ? (raw as Locale) : 'en'
  const t = getTranslations(locale)

  return (
    <LoginBrandedShell>
      <div className="w-full max-w-md space-y-6 text-center">
        <Link href="/" className="group inline-flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-a-35 bg-app-line-15 shadow-[0_0_24px_rgba(34,211,238,0.22)] ring-1 ring-inset ring-white/10 transition-colors group-hover:border-app-tint-300-45 group-hover:bg-app-line-22">
            <svg className="h-5 w-5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-app-fg-muted">Smart Pair</span>
        </Link>

        <div className="app-card-login flex flex-col overflow-hidden">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="space-y-5 px-8 py-8">
            <div className="space-y-1">
              <p className="select-none text-7xl font-black leading-none text-app-line-35">404</p>
              <h1 className="app-page-title text-xl font-bold">{t.appStrings.pageNotFoundTitle}</h1>
            </div>

            <p className="text-sm leading-relaxed text-app-fg-muted">{t.appStrings.pageNotFoundDesc}</p>

            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
              <Link
                href="/"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-app-cyan-500 to-app-cyan-400 px-4 py-2.5 text-sm font-semibold text-cyan-950 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-opacity hover:opacity-95"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                {t.appStrings.backToHome}
              </Link>
              <Link
                href="/fornitori"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-app-line-35 app-workspace-inset-bg-soft px-4 py-2.5 text-sm font-medium text-app-fg-muted transition-colors hover:border-app-a-45 hover:bg-app-line-10 hover:text-app-fg"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {t.nav.fornitori}
              </Link>
            </div>
          </div>
        </div>

        <p className="text-xs text-app-fg-muted">{t.appStrings.brandFooter}</p>
      </div>
    </LoginBrandedShell>
  )
}
