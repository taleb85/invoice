import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import {
  fetchFattureRiepilogoRows,
  fetchFattureTotaleSummary,
  fornitoreIdsForSede,
  type FatturaRiepilogoRow,
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

export default async function FattureRiepilogoPage() {
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

  let summary = { totaleImporto: 0, fattureCount: 0 }
  let rows: FatturaRiepilogoRow[] = []
  if (!sedeId && !isMasterAdmin) {
    summary = { totaleImporto: 0, fattureCount: 0 }
    rows = []
  } else if (!sedeId && isMasterAdmin) {
    ;[summary, rows] = await Promise.all([
      fetchFattureTotaleSummary(supabase, null),
      fetchFattureRiepilogoRows(supabase, null),
    ])
  } else if (sedeId && fornitoreIds.length === 0) {
    summary = { totaleImporto: 0, fattureCount: 0 }
    rows = []
  } else {
    ;[summary, rows] = await Promise.all([
      fetchFattureTotaleSummary(supabase, fornitoreIds),
      fetchFattureRiepilogoRows(supabase, fornitoreIds),
    ])
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz, { day: '2-digit', month: 'short', year: 'numeric' })
  const countLabel = t.dashboard.fattureRiepilogoCountLabel.replace(/\{n\}/g, String(summary.fattureCount))
  const riepilogoTheme = SUMMARY_HIGHLIGHT_ACCENTS.violet

  return (
    <div className="w-full min-w-0 p-4 md:p-8">
      <AppPageHeaderStrip accent="violet">
        <div className="min-w-0 sm:flex-1 sm:flex-initial">
          <h1 className="app-page-title text-xl font-bold md:text-2xl">{t.dashboard.fattureRiepilogoTitle}</h1>
        </div>
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : summary.fattureCount === 0 ? (
        <div className={`app-card overflow-hidden ${riepilogoTheme.border}`}>
          <div className={`app-card-bar ${riepilogoTheme.bar}`} aria-hidden />
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm text-slate-200">{t.dashboard.fattureRiepilogoEmpty}</p>
            <Link
              href="/fatture"
              className="mt-4 inline-block text-sm font-medium text-violet-400 hover:text-violet-300 hover:underline"
            >
              {t.dashboard.fattureRiepilogoLinkAll}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <AppSummaryHighlightCard
            accent="violet"
            label={t.common.total}
            primary={formatCurrency(summary.totaleImporto, currency, locale)}
            secondary={countLabel}
          />

          <p className="mb-3 text-xs leading-relaxed text-slate-400">
            {t.dashboard.fattureRiepilogoLimitNote.replace(/\{n\}/g, String(rows.length))}
          </p>
          <div className={`app-card overflow-hidden ${riepilogoTheme.border}`}>
            <div className={`app-card-bar ${riepilogoTheme.bar}`} aria-hidden />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-700/50">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.common.date}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.common.supplier}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.common.invoiceNum}
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.fornitori.listinoColImporto}
                    </th>
                    <th className="w-40 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {' '}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-700/30">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-200">{formatDate(r.data)}</td>
                      <td className="max-w-[200px] px-4 py-3">
                        <Link
                          href={`/fornitori/${r.fornitore_id}`}
                          className="font-medium text-violet-400 transition-colors hover:text-violet-300"
                        >
                          {r.fornitore_nome}
                        </Link>
                      </td>
                      <td className="max-w-[140px] px-4 py-3 text-slate-200">{r.numero_fattura?.trim() || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-100">
                        {formatCurrency(Number(r.importo) || 0, currency, locale)}
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        <Link
                          href={`/fatture/${r.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/25"
                        >
                          {t.dashboard.fattureRiepilogoOpenInvoice}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-center md:text-left">
            <Link
              href="/fatture"
              className="text-sm font-medium text-slate-200 transition-colors hover:text-violet-300 hover:underline"
            >
              {t.dashboard.fattureRiepilogoLinkAll}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
