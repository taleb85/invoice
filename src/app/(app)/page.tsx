import Link from 'next/link'
import { Suspense } from 'react'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import DuplicateDashboardBanner from '@/components/duplicates/duplicate-dashboard-banner'
import AdminSedeViewBanner from '@/components/AdminSedeViewBanner'
import { getT, getLocale, getCurrency, getCookieStore } from '@/lib/locale-server'
import { countSyncLogErrors24h } from '@/lib/dashboard-notification-counts'
import {
  DEFAULT_OPERATOR_DASHBOARD_KPIS,
  fetchOperatorDashboardKpis,
  fornitoreIdsForSede,
} from '@/lib/dashboard-operator-kpis'
import { fetchRecurringEmailBodySupplierHints } from '@/lib/dashboard-email-body-supplier-hints'
import DashboardOperatorKpiGrid, { DashboardOperatorKpiSkeleton } from '@/components/DashboardOperatorKpiGrid'
import { DashboardEmbeddedAnalytics } from '@/components/analytics/dashboard-embedded-analytics'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import DashboardRecentBolleCard from '@/components/DashboardRecentBolleCard'
import { formatFiscalYearShort, parseFiscalYearQueryParam } from '@/lib/fiscal-year'
import DashboardFiscalYearHeaderSelect from '@/components/DashboardFiscalYearHeaderSelect'
import { APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { DashboardAdminMobileActions } from '@/components/DashboardAdminMobileActions'
import DashboardEmailBodySupplierHints from '@/components/DashboardEmailBodySupplierHints'
import { OperatorWorkspaceToolsToolbar } from '@/components/OperatorDesktopWorkspaceHeader'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import { isAdminSedeRole, isBranchSedeStaffRole, isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function DashboardPage(props: {
  searchParams?: Promise<{ fy?: string; months?: string }>
}) {
  const searchParams = await unwrapSearchParams(props.searchParams)
  const cookieStore = await getCookieStore()
  const [t, locale, profile, currency] = await Promise.all([
    getT(),
    getLocale(),
    getProfile(),
    getCurrency(),
  ])
  const isMasterAdmin = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)
  const adminPick = isMasterAdmin ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  const actingRoleCookie = cookieStore.get('fluxo-acting-role')?.value?.trim()
  const dashboardAdminSedeUi =
    isAdminSede || (isMasterAdmin && actingRoleCookie === 'admin_sede' && !!adminPick)

  const { supabase } = await getRequestAuth()

  /** Stessa sede attiva degli elenchi: master → cookie `admin-sede-id` validato, altrimenti prima sede (mai null se DB ha sedi). */
  const operationalSedeId = await resolveActiveSedeIdForLists(
    supabase,
    profile ?? undefined,
    (n) => cookieStore.get(n),
  )

  /** Master ma non esiste alcuna sede in database → porta gestionale onboarding. */
  if (isMasterAdmin && operationalSedeId === null) {
    const [erroriRecenti, emailBodySupplierHints] = await Promise.all([
      countSyncLogErrors24h(supabase),
      fetchRecurringEmailBodySupplierHints(supabase),
    ])

    return (
      <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
        <AppPageHeaderStrip embedded>
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 id="page-dashboard-strip-title" className="app-page-title text-xl font-bold leading-tight md:text-2xl" aria-describedby="page-dashboard-strip-desc">
              {t.dashboard.title}
            </h1>
            <p id="page-dashboard-strip-desc" className={APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}>
              {t.sedi.subtitleGlobalAdmin}
            </p>
          </AppPageHeaderTitleWithDashboardShortcut>
          <div className="flex w-full min-w-0 max-w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 md:gap-3">
            <Link
              href="/log"
              className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-medium transition-colors ${
                erroriRecenti > 0
                  ? 'bg-red-950/60 text-red-200 ring-1 ring-red-500/40 hover:bg-red-950/80'
                  : 'app-workspace-surface-elevated text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg'
              }`}
            >
              {erroriRecenti > 0 && (
                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold text-white">
                  {erroriRecenti > 9 ? '9+' : erroriRecenti}
                </span>
              )}
              <span className="hidden md:inline">{t.dashboard.viewLog}</span>
              <svg className={`h-4 w-4 md:hidden ${icon.emailSync}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </Link>
          </div>
        </AppPageHeaderStrip>

        {emailBodySupplierHints.length > 0 ? (
          <DashboardEmailBodySupplierHints
            hints={emailBodySupplierHints}
            bannerLineTemplate={t.dashboard.potentialSupplierFromEmailBodyBanner}
            ctaLabel={t.dashboard.potentialSupplierFromEmailBodyCta}
          />
        ) : null}

        <div className="rounded-xl border border-app-line-32 app-workspace-inset-bg-soft px-6 py-16 text-center">
          <svg className="mx-auto mb-3 h-12 w-12 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <p className="text-sm text-app-fg-muted">{t.sedi.noSedi}</p>
          <Link
            href="/onboarding"
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-[rgba(34,211,238,0.25)] bg-app-line-15 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-app-line-20 hover:text-cyan-100"
          >
            {t.sedi.newSede}
          </Link>
        </div>
      </div>
    )
  }

  const sedeId = operationalSedeId
  let dashboardSedeNome: string | null = null
  const [fornitoreIds, sedeMetaRow] = await Promise.all([
    sedeId ? fornitoreIdsForSede(supabase, sedeId) : Promise.resolve([] as string[]),
    sedeId
      ? supabase.from('sedi').select('nome, country_code').eq('id', sedeId).maybeSingle()
      : Promise.resolve({ data: null as { nome: string | null; country_code: string | null } | null }),
  ])
  if (sedeId && sedeMetaRow.data?.nome && dashboardSedeNome == null) {
    dashboardSedeNome = sedeMetaRow.data.nome ?? null
  }
  const sedeCountryCode = (sedeMetaRow.data?.country_code ?? 'IT').trim() || 'IT'
  const operatorScoped = !!sedeId
  const fiscalYear = operatorScoped ? parseFiscalYearQueryParam(searchParams.fy, sedeCountryCode) : 0
  const dashboardAnalyticsMonths = (() => {
    const raw = searchParams.months
    if (raw == null || raw === '') return 6
    const n = parseInt(String(raw), 10)
    return Math.min(24, Math.max(1, Number.isFinite(n) ? n : 6))
  })()
  const analyticsFyLabelEmbedded = operatorScoped ? formatFiscalYearShort(sedeCountryCode, fiscalYear) : ''
  const canViewEmbeddedAnalytics =
    !!operatorScoped &&
    !!sedeId &&
    !!profile?.role &&
    isSedePrivilegedRole(profile.role)
  const dashboardAnalyticsPeriodToolbar = canViewEmbeddedAnalytics
  const kpiFiscal = operatorScoped ? { countryCode: sedeCountryCode, labelYear: fiscalYear } : null

  let kpis = DEFAULT_OPERATOR_DASHBOARD_KPIS
  try {
    if (operatorScoped) {
      kpis = await fetchOperatorDashboardKpis(supabase, sedeId, fornitoreIds, kpiFiscal)
    }
  } catch (err) {
    console.error('[DashboardPage] KPI/fetch', err)
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {isMasterAdmin &&
      adminPick &&
      sedeId &&
      dashboardSedeNome &&
      adminPick === sedeId &&
      !actingRoleCookie ? (
        <AdminSedeViewBanner sedeNome={dashboardSedeNome} />
      ) : null}
      <AppPageHeaderStrip
        dense
        accent="sky"
        flushBottom
        showDesktopTray={!dashboardAnalyticsPeriodToolbar}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <div className="flex min-w-0 flex-row flex-nowrap items-center gap-2 overflow-x-auto sm:gap-x-3">
            <h1 className="app-page-title min-w-0 flex-1 truncate text-lg font-bold leading-snug sm:text-xl md:text-2xl md:leading-tight">
              {dashboardSedeNome ?? t.dashboard.title}
            </h1>
            {operatorScoped && !dashboardAnalyticsPeriodToolbar ? (
              <Suspense fallback={null}>
                <DashboardFiscalYearHeaderSelect countryCode={sedeCountryCode} selectedFiscalYear={fiscalYear} />
              </Suspense>
            ) : null}
          </div>
        </AppPageHeaderTitleWithDashboardShortcut>
        <OperatorWorkspaceToolsToolbar className="hidden w-full min-w-0 shrink-0 justify-end md:flex md:max-w-[min(100%,42rem)]" />
      </AppPageHeaderStrip>

      {!operatorScoped && (
        <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      )}
      {operatorScoped && (isMasterAdmin || isBranchSedeStaffRole(profile?.role)) && (
        <Suspense fallback={null}>
          <DuplicateDashboardBanner />
        </Suspense>
      )}
      {operatorScoped ? (
        <>
          {dashboardAdminSedeUi && sedeId ? (
            <DashboardAdminMobileActions sedeOperatoriHref={`/sedi/${sedeId}#sede-operatori`} />
          ) : null}
          {/*
           * KPI desktop: classe `hidden md:flex` sulla colonna sotto — senza questo blocco
           * schermate &lt; md non vedono numeri (dashboard “vuota”). `dashboard-operator-scanner-mobile-only`
           * è nascosto da md in globals.css per evitare duplicati.
           */}
          <div className="dashboard-operator-scanner-mobile-only w-full min-w-0">
            <Suspense fallback={<DashboardOperatorKpiSkeleton glassShell />}>
              <DashboardOperatorKpiGrid
                glassShell
                kpis={kpis}
                t={t}
                locale={locale}
                currency={currency}
                fiscalYear={fiscalYear}
                kpiRevisionFiscalCountryCode={sedeCountryCode}
              />
            </Suspense>
          </div>
        </>
      ) : null}

      {!operatorScoped ? (
        <div className="dashboard-operator-desktop-column hidden min-h-0 w-full min-w-0 flex-col md:flex">
          <DashboardOperatorKpiGrid glassShell kpis={kpis} t={t} locale={locale} currency={currency} />
        </div>
      ) : null}

      {operatorScoped ? (
        <>
          <div className="dashboard-operator-desktop-column dashboard-operator-aurora-grid hidden min-h-0 w-full min-w-0 md:flex">
            <div className="dashboard-operator-aurora-area-kpi min-w-0">
              <Suspense fallback={<DashboardOperatorKpiSkeleton glassShell />}>
                <DashboardOperatorKpiGrid
                  glassShell
                  kpis={kpis}
                  t={t}
                  locale={locale}
                  currency={currency}
                  fiscalYear={fiscalYear}
                  kpiRevisionFiscalCountryCode={sedeCountryCode}
                />
              </Suspense>
            </div>
          </div>
          {canViewEmbeddedAnalytics && sedeId ? (
            <div className="min-h-0 w-full min-w-0 mt-5 md:mt-6 pt-6 border-t border-app-line-15">
              <DashboardEmbeddedAnalytics
                sedeId={sedeId}
                fiscalYear={fiscalYear}
                months={dashboardAnalyticsMonths}
                fyLabel={analyticsFyLabelEmbedded}
                dashboardPeriodToolbar={{ countryCode: sedeCountryCode }}
              />
            </div>
          ) : null}
        </>
      ) : (
        <div className="dashboard-operator-empty-shell-desktop">
          <DashboardRecentBolleCard />
        </div>
      )}
    </div>
  )
}
