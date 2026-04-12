import Link from 'next/link'
import { openDocumentUrl } from '@/lib/open-document-url'
import { createClient } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'

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
          <h1 className="text-2xl font-bold text-slate-100">{t.fatture.title}</h1>
          <p className="text-sm text-slate-400 mt-1">{fatture.length} {t.fatture.countLabel}</p>
        </div>
        <Link
          href="/fatture/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">{t.fatture.new}</span>
        </Link>
      </div>

      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div>
        {fatture.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg className="w-14 h-14 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-400 text-sm font-medium">{t.fatture.noInvoices}</p>
            <Link href="/fatture/new" className="mt-4 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300">
              {t.fatture.addFirst}
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {fatture.map((f: any) => (
                <div key={f.id} className="px-4 py-4 transition-colors hover:bg-slate-800/40">
                  <Link href={`/fatture/${f.id}`} className="block">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-slate-100 truncate">{f.fornitore?.nome ?? '—'}</p>
                      <p className="text-xs text-slate-400 shrink-0">{formatDate(f.data)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {f.bolla_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                          </svg>
                          {t.fatture.openBill}
                        </span>
                      )}
                    </div>
                  </Link>
                  {f.file_url && (
                    <a
                      href={openDocumentUrl({ fatturaId: f.id })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-green-400 hover:text-green-300 hover:underline"
                    >
                      {t.fatture.apri}
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-950/40 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3 text-left">{t.common.supplier}</th>
                  <th className="px-6 py-3 text-left">{t.common.date}</th>
                  <th className="px-6 py-3 text-left">{t.fatture.headerBolla}</th>
                  <th className="px-6 py-3 text-left">{t.fatture.headerAllegato}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {fatture.map((f: any) => (
                  <tr key={f.id} className="transition-colors hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <Link href={`/fatture/${f.id}`} className="font-medium text-cyan-400 hover:text-cyan-300">
                        {f.fornitore?.nome ?? '—'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{formatDate(f.data)}</td>
                    <td className="px-6 py-4">
                      {f.bolla_id ? (
                        <Link href={`/bolle/${f.bolla_id}`} className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
                          {t.fatture.openBill}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {f.file_url ? (
                        <a href={openDocumentUrl({ fatturaId: f.id })} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
                          {t.fatture.apri}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
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
    </div>
  )
}
