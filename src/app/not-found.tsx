import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">

        {/* Logo */}
        <Link href="/" className="inline-flex items-center justify-center gap-2.5 group">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow group-hover:bg-accent-hover transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-accent text-lg tracking-tight">FLUXO</span>
        </Link>

        {/* 404 block */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-8 space-y-5">
          <div className="space-y-1">
            <p className="text-7xl font-black text-gray-100 select-none leading-none">404</p>
            <h1 className="text-xl font-bold text-gray-900">Pagina non trovata</h1>
          </div>

          <p className="text-sm text-gray-500 leading-relaxed">
            La pagina richiesta non esiste o è stata spostata.
            Controlla l&apos;indirizzo oppure torna alla home.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Torna alla home
            </Link>
            <Link
              href="/fornitori"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Fornitori
            </Link>
          </div>
        </div>

        <p className="text-xs text-gray-400">FLUXO · Gestione Fatture</p>
      </div>
    </div>
  )
}
