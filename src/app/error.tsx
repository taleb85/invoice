'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import LoginBrandedShell from '@/components/LoginBrandedShell'
import { AuroraPanelShell } from '@/components/aurora/AuroraPanelShell'
import { getTranslations } from '@/lib/translations'
import { useCookieLocaleFallback } from '@/lib/use-cookie-locale-fallback'

/**
 * Catches errors in the root layout’s child tree when no nested error boundary applies
 * (e.g. login route). No <html>/<body> — those belong in global-error.tsx only.
 */
export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useCookieLocaleFallback()
  const t = getTranslations(locale)

  useEffect(() => {
    console.error('[RootErrorBoundary]', error)
  }, [error])

  return (
    <LoginBrandedShell>
      <div className="w-full max-w-md space-y-6 text-center" lang={locale}>
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

        <AuroraPanelShell tone="soft">
          <div className="space-y-4 px-8 py-8">
            <h1 className="app-page-title text-xl font-bold">{t.appStrings.errorGenericTitle}</h1>
            <p className="text-sm leading-relaxed text-app-fg-muted">{t.appStrings.errorGenericBody}</p>

            {error.digest && (
              <p className="rounded-xl border border-app-line-25 app-workspace-inset-bg px-3 py-2 font-mono text-[11px] text-app-fg-muted ring-1 ring-inset ring-white/5">
                {t.appStrings.errorCodeLabel} {error.digest}
              </p>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-xl bg-gradient-to-r from-app-cyan-500 to-app-cyan-400 px-4 py-2.5 text-sm font-semibold text-cyan-950 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-opacity hover:opacity-95 active:opacity-90"
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
  )
}
