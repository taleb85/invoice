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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.fatture.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{fatture.length} {t.fatture.countLabel}</p>
        </div>
        <Link
          href="/fatture/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1a3050] hover:bg-[#122238] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t.fatture.new}
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {fatture.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">{t.fatture.noInvoices}</p>
            <Link href="/fatture/new" className="mt-4 inline-block text-sm text-[#1a3050] font-medium hover:text-[#1a3050]">
              {t.fatture.addFirst}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
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
                    <Link href={`/fatture/${f.id}`} className="font-medium text-[#1a3050] hover:text-[#1a3050]">
                      {f.fornitore?.nome ?? '—'}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(f.data)}</td>
                  <td className="px-6 py-4">
                    {f.bolla_id ? (
                      <Link href={`/bolle/${f.bolla_id}`} className="text-xs text-[#1a3050] hover:text-[#1a3050] font-medium">
                        {t.fatture.openBill}
                      </Link>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {f.file_url ? (
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-[#1a3050] hover:text-[#1a3050] text-xs font-medium">
                        {t.fatture.apri}
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteButton
                      id={f.id}
                      table="fatture"
                      confirmMessage={t.fatture.deleteConfirm}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
