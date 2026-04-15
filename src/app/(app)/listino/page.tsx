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
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
} from '@/lib/summary-highlight-accent'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  APP_SHELL_SECTION_PAGE_CLASS,
  APP_SHELL_SECTION_PAGE_H1_CLASS,
  APP_SECTION_EMPTY_LINK_CLASS,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TR,
} from '@/lib/app-shell-layout'

export const dynamic = 'force-dynamic'

export default async function ListinoOverviewPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams = searchParamsPromise != null ? await searchParamsPromise : {}
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
    rows = await fetchListinoOverviewRows(supabase, null, null)
  } else if (sedeId && fornitoreIds.length === 0) {
    rows = []
  } else {
    const fiscal = await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy)
    rows = await fetchListinoOverviewRows(supabase, fornitoreIds, fiscal?.bounds ?? null)
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz, { day: '2-digit', month: 'short', year: 'numeric' })
  const listinoTheme = SUMMARY_HIGHLIGHT_ACCENTS.lime

  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      <AppPageHeaderStrip accent="lime">
        <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.fornitori.tabListino}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : rows.length === 0 ? (
        <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${listinoTheme.border}`}>
          <div className={`app-card-bar-accent ${listinoTheme.bar}`} aria-hidden />
          <div className={SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}>
            <AppSectionEmptyState
              message={t.dashboard.listinoOverviewEmpty}
              icon={
              <svg
                className="mx-auto mb-3 h-12 w-12 text-app-fg-muted"
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
            }
          >
            <Link href="/fornitori" className={`${APP_SECTION_EMPTY_LINK_CLASS} hover:underline`}>
              {t.nav.fornitori} →
            </Link>
          </AppSectionEmptyState>
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
          <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${listinoTheme.border}`}>
            <div className={`app-card-bar-accent ${listinoTheme.bar}`} aria-hidden />
            <div className={`${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS} overflow-x-auto`}>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.fornitori.listinoProdotti}</th>
                    <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.fornitori.listinoColImporto}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.fornitori.listinoColData}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.notes}</th>
                    <th className={`w-28 ${APP_SECTION_TABLE_TH_RIGHT}`}>{' '}</th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {rows.map((r) => (
                    <tr key={r.id} className={APP_SECTION_TABLE_TR}>
                      <td className="max-w-[200px] px-6 py-4">
                        <Link href={`/fornitori/${r.fornitore_id}?tab=listino`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {r.fornitore_nome}
                        </Link>
                      </td>
                      <td className="max-w-xs px-6 py-4 text-app-fg-muted">{r.prodotto}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold tabular-nums text-app-fg">
                        {formatCurrency(r.prezzo, currency, locale)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-app-fg-muted">{formatDate(r.data_prezzo)}</td>
                      <td className="max-w-[220px] px-6 py-4 text-xs text-app-fg-muted">{r.note ?? '—'}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/fornitori/${r.fornitore_id}?tab=listino`}
                          className="text-xs font-semibold text-app-fg-muted transition-colors hover:text-app-fg"
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
