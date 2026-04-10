import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale'

async function getBolle() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bolle')
    .select('*, fornitori(nome)')
    .order('data', { ascending: false })

  if (error) console.error('Errore caricamento bolle:', error.message)
  return data ?? []
}

export default async function BollePage() {
  const [bolle, t, locale, tz] = await Promise.all([getBolle(), getT(), getLocale(), getTimezone()])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.bolle.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {bolle.length} {bolle.length === 1 ? t.bolle.countSingolo : t.bolle.countPlural}
          </p>
        </div>
        <Link
          href="/bolle/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">{t.bolle.new}</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {bolle.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">{t.bolle.noBills}</p>
            <Link href="/bolle/new" className="mt-4 inline-block text-sm text-accent font-medium">
              {t.bolle.addFirst}
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-gray-50">
              {bolle.map((b: any) => (
                <div key={b.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {b.fornitori?.nome ?? <span className="text-gray-300">—</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(b.data)}</p>
                    </div>
                    {b.stato === 'completato' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        {t.status.completato}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {t.status.inAttesa}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {b.file_url && (
                      <a
                        href={b.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-accent bg-[#e8edf5] hover:bg-[#d0daea] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {t.bolle.viewDocument}
                      </a>
                    )}
                    {b.stato === 'in attesa' && (
                      <Link
                        href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {t.bolle.uploadInvoice}
                      </Link>
                    )}
                    <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.common.date}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.common.supplier}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.common.status}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bolle.map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 text-gray-700 font-medium whitespace-nowrap">{formatDate(b.data)}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {b.fornitori?.nome ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {b.stato === 'completato' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          {t.status.completato}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          {t.status.inAttesa}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {b.file_url && (
                          <a href={b.file_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent bg-[#e8edf5] hover:bg-[#d0daea] transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {t.bolle.viewDocument}
                          </a>
                        )}
                        {b.stato === 'in attesa' && (
                          <Link href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            {t.bolle.uploadInvoice}
                          </Link>
                        )}
                        <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
