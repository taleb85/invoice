'use client'

import { useEffect } from 'react'
import { getTranslations } from '@/lib/translations'
import { useCookieLocaleFallback } from '@/lib/use-cookie-locale-fallback'

/**
 * Root layout error boundary — must render its own <html> and <body>.
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
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #1e3a5f, #172554)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(6,182,212,0.20)',
            }}>
              <svg width="32" height="32" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="ge-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#5b7cf9" />
                    <stop offset="50%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <path d="M7 30 C13 18, 22 18, 29 30 S43 42, 49 30"
                  stroke="url(#ge-wave)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                <circle cx="7"  cy="30" r="3.5" fill="#5b7cf9" />
                <circle cx="29" cy="30" r="3.5" fill="#38bdf8" />
                <circle cx="49" cy="30" r="3.5" fill="#22d3ee" />
              </svg>
            </div>
          </div>

          <div style={{
            background: '#ffffff', borderRadius: 20,
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            padding: '2rem',
          }}>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
              {t.appStrings.errorFatalTitle}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              {t.appStrings.errorFatalBody}
              {error.digest && (
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                  {t.appStrings.errorCodeLabel} {error.digest}
                </span>
              )}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '0.625rem 1rem', borderRadius: 12, border: 'none',
                  background: '#06b6d4', color: '#ffffff',
                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {t.appStrings.tryAgain}
              </button>
              <a
                href="/"
                style={{
                  padding: '0.625rem 1rem', borderRadius: 12,
                  background: '#f1f5f9', color: '#475569',
                  fontSize: '0.875rem', fontWeight: 500,
                  textDecoration: 'none', display: 'block',
                }}
              >
                {t.appStrings.backToHome}
              </a>
            </div>
          </div>

          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
            {t.appStrings.brandFooter}
          </p>
        </div>
      </body>
    </html>
  )
}
