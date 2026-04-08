import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { Fornitore } from '@/types'
import DeleteButton from '@/components/DeleteButton'
import { getT } from '@/lib/locale'

async function getFornitori(): Promise<Fornitore[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('fornitori').select('*').order('nome')
  return (data as Fornitore[]) ?? []
}

export default async function FornitoriPage() {
  const [fornitori, t] = await Promise.all([getFornitori(), getT()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.fornitori.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{fornitori.length} {t.fornitori.countLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/fornitori/import"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-[#1a3050]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t.fornitori.importaDaFattura}
          </Link>
          <Link
            href="/fornitori/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a3050] hover:bg-[#122238] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.fornitori.new}
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {fornitori.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-400 text-sm font-medium">{t.fornitori.noSuppliers}</p>
            <Link href="/fornitori/new" className="mt-4 inline-block text-sm text-[#1a3050] font-medium hover:text-[#1a3050]">
              {t.fornitori.addFirst}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 font-medium uppercase tracking-wide">
                <th className="text-left px-6 py-3">{t.fornitori.nome}</th>
                <th className="text-left px-6 py-3">{t.fornitori.email}</th>
                <th className="text-left px-6 py-3">{t.fornitori.piva}</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fornitori.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{f.nome}</td>
                  <td className="px-6 py-4 text-gray-500">{f.email ?? '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{f.piva ?? '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/fornitori/${f.id}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1a3050] hover:text-[#1a3050] hover:bg-[#e8edf5] rounded-lg transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {t.common.edit}
                      </Link>
                      <DeleteButton
                        id={f.id}
                        table="fornitori"
                        confirmMessage={`${t.fornitori.deleteConfirm.replace('questo fornitore', `"${f.nome}"`).replace('Delete this supplier', `"${f.nome}"`)}`}
                      />
                    </div>
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
