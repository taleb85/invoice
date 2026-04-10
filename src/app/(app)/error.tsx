'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[60vh]">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-7 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Errore durante il caricamento
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Non è stato possibile caricare questa sezione.
            Riprovare oppure tornare alla pagina precedente.
          </p>

          {/* Dev error detail */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                Dettagli errore (solo sviluppo)
              </summary>
              <pre className="mt-2 text-[11px] font-mono text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 overflow-auto max-h-40 whitespace-pre-wrap text-left">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ''}
              </pre>
            </details>
          )}

          {error.digest && (
            <p className="text-[11px] font-mono text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
              ID: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={reset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a3050] hover:bg-[#122238] text-white text-sm font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Riprova
            </button>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
