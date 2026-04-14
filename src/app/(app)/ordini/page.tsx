import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { fetchOrdiniOverviewRows, fornitoreIdsForSede, type OrdineOverviewRow } from '@/lib/dashboard-operator-kpis'
import {
  getT,
  getLocale,
  getTimezone,
  getCookieStore,
  formatDate as fmtDate,
} from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import { PublicPdfOpenMenu } from '@/components/PublicPdfOpenMenu'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

export const dynamic = 'force-dynamic'

export default async function OrdiniOverviewPage() {
  const [t, locale, tz, cookieStore] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
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

  let rows: OrdineOverviewRow[] = []
  if (!sedeId && !isMasterAdmin) {
    rows = []
  } else if (!sedeId && isMasterAdmin) {
    rows = await fetchOrdiniOverviewRows(supabase, null)
  } else if (sedeId && fornitoreIds.length === 0) {
    rows = []
  } else {
    rows = await fetchOrdiniOverviewRows(supabase, fornitoreIds)
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz, { day: '2-digit', month: 'short', year: 'numeric' })
  const ordiniTheme = SUMMARY_HIGHLIGHT_ACCENTS.rose

  return (
    <div className="w-full min-w-0 app-shell-page-padding">
      <AppPageHeaderStrip accent="rose">
        <div className="min-w-0 sm:flex-1 sm:flex-initial">
          <h1 className="app-page-title text-xl font-bold md:text-2xl">{t.nav.ordini}</h1>
        </div>
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : rows.length === 0 ? (
        <>
          <AppSummaryHighlightCard
            accent="rose"
            label={t.common.total}
            primary={0}
            secondary={t.dashboard.kpiOrdiniSub}
          />
          <div className={`app-card overflow-hidden ${ordiniTheme.border}`}>
            <div className={`app-card-bar ${ordiniTheme.bar}`} aria-hidden />
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
              <p className="text-sm text-slate-200">{t.dashboard.ordiniOverviewEmpty}</p>
              <Link
                href="/fornitori"
                className="mt-4 inline-block text-sm font-medium text-rose-400 hover:text-rose-300 hover:underline"
              >
                {t.nav.fornitori} →
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <AppSummaryHighlightCard
            accent="rose"
            label={t.common.total}
            primary={rows.length}
            secondary={t.dashboard.ordiniOverviewLimitNote.replace(/\{n\}/g, String(rows.length))}
          />
          <div className={`app-card overflow-hidden ${ordiniTheme.border}`}>
            <div className={`app-card-bar ${ordiniTheme.bar}`} aria-hidden />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-700/50">
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.dashboard.ordiniColSupplier}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.dashboard.ordiniColTitle}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.dashboard.ordiniColOrderDate}
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {t.dashboard.ordiniColRegistered}
                    </th>
                    <th className="w-36 px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-200">
                      {' '}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-700/30">
                      <td className="max-w-[200px] px-4 py-3">
                        <Link
                          href={`/fornitori/${r.fornitore_id}?tab=conferme`}
                          className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                        >
                          {r.fornitore_nome}
                        </Link>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-200">{r.titolo?.trim() || r.file_name || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-200">
                        {r.data_ordine ? formatDate(r.data_ordine) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-200">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <PublicPdfOpenMenu
                          fileUrl={r.file_url}
                          triggerLabel={t.dashboard.ordiniOpenPdf}
                          triggerClassName="text-xs font-semibold text-slate-200 transition-colors hover:text-cyan-300"
                          labels={{
                            preview: t.dashboard.ordiniPdfPreview,
                            copyLink: t.dashboard.ordiniPdfCopyLink,
                            linkCopied: t.dashboard.ordiniPdfLinkCopied,
                          }}
                        />
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
