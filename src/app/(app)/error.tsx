'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AuroraPanelShell } from '@/components/aurora/AuroraPanelShell'
import { useT } from '@/lib/use-t'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useT()

  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[60vh]">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(34,211,238,0.15)] bg-red-950/40">
            <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>

        <AuroraPanelShell className="text-center">
          <div className="space-y-4 px-8 py-7 text-center">
          <h2 className="text-lg font-semibold text-app-fg">
            {t.appStrings.errorSegmentTitle}
          </h2>
          <p className="text-sm leading-relaxed text-app-fg-muted">
            {t.appStrings.errorSegmentBody}
          </p>

          {process.env.NODE_ENV === 'development' && (
            <details className="text-left">
              <summary className="cursor-pointer text-xs text-app-fg-muted hover:text-app-fg">
                {t.appStrings.errorDevDetailsSummary}
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-950/40 px-3 py-2 text-left font-mono text-[11px] text-red-300">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
          )}

          {error.digest && (
            <p className="rounded-lg border border-app-line-22 app-workspace-inset-bg-soft px-3 py-1.5 font-mono text-[11px] text-app-fg-muted">
              {t.appStrings.errorCodeLabel} {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={reset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-app-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t.appStrings.tryAgain}
            </button>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-app-line-32 app-workspace-inset-bg px-4 py-2.5 text-sm font-medium text-app-fg-muted transition-colors hover:bg-app-line-12"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {t.appStrings.backToHome}
            </Link>
          </div>
          </div>
        </AuroraPanelShell>
      </div>
    </div>
  )
}
