import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale'

async function getFatture() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fatture')
    .select('*, fornitore:fornitori(nome)')
    .order('data', { ascending: false })
  return data ?? []
}

export default async function FatturePage() {
  const [fatture, t, locale, tz] = await Promise.all([getFatture(), getT(), getLocale(), getTimezone()])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.fatture.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{fatture.length} {t.fatture.countLabel}</p>
        </div>
        <Link
          href="/fatture/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">{t.fatture.new}</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {fatture.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">{t.fatture.noInvoices}</p>
            <Link href="/fatture/new" className="mt-4 inline-block text-sm text-accent font-medium">
              {t.fatture.addFirst}
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-gray-50">
              {fatture.map((f: any) => (
                <Link key={f.id} href={`/fatture/${f.id}`} className="block px-4 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-gray-900 truncate">{f.fornitore?.nome ?? '—'}</p>
                    <p className="text-xs text-gray-400 shrink-0">{formatDate(f.data)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {f.bolla_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-accent font-medium bg-[#e8edf5] px-2 py-0.5 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                        </svg>
                        {t.fatture.openBill}
                      </span>
                    )}
                    {f.file_url && (
                      <span className="text-xs text-green-600 font-medium">
                        {t.fatture.apri}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium uppercase tracking-wide">
                  <th className="text-left px-6 py-3">{t.common.supplier}</th>
                  <th className="text-left px-6 py-3">{t.common.date}</th>
                  <th className="text-left px-6 py-3">{t.fatture.headerBolla}</th>
                  <th className="text-left px-6 py-3">{t.fatture.headerAllegato}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fatture.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/fatture/${f.id}`} className="font-medium text-accent hover:text-accent">
                        {f.fornitore?.nome ?? '—'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(f.data)}</td>
                    <td className="px-6 py-4">
                      {f.bolla_id ? (
                        <Link href={`/bolle/${f.bolla_id}`} className="text-xs text-accent font-medium hover:underline">
                          {t.fatture.openBill}
                        </Link>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {f.file_url ? (
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-accent text-xs font-medium hover:underline">
                          {t.fatture.apri}
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DeleteButton id={f.id} table="fatture" confirmMessage={t.fatture.deleteConfirm} />
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
