import Link from 'next/link'
import { cookies } from 'next/headers'
import { AuroraPanelShell } from '@/components/aurora/AuroraPanelShell'
import { getTranslations, type Locale } from '@/lib/translations'

const SUPPORTED: Locale[] = ['it', 'en', 'fr', 'de', 'es']

/**
 * Mostrato quando `notFound()` è chiamato da route sotto (app), es. bolla/fattura
 * inesistente o non visibile (RLS). Evita il messaggio generico “pagina rimossa”.
 */
export default async function AppNotFound() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('app-locale')?.value ?? 'en'
  const locale: Locale = SUPPORTED.includes(raw as Locale) ? (raw as Locale) : 'en'
  const t = getTranslations(locale)

  const secondary =
    'inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg border-t-2 border-t-[#22d3ee] border-x-0 border-b-0 app-workspace-inset-bg-soft px-4 py-2.5 text-sm font-medium text-app-fg-muted transition-colors hover:border-app-a-45 hover:bg-app-line-10 hover:text-app-fg'

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Link href="/" className="group inline-flex items-center justify-center gap-2.5 rounded-lg">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-a-35 bg-[#0f2a4a] shadow-[0_0_24px_rgba(34,211,238,0.22)] ring-1 ring-inset ring-[#22d3ee]/30 transition-colors group-hover:border-app-tint-300-45 group-hover:bg-[#0f2a4a]/80">
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden>
              <path d="M4 20 L16 8 L16 15 L28 15 L28 20" stroke="#22d3ee" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round"/>
              <path d="M36 20 L24 32 L24 25 L12 25 L12 20" stroke="#5b7cf9" strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-app-fg-muted">Smart Pair</span>
        </Link>

        <AuroraPanelShell>
          <div className="space-y-5 px-8 py-8">
          <div className="space-y-1">
            <p className="select-none text-7xl font-black leading-none text-app-line-35">404</p>
            <h1 className="app-page-title text-xl font-bold">{t.appStrings.notFoundInAppTitle}</h1>
          </div>

          <p className="text-sm leading-relaxed text-app-fg-muted">{t.appStrings.notFoundInAppDesc}</p>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap">
            <Link
              href="/"
              className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-app-cyan-500 to-app-cyan-400 px-4 py-2.5 text-sm font-semibold text-cyan-950 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-opacity hover:opacity-95"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              {t.appStrings.backToHome}
            </Link>
            <Link href="/fornitori" className={secondary}>
              {t.nav.fornitori}
            </Link>
            <Link href="/bolle" className={secondary}>
              {t.nav.bolle}
            </Link>
            <Link href="/fatture" className={secondary}>
              {t.nav.fatture}
            </Link>
          </div>
        </div>
        </AuroraPanelShell>

        <p className="text-xs text-app-fg-muted">{t.appStrings.brandFooter}</p>
      </div>
    </div>
  )
}
