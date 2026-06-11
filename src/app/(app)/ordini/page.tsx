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
  getCurrency,
  getCookieStore,
  formatDate as fmtDate,
  formatDateTime as fmtDateTime,
} from '@/lib/locale-server'
import { formatCurrency } from '@/lib/locale-shared'
import { confermaOrdineImportoTotale } from '@/lib/conferme-ordine-importo'
import { StandardBadge } from '@/components/ui/StandardBadge'
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
  APP_SECTION_AMOUNT_POSITIVE_CLASS,
  APP_SECTION_TABLE_CELL_LINK,
  appSectionTableHeadRowAccentClass,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_THEAD_STICKY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TR_GROUP,
  APP_SECTION_TABLE_TD_COMPACT,
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
  const [t, locale, tz, currency, cookieStore] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getCurrency(),
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

  let ordiniDupRows = await enrichOrdiniDupRowsFromDocumenti(
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
      ordiniDupRows = await enrichOrdiniDupRowsFromDocumenti(
        supabase,
        ordiniOverviewRowToDupProbe(rows),
      )
      ordDupAnalysis = analyzeOrdineDuplicatesForDeletion(ordiniDupRows)
    }
  }
  const ordDupPayload = serializeFatturaDuplicateDeletionPayload(ordDupAnalysis)
  const enrichedDataOrdineById = new Map(
    ordiniDupRows.map((r) => [r.id, r.data_ordine != null ? String(r.data_ordine) : null]),
  )
  const displayRows = rows.map((r) => {
    const dataOrdine = enrichedDataOrdineById.get(r.id) ?? r.data_ordine
    const importo = confermaOrdineImportoTotale(r)
    return {
      ...r,
      data_ordine: dataOrdine,
      dataLabel: dataOrdine ? formatDate(dataOrdine) : null,
      numeroLabel: r.numero_ordine?.trim() || r.titolo?.trim() || r.file_name?.trim() || null,
      importoLabel: importo != null ? formatCurrency(importo, currency, locale) : null,
      syncLabel: r.created_at ? fmtDateTime(r.created_at, locale, tz, true) : null,
      syncFull: r.created_at ?? null,
    }
  })
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
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[56rem] table-fixed text-sm">
              <colgroup>
                <col />
                <col />
                <col className="w-[6.5rem]" />
                <col className="w-[9rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-[4.25rem]" />
              </colgroup>
              <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
                <tr className={appSectionTableHeadRowAccentClass('cyan')}>
                  <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.bolle.colNumero}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.common.date}</th>
                  <th className={`${APP_SECTION_TABLE_TH} w-[9rem] whitespace-nowrap`}>{t.dashboard.ordiniColSync}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.common.status}</th>
                  <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.statements.colAmount}</th>
                  <th className={`${APP_SECTION_TABLE_TH_RIGHT} w-[4.25rem] whitespace-nowrap pr-0.5`}>{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className={APP_SECTION_TABLE_TBODY}>
                {displayRows.map((r) => (
                  <tr key={r.id} className={APP_SECTION_TABLE_TR_GROUP}>
                    <td className={`${APP_SECTION_TABLE_TD_COMPACT} max-w-0 font-medium text-app-fg`}>
                      <Link
                        href={`/fornitori/${r.fornitore_id}?tab=conferme`}
                        className={`${APP_SECTION_TABLE_CELL_LINK} line-clamp-2 leading-snug`}
                        title={r.fornitore_nome}
                      >
                        {r.fornitore_nome}
                      </Link>
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD_COMPACT} max-w-[10rem] font-mono text-app-fg-muted`}>
                      <span className="text-app-fg">{r.numeroLabel ?? '—'}</span>
                      {r.titolo?.trim() && r.numero_ordine?.trim() && r.titolo.trim() !== r.numero_ordine.trim() ? (
                        <span className="mt-0.5 block truncate font-sans text-[10px] font-normal not-italic text-app-fg-muted/60" title={r.titolo}>
                          {r.titolo}
                        </span>
                      ) : null}
                      <DuplicateLedgerRowExtras
                        rowId={r.id}
                        payload={ordDupPayload}
                        kind="ordine"
                        duplicateBadgeLabel={t.common.duplicateBadge}
                        duplicateDeleteConfirm={t.fornitori.confermeOrdineDuplicateCopyDeleteConfirm}
                        removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                        deleteFailedPrefix={t.appStrings.deleteFailed}
                      />
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD_COMPACT} whitespace-nowrap font-medium text-app-fg-muted`}>
                      {r.dataLabel ?? '—'}
                    </td>
                    <td
                      className={`${APP_SECTION_TABLE_TD_COMPACT} w-[9rem] whitespace-nowrap text-[12px] text-app-fg`}
                      title={r.syncFull ?? undefined}
                    >
                      {r.syncLabel ?? '—'}
                    </td>
                    <td className={APP_SECTION_TABLE_TD_COMPACT}>
                      {r.data_ordine ? (
                        <StandardBadge variant="success" dot="emerald" className="normal-case">
                          {t.dashboard.ordiniColRegistered}
                        </StandardBadge>
                      ) : (
                        <StandardBadge variant="pending" dot="amber" className="normal-case">
                          {t.status.inAttesa}
                        </StandardBadge>
                      )}
                    </td>
                    <td
                      className={`${APP_SECTION_TABLE_TD_COMPACT} whitespace-nowrap pr-0.5 pl-2 text-right font-mono text-[13px] font-semibold tabular-nums ${
                        r.importoLabel ? APP_SECTION_AMOUNT_POSITIVE_CLASS : 'text-app-fg-muted'
                      }`}
                    >
                      <span className="block truncate" title={r.importoLabel ?? undefined}>
                        {r.importoLabel ?? '—'}
                      </span>
                    </td>
                    <td className={`${APP_SECTION_TABLE_TD_COMPACT} w-[4.25rem] pr-0.5 text-right`}>
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
