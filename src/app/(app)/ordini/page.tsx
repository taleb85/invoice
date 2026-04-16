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
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { PublicPdfOpenMenu } from '@/components/PublicPdfOpenMenu'
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
import { analyzeOrdineDuplicatesForDeletion, serializeFatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'
import { DuplicateLedgerRowExtras } from '@/components/DuplicateLedgerRowExtras'

export const dynamic = 'force-dynamic'

export default async function OrdiniOverviewPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams = searchParamsPromise != null ? await searchParamsPromise : {}
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
    rows = await fetchOrdiniOverviewRows(supabase, null, null)
  } else if (sedeId && fornitoreIds.length === 0) {
    rows = []
  } else {
    const fiscal = await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy)
    rows = await fetchOrdiniOverviewRows(supabase, fornitoreIds, fiscal?.bounds ?? null)
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz, { day: '2-digit', month: 'short', year: 'numeric' })
  const ordiniTheme = SUMMARY_HIGHLIGHT_ACCENTS.rose

  const ordDupAnalysis = analyzeOrdineDuplicatesForDeletion(
    rows.map((r) => ({
      id: r.id,
      fornitore_id: r.fornitore_id,
      data_ordine: r.data_ordine,
      numero_ordine: r.numero_ordine,
      titolo: r.titolo,
      created_at: r.created_at,
    })),
  )
  const ordDupPayload = serializeFatturaDuplicateDeletionPayload(ordDupAnalysis)

  const ordiniMergedSummary = {
    label: t.common.total,
    primary: rows.length,
    secondary:
      rows.length === 0
        ? t.dashboard.kpiOrdiniSub
        : t.dashboard.ordiniOverviewLimitNote.replace(/\{n\}/g, String(rows.length)),
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      <AppPageHeaderStrip accent="rose" mergedSummary={ordiniMergedSummary}>
        <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.nav.ordini}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : rows.length === 0 ? (
        <>
          <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${ordiniTheme.border}`}>
            <div className={`app-card-bar-accent ${ordiniTheme.bar}`} aria-hidden />
            <div className={SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}>
              <AppSectionEmptyState message={t.dashboard.ordiniOverviewEmpty}>
                <Link href="/fornitori" className={`${APP_SECTION_EMPTY_LINK_CLASS} hover:underline`}>
                  {t.nav.fornitori} →
                </Link>
              </AppSectionEmptyState>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${ordiniTheme.border}`}>
            <div className={`app-card-bar-accent ${ordiniTheme.bar}`} aria-hidden />
            <div className={`${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS} overflow-x-auto`}>
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                    <th className={APP_SECTION_TABLE_TH}>{t.dashboard.ordiniColSupplier}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.dashboard.ordiniColTitle}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.dashboard.ordiniColOrderDate}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.dashboard.ordiniColRegistered}</th>
                    <th className={`w-36 ${APP_SECTION_TABLE_TH_RIGHT}`}>{' '}</th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {rows.map((r) => (
                    <tr key={r.id} className={APP_SECTION_TABLE_TR}>
                      <td className="max-w-[200px] px-6 py-4">
                        <Link href={`/fornitori/${r.fornitore_id}?tab=conferme`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {r.fornitore_nome}
                        </Link>
                      </td>
                      <td className="max-w-xs px-6 py-4 text-app-fg-muted">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>{r.titolo?.trim() || r.numero_ordine?.trim() || r.file_name || '—'}</span>
                          <DuplicateLedgerRowExtras
                            rowId={r.id}
                            payload={ordDupPayload}
                            kind="ordine"
                            duplicateBadgeLabel={t.common.duplicateBadge}
                            duplicateDeleteConfirm={t.fornitori.confermeOrdineDuplicateCopyDeleteConfirm}
                            removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                            deleteFailedPrefix={t.appStrings.deleteFailed}
                          />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-app-fg-muted">
                        {r.data_ordine ? formatDate(r.data_ordine) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-app-fg-muted">{formatDate(r.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <PublicPdfOpenMenu
                          fileUrl={r.file_url}
                          triggerLabel={t.dashboard.ordiniOpenPdf}
                          triggerClassName="text-xs font-semibold text-app-fg-muted transition-colors hover:text-app-fg"
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
