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
import AppSectionFiltersBar from '@/components/AppSectionFiltersBar'
import { StandardCard } from '@/components/ui/StandardCard'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  APP_SHELL_SECTION_PAGE_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
  APP_SHELL_SECTION_PAGE_SUBTITLE_CLASS,
  APP_SECTION_EMPTY_LINK_CLASS,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TR_GROUP,
  APP_SECTION_TABLE_TD,
} from '@/lib/app-shell-layout'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
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
  let fiscal: Awaited<ReturnType<typeof resolveFiscalFilterForSede>> | null = null
  if (!sedeId && !isMasterAdmin) {
    rows = []
  } else if (!sedeId && isMasterAdmin) {
    rows = await fetchOrdiniOverviewRows(supabase, null, null)
  } else if (sedeId && fornitoreIds.length === 0) {
    rows = []
  } else {
    fiscal = await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy)
    rows = await fetchOrdiniOverviewRows(supabase, fornitoreIds, fiscal?.bounds ?? null)
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz)
  const fyForLinks = fiscal?.labelYear ?? null

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
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip accent="rose" mergedSummary={ordiniMergedSummary}>
        <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.nav.ordini}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      <AppSectionFiltersBar aria-label={t.nav.cerca}>
        <p className={`min-w-0 flex-1 basis-full sm:basis-auto ${APP_SHELL_SECTION_PAGE_SUBTITLE_CLASS}`}>
          {t.dashboard.ordiniOverviewHint}
        </p>
        <Link
          href={withFiscalYearQuery('/revisione', fyForLinks)}
          className="text-xs font-semibold text-app-cyan-500 transition-colors hover:text-app-fg sm:ml-auto"
        >
          {t.dashboard.inboxUrgenteNavOrdini} →
        </Link>
      </AppSectionFiltersBar>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : rows.length === 0 ? (
        <StandardCard accent="rose">
          <AppSectionEmptyState message={t.dashboard.ordiniOverviewEmpty}>
            <Link href="/fornitori" className={`${APP_SECTION_EMPTY_LINK_CLASS} hover:underline`}>
              {t.nav.fornitori} →
            </Link>
          </AppSectionEmptyState>
        </StandardCard>
      ) : (
        <StandardCard accent="rose">
          <div className="overflow-x-auto">
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
                  <tr key={r.id} className={APP_SECTION_TABLE_TR_GROUP}>
                    <td className={`${APP_SECTION_TABLE_TD} max-w-[200px]`}>
                      <Link href={`/fornitori/${r.fornitore_id}?tab=conferme`} className={APP_SECTION_TABLE_CELL_LINK}>
                        {r.fornitore_nome}
                      </Link>
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD} max-w-xs text-app-fg-muted`}>
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
                    <td className={`${APP_SECTION_TABLE_TD} whitespace-nowrap text-app-fg-muted`}>
                      {r.data_ordine ? formatDate(r.data_ordine) : '—'}
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD} whitespace-nowrap text-app-fg-muted`}>
                      {formatDate(r.created_at)}
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD} text-right`}>
                      <PublicPdfOpenMenu
                        fileUrl={r.file_url}
                        triggerLabel={t.dashboard.ordiniOpenPdf}
                        triggerClassName="text-xs font-semibold text-app-cyan-500 transition-colors hover:text-app-fg"
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
        </StandardCard>
      )}
    </div>
  )
}
