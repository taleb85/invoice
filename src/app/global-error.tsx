'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import './globals.css'
import LoginBrandedShell from '@/components/LoginBrandedShell'
import { AuroraPanelShell } from '@/components/aurora/AuroraPanelShell'
import { getTranslations } from '@/lib/translations'
import { useCookieLocaleFallback } from '@/lib/use-cookie-locale-fallback'

/**
 * Root layout error boundary — must render its own <html> and <body>.
 * Stesso linguaggio cromatico di `error.tsx` e login (vetro scuro + cyan).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useCookieLocaleFallback()
  const t = getTranslations(locale)

  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="h-full min-h-dvh bg-[#020617] text-app-fg-muted">
        <LoginBrandedShell>
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-app-a-35 bg-app-line-15 shadow-[0_0_28px_rgba(34,211,238,0.22)] ring-1 ring-inset ring-white/10">
                <svg className="h-7 w-7 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <AuroraPanelShell tone="soft" className="text-left">
              <div className="space-y-4 px-8 py-8">
                <h1 className="app-page-title text-xl font-bold">{t.appStrings.errorFatalTitle}</h1>
                <p className="text-sm leading-relaxed text-app-fg-muted">
                  {t.appStrings.errorFatalBody}
                  {error.digest ? (
                    <span className="mt-2 block rounded-xl border border-app-line-25 app-workspace-inset-bg px-3 py-2 font-mono text-[11px] text-app-fg-muted ring-1 ring-inset ring-white/5">
                      {t.appStrings.errorCodeLabel} {error.digest}
                    </span>
                  ) : null}
                </p>

                <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 rounded-xl bg-gradient-to-r from-app-cyan-500 to-app-cyan-400 px-4 py-2.5 text-sm font-semibold text-cyan-950 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-opacity hover:opacity-95"
                  >
                    {t.appStrings.tryAgain}
                  </button>
                  <Link
                    href="/"
                    className="flex-1 rounded-xl border border-app-line-35 app-workspace-inset-bg-soft px-4 py-2.5 text-center text-sm font-medium text-app-fg-muted transition-colors hover:border-app-a-45 hover:bg-app-line-10 hover:text-app-fg"
                  >
                    {t.appStrings.backToHome}
                  </Link>
                </div>
              </div>
            </AuroraPanelShell>

            <p className="text-xs text-app-fg-muted">{t.appStrings.brandFooter}</p>
          </div>
        </LoginBrandedShell>
      </body>
    </html>
  )
}
