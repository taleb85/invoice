'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In produzione registrare l'errore in un servizio esterno (es. Sentry)
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="it">
      <body className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          {/* Message */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-8 space-y-4">
            <h1 className="text-xl font-bold text-gray-900">
              Si è verificato un errore
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Un errore imprevisto ha interrotto l&apos;applicazione.
              Il team è stato notificato automaticamente.
            </p>

            {/* Digest for support */}
            {error.digest && (
              <p className="text-[11px] font-mono text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                Codice errore: {error.digest}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={reset}
                className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors"
              >
                Riprova
              </button>
              <a
                href="/"
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
              >
                Torna alla home
              </a>
            </div>
          </div>

          <p className="text-xs text-gray-400">FLUXO · Gestione Fatture</p>
        </div>
      </body>
    </html>
  )
}
