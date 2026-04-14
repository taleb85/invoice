import Link from 'next/link'
import { getRequestAuth } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
import { getT, getLocale, getTimezone, getCurrency, formatDate as fmtDate } from '@/lib/locale-server'
import { formatCurrency } from '@/lib/locale-shared'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'

type FatturaListRow = {
  id: string
  data: string
  file_url: string | null
  bolla_id: string | null
  fornitore_id: string | null
  importo: number | null
  fornitore: { nome: string } | null
}

async function getFatture(): Promise<FatturaListRow[]> {
  const { supabase } = await getRequestAuth()
  const { data } = await supabase
    .from('fatture')
    .select('id, data, file_url, bolla_id, fornitore_id, importo, fornitore:fornitori(nome)')
    .order('data', { ascending: false })
  /* Tipi Supabase sull’embed `fornitore` possono essere array in inference; a runtime è un oggetto. */
  return (data ?? []) as unknown as FatturaListRow[]
}

export default async function FatturePage() {
  const [fatture, t, locale, tz, currency] = await Promise.all([
    getFatture(),
    getT(),
    getLocale(),
    getTimezone(),
    getCurrency(),
  ])
  const formatDate = (d: string) => fmtDate(d, locale, tz)
  const totaleImporto = fatture.reduce((s, f) => s + (Number(f.importo) || 0), 0)

  return (
    <div className="app-shell-page-padding">
      <AppPageHeaderStrip accent="emerald">
        <div className="min-w-0 sm:flex-1 sm:flex-initial">
          <h1 className="app-page-title text-2xl font-bold">{t.fatture.title}</h1>
        </div>
        <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
          <Link
            href="/fatture/new"
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t.fatture.new}</span>
          </Link>
        </div>
      </AppPageHeaderStrip>

      <AppSummaryHighlightCard
        accent="emerald"
        label={t.common.total}
        primary={formatCurrency(totaleImporto, currency, locale)}
        secondary={`${fatture.length} ${t.fatture.countLabel}`}
      />

      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div>
        {fatture.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg className="w-14 h-14 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-200 text-sm font-medium">{t.fatture.noInvoices}</p>
            <Link href="/fatture/new" className="mt-4 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300">
              {t.fatture.addFirst}
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-slate-800/80">
              {fatture.map((f) => (
                <div key={f.id} className="px-4 py-4 transition-colors hover:bg-slate-700/40">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    {f.fornitore_id ? (
                      <Link
                        href={`/fornitori/${f.fornitore_id}`}
                        className="truncate font-semibold text-cyan-400 transition-colors hover:text-cyan-300"
                      >
                        {f.fornitore?.nome ?? '—'}
                      </Link>
                    ) : (
                      <p className="truncate font-semibold text-slate-100">{f.fornitore?.nome ?? '—'}</p>
                    )}
                    <Link
                      href={`/fatture/${f.id}`}
                      className="shrink-0 text-xs text-slate-200 transition-colors hover:text-cyan-300"
                    >
                      {formatDate(f.data)}
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {f.bolla_id && (
                      <Link
                        href={`/bolle/${f.bolla_id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/25"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                        </svg>
                        {t.fatture.openBill}
                      </Link>
                    )}
                  </div>
                  {f.file_url && (
                    <div className="mt-2">
                      <OpenDocumentInAppButton fatturaId={f.id} fileUrl={f.file_url}>
                        {t.fatture.apri}
                      </OpenDocumentInAppButton>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-700/40 text-xs font-medium uppercase tracking-wide text-slate-200">
                  <th className="px-6 py-3 text-left">{t.common.supplier}</th>
                  <th className="px-6 py-3 text-left">{t.common.date}</th>
                  <th className="px-6 py-3 text-left">{t.fatture.headerBolla}</th>
                  <th className="px-6 py-3 text-left">{t.fatture.headerAllegato}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {fatture.map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-slate-700/40">
                    <td className="px-6 py-4">
                      {f.fornitore_id ? (
                        <Link
                          href={`/fornitori/${f.fornitore_id}`}
                          className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                        >
                          {f.fornitore?.nome ?? '—'}
                        </Link>
                      ) : (
                        <Link
                          href={`/fatture/${f.id}`}
                          className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                        >
                          {f.fornitore?.nome ?? '—'}
                        </Link>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-200">{formatDate(f.data)}</td>
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
                        <OpenDocumentInAppButton fatturaId={f.id} fileUrl={f.file_url}>
                          {t.fatture.apri}
                        </OpenDocumentInAppButton>
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
