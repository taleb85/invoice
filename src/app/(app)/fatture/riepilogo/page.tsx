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
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { StandardCard } from '@/components/ui/StandardCard'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
  APP_SECTION_EMPTY_LINK_CLASS,
  APP_SECTION_ROW_ACTION_PILL,
  APP_SECTION_TABLE_CELL_LINK,
  appSectionTableHeadRowAccentClass,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TR,
} from '@/lib/app-shell-layout'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'

const dupBadgeCls =
  'ml-1.5 inline-flex shrink-0 align-middle rounded border border-[rgba(34,211,238,0.15)] bg-orange-950/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.35)]'

export const dynamic = 'force-dynamic'

export default async function FattureRiepilogoPage(props: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams = await unwrapSearchParams(props.searchParams)
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

  const emptySummary = {
    totaleImporto: 0,
    fattureCount: 0,
    duplicateFatturaMemberIds: new Set<string>() as ReadonlySet<string>,
    duplicateFatturaSurplusCount: 0,
  }
  let summary = emptySummary
  let rows: FatturaRiepilogoRow[] = []
  if (!sedeId && !isMasterAdmin) {
    summary = emptySummary
    rows = []
  } else if (!sedeId && isMasterAdmin) {
    ;[summary, rows] = await Promise.all([
      fetchFattureTotaleSummary(supabase, null, null),
      fetchFattureRiepilogoRows(supabase, null, null),
    ])
  } else if (sedeId && fornitoreIds.length === 0) {
    summary = emptySummary
    rows = []
  } else {
    const fiscal = await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy)
    const b = fiscal?.bounds ?? null
    ;[summary, rows] = await Promise.all([
      fetchFattureTotaleSummary(supabase, fornitoreIds, b),
      fetchFattureRiepilogoRows(supabase, fornitoreIds, b),
    ])
  }

  const formatDate = (d: string) => fmtDate(d, locale, tz)
  const countLabel = t.dashboard.fattureRiepilogoCountLabel.replace(/\{n\}/g, String(summary.fattureCount))
  const fattureRiepilogoMergedSummary = {
    label: t.common.total,
    primary: formatCurrency(summary.totaleImporto, currency, locale),
    secondary: countLabel,
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="emerald"
        mergedSummary={fattureRiepilogoMergedSummary}
        leadingAccessory={<BackButton href="/fatture" label={t.nav.fatture} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.dashboard.fattureRiepilogoTitle}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : summary.fattureCount === 0 ? (
        <StandardCard accent="emerald">
          <AppSectionEmptyState message={t.dashboard.fattureRiepilogoEmpty}>
            <Link href="/fatture" className={`${APP_SECTION_EMPTY_LINK_CLASS} hover:underline`}>
              {t.dashboard.fattureRiepilogoLinkAll}
            </Link>
          </AppSectionEmptyState>
        </StandardCard>
      ) : (
        <>
          {summary.duplicateFatturaSurplusCount > 0 ? (
            <p className="mb-3 text-xs font-semibold leading-relaxed text-orange-300 drop-shadow-[0_0_10px_rgba(251,146,60,0.4)]">
              {t.dashboard.kpiDuplicateInvoicesDetected.replace(
                '{n}',
                String(summary.duplicateFatturaSurplusCount),
              )}
            </p>
          ) : null}

          <p className="mb-3 text-xs leading-relaxed text-app-fg-muted">
            {t.dashboard.fattureRiepilogoLimitNote.replace(/\{n\}/g, String(rows.length))}
          </p>
          <StandardCard accent="emerald">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className={appSectionTableHeadRowAccentClass('emerald')}>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.date}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.invoiceNum}</th>
                    <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.fornitori.listinoColImporto}</th>
                    <th className={`w-40 ${APP_SECTION_TABLE_TH_RIGHT}`}>{' '}</th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {rows.map((r) => (
                    <tr key={r.id} className={APP_SECTION_TABLE_TR}>
                      <td className="whitespace-nowrap px-6 py-4 text-app-fg-muted">{formatDate(r.data)}</td>
                      <td className="max-w-[200px] px-6 py-4">
                        <Link href={`/fornitori/${r.fornitore_id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {r.fornitore_nome}
                        </Link>
                      </td>
                      <td className="max-w-[200px] px-6 py-4 text-app-fg-muted">
                        <span className="break-words">{r.numero_fattura?.trim() || '—'}</span>
                        {summary.duplicateFatturaMemberIds.has(r.id) ? (
                          <span className={dupBadgeCls}>{t.common.duplicateBadge}</span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold tabular-nums text-app-fg">
                        {formatCurrency(Number(r.importo) || 0, currency, locale)}
                      </td>
                      <td className="px-6 py-4 text-right align-middle">
                        <Link href={`/fatture/${r.id}`} className={APP_SECTION_ROW_ACTION_PILL}>
                          {t.dashboard.fattureRiepilogoOpenInvoice}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StandardCard>

          <div className="mt-4 text-center md:text-left">
            <Link
              href="/fatture"
              className="text-sm font-medium text-app-fg-muted transition-colors hover:text-app-fg hover:underline"
            >
              {t.dashboard.fattureRiepilogoLinkAll}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
