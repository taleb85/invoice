import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import {
  fetchListinoOverviewRows,
  fornitoreIdsForSede,
  type ListinoOverviewRow,
} from '@/lib/dashboard-operator-kpis'
import {
  getT,
  getLocale,
  getTimezone,
  getCurrency,
  getCookieStore,
  formatDate as fmtDate,
} from '@/lib/locale-server'
import { formatCurrency } from '@/lib/locale-shared'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

export const dynamic = 'force-dynamic'

export default async function ListinoOverviewPage() {
  const [t, locale, tz, currency, cookieStore] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getCurrency(),
    getCookieStore(),
  ])
  const profile = await getProfile()
  const { supabase } = await getRequestAuth()

  const isMasterAdmin = profile?.role === 'admin'
  const adminPick = isMasterAdmin ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  let adminViewSedeId: string | null = null
  if (isMasterAdmin && adminPick) {
    const { data } = await supabase.from('sedi').select('id').eq('id', adminPick).maybeSingle()
    if (data?.id) adminViewSedeId = data.id
  }

  const sedeId = adminViewSedeId ?? profile?.sede_id ?? null
  const fornitoreIds = sedeId ? await fornitoreIdsForSede(supabase, sedeId) : []

  let rows: ListinoOverviewRow[] = []
  if (!sedeId && !isMasterAdmin) {
    rows = []
  } else if (!sedeId && isMasterAdmin) {
    rows = await fetchListinoOverviewRows(supabase, null)
  } else if (sedeId && fornitoreIds.length === 0) {
    rows = []
  } else {
    rows = await fetchListinoOverviewRows(supabase, fornitoreIds)
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz, { day: '2-digit', month: 'short', year: 'numeric' })
  const listinoTheme = SUMMARY_HIGHLIGHT_ACCENTS.lime

  return (
    <div className="w-full min-w-0 p-4 md:p-8">
      <AppPageHeaderStrip accent="lime">
        <div className="min-w-0 sm:flex-1 sm:flex-initial">
          <h1 className="app-page-title text-xl font-bold md:text-2xl">{t.fornitori.tabListino}</h1>
        </div>
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : rows.length === 0 ? (
        <div className={`app-card overflow-hidden ${listinoTheme.border}`}>
          <div className={`app-card-bar ${listinoTheme.bar}`} aria-hidden />
          <div className="px-6 py-14 text-center">
            <svg
              className="mx-auto mb-3 h-12 w-12 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 6h16M4 10h16M4 14h10M4 18h10"
              />
            </svg>
            <p className="text-sm text-slate-200">{t.dashboard.listinoOverviewEmpty}</p>
            <Link
              href="/fornitori"
              className="mt-4 inline-block text-sm font-medium text-lime-400 hover:text-lime-300 hover:underline"
            >
              {t.nav.fornitori} →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <AppSummaryHighlightCard
            accent="lime"
            label={t.common.total}
            primary={rows.length}
            secondary={t.dashboard.listinoOverviewLimitNote.replace(/\{n\}/g, String(rows.length))}
          />
          <div className={`app-card overflow-hidden ${listinoTheme.border}`}>
            <div className={`app-card-bar ${listinoTheme.bar}`} aria-hidden />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-700/50">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.common.supplier}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.fornitori.listinoProdotti}
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.fornitori.listinoColImporto}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.fornitori.listinoColData}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.common.notes}
                    </th>
                    <th className="w-28 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {' '}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-700/30">
                      <td className="max-w-[200px] px-4 py-3">
                        <Link
                          href={`/fornitori/${r.fornitore_id}?tab=listino`}
                          className="font-medium text-lime-400 transition-colors hover:text-lime-300"
                        >
                          {r.fornitore_nome}
                        </Link>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-200">{r.prodotto}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-100">
                        {formatCurrency(r.prezzo, currency, locale)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-200">{formatDate(r.data_prezzo)}</td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-slate-500">{r.note ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/fornitori/${r.fornitore_id}?tab=listino`}
                          className="text-xs font-semibold text-slate-200 transition-colors hover:text-lime-300"
                        >
                          {t.dashboard.listinoOverviewOpenSupplier}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
