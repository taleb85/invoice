'use client'

import { useEffect } from 'react'
import Link from 'next/link'
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4" lang={locale}>
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500 shadow-lg">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="app-card-login flex flex-col overflow-hidden">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="space-y-4 px-8 py-8">
          <h1 className="text-xl font-bold text-slate-100">
            {t.appStrings.errorGenericTitle}
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            {t.appStrings.errorGenericBody}
          </p>

          {error.digest && (
            <p className="rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 font-mono text-[11px] text-slate-400">
              {t.appStrings.errorCodeLabel} {error.digest}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="flex-1 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
            >
              {t.appStrings.tryAgain}
            </button>
            <Link
              href="/"
              className="flex-1 rounded-xl border border-slate-600/50 bg-slate-800/60 px-4 py-2.5 text-center text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              {t.appStrings.backToHome}
            </Link>
          </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">{t.appStrings.brandFooter}</p>
      </div>
    </div>
  )
}
