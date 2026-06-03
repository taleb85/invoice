import Link from 'next/link'
import { getProfile, getRequestAuth, createServiceClient } from '@/utils/supabase/server'
import {
  fetchOrdiniOverviewRows,
  fetchOrdiniDuplicateOverviewRows,
  fornitoreIdsForSede,
  type OrdineOverviewRow,
} from '@/lib/dashboard-operator-kpis'
import { enrichOrdiniDupRowsFromDocumenti } from '@/lib/conferme-ordine-query'
import {
  getT,
  getLocale,
  getTimezone,
  getCookieStore,
  formatDate as fmtDate,
} from '@/lib/locale-server'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import AppSectionFiltersBar from '@/components/AppSectionFiltersBar'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { ActionLink } from '@/components/ui/ActionButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
  APP_SHELL_SECTION_PAGE_SUBTITLE_CLASS,
  APP_SECTION_TABLE_CELL_LINK,
  appSectionTableHeadRowAccentClass,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TR_GROUP,
  APP_SECTION_TABLE_TD,
  APP_SECTION_TABLE_TD_NUMERIC,
} from '@/lib/app-shell-layout'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import {
  analyzeOrdineDuplicatesForDeletion,
  ordineExcessIdsForAutoDeletion,
  serializeFatturaDuplicateDeletionPayload,
  autoDeleteExcessDuplicates,
  type FatturaDuplicateDeletionAnalysis,
} from '@/lib/check-duplicates'
import { DuplicateLedgerRowExtras } from '@/components/DuplicateLedgerRowExtras'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import { isMasterAdminRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

function ordiniOverviewRowToDupProbe(
  rows: OrdineOverviewRow[],
): Parameters<typeof enrichOrdiniDupRowsFromDocumenti>[1] {
  return rows.map((r) => ({
    id: r.id,
    fornitore_id: r.fornitore_id,
    data_ordine: r.data_ordine,
    numero_ordine: r.numero_ordine,
    titolo: r.titolo,
    created_at: r.created_at,
    file_url: r.file_url ?? null,
    file_name: r.file_name ?? null,
  }))
}

export default async function OrdiniOverviewPage(props: {
  searchParams?: Promise<{ fy?: string; dup?: string }>
}) {
  const searchParams = await unwrapSearchParams(props.searchParams)
  const dupOnly = searchParams.dup === '1'
  const [t, locale, tz, cookieStore] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getCookieStore(),
  ])
  const profile = await getProfile()
  const { supabase } = await getRequestAuth()

  const isMasterAdmin = isMasterAdminRole(profile?.role)
  const sedeId = await resolveActiveSedeIdForLists(
    supabase,
    profile ? { role: profile.role, sede_id: profile.sede_id } : undefined,
    (n) => cookieStore.get(n),
  ) ?? (profile?.sede_id ?? null)
  const fornitoreIds = sedeId ? await fornitoreIdsForSede(supabase, sedeId) : []

  let rows: OrdineOverviewRow[] = []
  let fiscal: Awaited<ReturnType<typeof resolveFiscalFilterForSede>> | null = null
  let ordDupAnalysis: FatturaDuplicateDeletionAnalysis | null = null

  if (!sedeId && !isMasterAdmin) {
    rows = []
  } else if (!sedeId && isMasterAdmin) {
    if (dupOnly) {
      rows = []
      ordDupAnalysis = {
        memberIds: new Set(),
        excessIds: new Set(),
        canonicalIdByGroupKey: new Map(),
        groupMembers: new Map(),
        surplusCount: 0,
        surplusImporto: 0,
      }
    } else {
      rows = await fetchOrdiniOverviewRows(supabase, null, null)
    }
  } else if (sedeId && fornitoreIds.length === 0) {
    rows = []
  } else {
    fiscal = await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy)
    const bounds = fiscal?.bounds ?? null
    if (dupOnly) {
      const dupPack = await fetchOrdiniDuplicateOverviewRows(supabase, fornitoreIds, bounds)
      rows = dupPack.rows
      ordDupAnalysis = dupPack.analysis
    } else {
      rows = await fetchOrdiniOverviewRows(supabase, fornitoreIds, bounds)
    }
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz)
  const fyForLinks = fiscal?.labelYear ?? null

  const ordiniDupRows = await enrichOrdiniDupRowsFromDocumenti(
    supabase,
    ordiniOverviewRowToDupProbe(rows),
  )
  if (!ordDupAnalysis) {
    ordDupAnalysis = analyzeOrdineDuplicatesForDeletion(ordiniDupRows)
  }
  const ordExcessIds = ordineExcessIdsForAutoDeletion(ordiniDupRows)
  if (ordExcessIds.length > 0) {
    const service = createServiceClient()
    const deleted = await autoDeleteExcessDuplicates(service, 'conferme_ordine', ordExcessIds)
    if (deleted > 0) {
      rows = rows.filter((r) => !ordExcessIds.includes(r.id))
      const cleanRows = await enrichOrdiniDupRowsFromDocumenti(
        supabase,
        ordiniOverviewRowToDupProbe(rows),
      )
      ordDupAnalysis = analyzeOrdineDuplicatesForDeletion(cleanRows)
    }
  }
  const ordDupPayload = serializeFatturaDuplicateDeletionPayload(ordDupAnalysis)
  const excessVisible = rows.filter((r) => ordDupPayload.excessIds.includes(r.id)).length

  const ordiniMergedSummary = dupOnly
    ? {
        label: t.dashboard.ordiniDupViewCountLabel,
        primary: rows.length,
        secondary:
          rows.length === 0
            ? t.dashboard.ordiniDupViewEmpty
            : t.dashboard.ordiniDupViewSub.replace(/\{excess\}/g, String(excessVisible)),
      }
    : {
        label: t.common.total,
        primary: rows.length,
        secondary:
          rows.length === 0
            ? t.dashboard.kpiOrdiniSub
            : t.dashboard.ordiniOverviewLimitNote.replace(/\{n\}/g, String(rows.length)),
      }

  const allOrdiniHref = withFiscalYearQuery('/ordini', fyForLinks)
  const dupOrdiniHref = withFiscalYearQuery('/ordini', fyForLinks, { dup: '1' })

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        mergedSummary={ordiniMergedSummary}
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        }
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>
            {dupOnly ? t.dashboard.ordiniDupViewTitle : t.nav.ordini}
          </h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      <AppSectionFiltersBar aria-label={t.nav.cerca}>
        <p className={`min-w-0 flex-1 basis-full sm:basis-auto ${APP_SHELL_SECTION_PAGE_SUBTITLE_CLASS}`}>
          {dupOnly ? t.dashboard.ordiniDupViewHint : t.dashboard.ordiniOverviewHint}
        </p>
        {dupOnly ? (
          <Link
            href={allOrdiniHref}
            className="text-xs font-semibold text-app-cyan-500 transition-colors hover:text-app-fg sm:ml-auto"
          >
            {t.dashboard.ordiniOverviewShowAll} →
          </Link>
        ) : (
          <Link
            href={withFiscalYearQuery('/inbox-ai', fyForLinks, { tab: 'panoramica' })}
            className="text-xs font-semibold text-app-cyan-500 transition-colors hover:text-app-fg sm:ml-auto"
          >
            {t.dashboard.inboxUrgenteNavOrdini} →
          </Link>
        )}
      </AppSectionFiltersBar>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : rows.length === 0 ? (
        <div className="min-w-0">
          <AppSectionEmptyState
            message={dupOnly ? t.dashboard.ordiniDupViewEmpty : t.dashboard.ordiniOverviewEmpty}
          >
            {dupOnly ? (
              <ActionLink href={allOrdiniHref} intent="nav" size="sm" className="mt-4">
                {t.dashboard.ordiniOverviewShowAll} →
              </ActionLink>
            ) : (
              <ActionLink href="/fornitori" intent="nav" size="sm" className="mt-4">
                {t.nav.fornitori} →
              </ActionLink>
            )}
          </AppSectionEmptyState>
        </div>
      ) : (
        <div className="min-w-0">
          {dupOnly ? (
            <p className="mb-3 text-xs leading-relaxed text-app-fg-muted">
              {t.dashboard.ordiniDupViewBadgeHint}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className={appSectionTableHeadRowAccentClass('cyan')}>
                  <th className={APP_SECTION_TABLE_TH}>{t.dashboard.ordiniColSupplier}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.dashboard.ordiniColTitle}</th>
                  <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.dashboard.ordiniColOrderDate}</th>
                  <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.dashboard.ordiniColRegistered}</th>
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
                    <td className={`${APP_SECTION_TABLE_TD_NUMERIC} whitespace-nowrap text-app-fg-muted`}>
                      {r.data_ordine ? formatDate(r.data_ordine) : '—'}
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD_NUMERIC} whitespace-nowrap text-app-fg-muted`}>
                      {formatDate(r.created_at)}
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD} text-right`}>
                      <OpenDocumentInAppButton
                        confermaOrdineId={r.id}
                        fileUrl={r.file_url}
                        className="text-xs font-semibold text-app-cyan-500 transition-colors hover:text-app-fg"
                      >
                        {t.dashboard.ordiniOpenPdf}
                      </OpenDocumentInAppButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!dupOnly && ordDupPayload.memberIds.length > 0 ? (
            <p className="mt-4 text-xs text-app-fg-muted">
              <Link href={dupOrdiniHref} className="font-semibold text-cyan-400/95 hover:text-cyan-300 hover:underline">
                {t.dashboard.ordiniDupViewLink.replace(/\{n\}/g, String(ordDupPayload.memberIds.length))}
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
