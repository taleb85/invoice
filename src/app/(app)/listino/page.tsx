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
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { StandardCard } from '@/components/ui/StandardCard'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  APP_SHELL_SECTION_PAGE_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
  APP_SECTION_EMPTY_LINK_CLASS,
  APP_SECTION_TABLE_CELL_LINK,
  appSectionTableHeadRowAccentClass,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_THEAD_STICKY,
  APP_SECTION_TABLE_TR,
} from '@/lib/app-shell-layout'

export const dynamic = 'force-dynamic'

export default async function ListinoOverviewPage(props: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams =
    props.searchParams != null ? await props.searchParams : {}
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

  /** Istante server per confronto “giorni da ultimo prezzo” (una volta per richiesta RSC). */
  // eslint-disable-next-line react-hooks/purity -- Date.now valutato nel boundary richiesta server, non in re-render client
  const listinoNowMs = Date.now()

  const formatDate = (d: string) => fmtDate(d, locale, tz)

  /** Freshness badge basata sulla data del prezzo (solo visualizzazione). */
  function priceFreshnessBadge(dataPrezzo: string): { label: string; cls: string } {
    const diffDays = Math.floor((listinoNowMs - new Date(dataPrezzo).getTime()) / 86_400_000)
    if (diffDays <= 30) return { label: 'Recente', cls: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' }
    if (diffDays <= 90) return { label: 'Aggiornato', cls: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30' }
    return { label: 'Da verificare', cls: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30' }
  }

  const listinoMergedSummary = {
    label: t.common.total,
    primary: rows.length,
    secondary: t.dashboard.listinoOverviewLimitNote.replace(/\{n\}/g, String(rows.length)),
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="fuchsia"
        mergedSummary={listinoMergedSummary}
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.fornitori.tabListino}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : rows.length === 0 ? (
        <StandardCard accent="fuchsia">
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
        </StandardCard>
      ) : (
        <>
          {/* ── Vista card mobile ─────────────────────────────────── */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => {
              const badge = priceFreshnessBadge(r.data_prezzo)
              return (
                <Link
                  key={r.id}
                  href={`/fornitori/${r.fornitore_id}?tab=listino`}
                  className="block rounded-xl border border-[rgba(34,211,238,0.15)] bg-app-line-10/40 px-4 py-3 transition-colors active:bg-fuchsia-500/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300/70">
                        {r.fornitore_nome}
                      </p>
                      <p className="mt-0.5 font-bold text-app-fg leading-snug">{r.prodotto}</p>
                      {r.note ? (
                        <p className="mt-1 truncate text-[11px] text-app-fg-muted">{r.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-base font-bold tabular-nums text-app-fg">
                        {formatCurrency(r.prezzo, currency, locale)}
                      </span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-app-fg-muted">{formatDate(r.data_prezzo)}</p>
                </Link>
              )
            })}
          </div>

          {/* ── Vista tabella desktop ─────────────────────────────── */}
          <StandardCard accent="fuchsia" className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
                  <tr className={appSectionTableHeadRowAccentClass('fuchsia')}>
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
          </StandardCard>
        </>
      )}
    </div>
  )
}
