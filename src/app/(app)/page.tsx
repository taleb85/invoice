import Link from 'next/link'
import { Suspense } from 'react'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import DuplicateDashboardBanner from '@/components/duplicates/duplicate-dashboard-banner'
import DashboardScannerFlowCard from '@/components/DashboardScannerFlowCard'
import { AdminSelectSedeButton } from '@/components/AdminSelectSedeButton'
import AdminSedeViewBanner from '@/components/AdminSedeViewBanner'
import { getT, getLocale, getTimezone, getCurrency, getCookieStore, formatDate as fmtDate } from '@/lib/locale-server'
import { countSyncLogErrors24h } from '@/lib/dashboard-notification-counts'
import {
  DEFAULT_OPERATOR_DASHBOARD_KPIS,
  fetchOperatorDashboardKpis,
  fetchTodayScannerFlowDetail,
  fornitoreIdsForSede,
} from '@/lib/dashboard-operator-kpis'
import { fetchAllSedeSupplierSuggestions } from '@/lib/suggested-fornitore'
import {
  SUPPLIER_HINT_SKIP_COOKIE,
  parseSupplierHintSkipCookie,
  skipsForSede,
} from '@/lib/supplier-hint-dismiss-cookie'
import { fetchRecurringEmailBodySupplierHints } from '@/lib/dashboard-email-body-supplier-hints'
import { fetchAdminDashboardSediWithStats } from '@/lib/dashboard-admin-sedi-overview'
import DashboardOperatorKpiGrid, { DashboardOperatorKpiSkeleton } from '@/components/DashboardOperatorKpiGrid'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import DashboardRecentBolleCard from '@/components/DashboardRecentBolleCard'
import { getFiscalYearPgBounds, formatFiscalYearShort, parseFiscalYearQueryParam } from '@/lib/fiscal-year'
import DashboardFiscalYearHeaderSelect from '@/components/DashboardFiscalYearHeaderSelect'
import { APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { DashboardAdminMobileActions } from '@/components/DashboardAdminMobileActions'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
} from '@/lib/summary-highlight-accent'
import DashboardSedeSupplierSuggestion from '@/components/DashboardSedeSupplierSuggestion'
import DashboardEmailBodySupplierHints from '@/components/DashboardEmailBodySupplierHints'

export const dynamic = 'force-dynamic'

export default async function DashboardPage(props: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams =
    props.searchParams != null ? await props.searchParams : {}
  const cookieStore = await getCookieStore()
  const [t, locale, tz, profile, currency] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getProfile(),
    getCurrency(),
  ])
  const isMasterAdmin = profile?.role === 'admin'
  const isAdminSede = profile?.role === 'admin_sede'
  const adminPick = isMasterAdmin ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  const actingRoleCookie = cookieStore.get('fluxo-acting-role')?.value?.trim()
  const dashboardAdminSedeUi =
    isAdminSede || (isMasterAdmin && actingRoleCookie === 'admin_sede' && !!adminPick)

  const { supabase } = await getRequestAuth()
  let adminViewSedeId: string | null = null
  let adminViewSedeNome: string | null = null
  if (isMasterAdmin && adminPick) {
    const { data } = await supabase.from('sedi').select('id, nome').eq('id', adminPick).maybeSingle()
    if (data?.id) {
      adminViewSedeId = data.id
      adminViewSedeNome = data.nome ?? null
    }
  }

  if (isMasterAdmin && !adminViewSedeId) {
    const [sediStats, erroriRecenti, emailBodySupplierHints] = await Promise.all([
      fetchAdminDashboardSediWithStats(supabase),
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

        {sediStats.length === 0 ? (
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
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sediStats.map((sede) => {
              const unhealthy = 'syncUnhealthy' in sede && Boolean((sede as { syncUnhealthy?: boolean }).syncUnhealthy)
              const ocrN = 'ocrFailures48h' in sede ? Number((sede as { ocrFailures48h?: number }).ocrFailures48h ?? 0) : 0
              const imapErr = (sede as { last_imap_sync_error?: string | null }).last_imap_sync_error
              return (
              <div
                key={sede.id}
                className={`rounded-xl border app-workspace-inset-bg p-5 shadow-[0_0_28px_-10px_rgba(6,182,212,0.35)] ${
                  unhealthy
                    ? 'border-[rgba(34,211,238,0.15)] ring-1 ring-red-500/25'
                    : 'border-app-soft-border'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-line-20">
                      <svg className="h-4 w-4 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <span className="min-w-0 font-semibold text-app-fg">{sede.nome}</span>
                  </div>
                  <AdminSelectSedeButton
                    sedeId={sede.id}
                    className="shrink-0 rounded-lg border border-app-line-32 app-workspace-surface-elevated px-2.5 py-1.5 text-[11px] font-semibold text-app-fg-muted transition-colors hover:border-app-line-40 hover:bg-app-line-12"
                  >
                    {t.dashboard.enterAsSede}
                  </AdminSelectSedeButton>
                </div>
                {unhealthy && (
                  <div className="mb-3 rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-950/35 px-2.5 py-2 text-[11px] leading-snug text-red-100">
                    <p className="font-semibold">{t.dashboard.syncHealthAlert}</p>
                    {imapErr ? <p className="mt-1 font-mono text-red-200/90">{imapErr}</p> : null}
                    {ocrN > 0 ? (
                      <p className="mt-1 text-red-200/90">
                        {t.dashboard.syncHealthOcrCount.replace(/\{n\}/g, String(ocrN))}
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Link
                    href={`/sedi/${sede.id}/fornitori`}
                    className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-violet-500/5 py-2.5 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-violet-500/15 active:scale-[0.98] touch-manipulation"
                  >
                    <p className="text-xl font-bold text-violet-200">{sede.fornitori}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-400/80">
                      {t.dashboard.suppliers}
                    </p>
                  </Link>
                  <Link
                    href="/bolle"
                    className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-500/5 py-2.5 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-amber-500/15 active:scale-[0.98] touch-manipulation"
                  >
                    <p className="text-xl font-bold text-amber-200">{sede.bolleInAttesa}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                      {t.dashboard.pendingBills}
                    </p>
                  </Link>
                  <Link
                    href="/fatture"
                    className="rounded-lg border border-[rgba(34,211,238,0.15)] bg-emerald-500/5 py-2.5 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-emerald-500/15 active:scale-[0.98] touch-manipulation"
                  >
                    <p className="text-xl font-bold text-emerald-200">{sede.fatture}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400/80">
                      {t.dashboard.invoices}
                    </p>
                  </Link>
                </div>
              </div>
            )
          })}
          </div>
        )}
      </div>
    )
  }

  const sedeId = adminViewSedeId ?? profile?.sede_id ?? null
  let dashboardSedeNome: string | null = adminViewSedeNome
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
  const kpiFiscal = operatorScoped ? { countryCode: sedeCountryCode, labelYear: fiscalYear } : null
  const scannerFiscalBounds = kpiFiscal ? getFiscalYearPgBounds(kpiFiscal.countryCode, kpiFiscal.labelYear) : null

  const cookieStoreForDismiss = await getCookieStore()
  const supplierDismissSkips = parseSupplierHintSkipCookie(cookieStoreForDismiss.get(SUPPLIER_HINT_SKIP_COOKIE)?.value)
  const excludeDocIdsForSupplierHint = sedeId ? skipsForSede(supplierDismissSkips, sedeId) : []

  let kpis = DEFAULT_OPERATOR_DASHBOARD_KPIS
  let supplierHints: Awaited<ReturnType<typeof fetchAllSedeSupplierSuggestions>> = []
  let scannerFlowDetail: Awaited<ReturnType<typeof fetchTodayScannerFlowDetail>> = {
    summary: { aiElaborate: 0, archiviate: 0 },
    events: [],
  }
  try {
    const bundle = await Promise.all([
      operatorScoped
        ? fetchOperatorDashboardKpis(supabase, sedeId, fornitoreIds, kpiFiscal)
        : Promise.resolve({ ...DEFAULT_OPERATOR_DASHBOARD_KPIS }),
      operatorScoped && sedeId
        ? fetchAllSedeSupplierSuggestions(supabase, sedeId, { excludeDocumentIds: excludeDocIdsForSupplierHint })
        : Promise.resolve([]),
      operatorScoped && sedeId
        ? fetchTodayScannerFlowDetail(
            supabase,
            sedeId,
            tz,
            scannerFiscalBounds
              ? { summaryRange: { start: scannerFiscalBounds.tsFrom, endExclusive: scannerFiscalBounds.tsToExclusive } }
              : undefined,
          )
        : Promise.resolve({ summary: { aiElaborate: 0, archiviate: 0 }, events: [] }),
    ])
    kpis = bundle[0]
    supplierHints = bundle[1]
    scannerFlowDetail = bundle[2]
  } catch (err) {
    console.error('[DashboardPage] KPI/fetch', err)
  }
  const formatScannerEventTime = (iso: string) => fmtDate(iso, locale, tz, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      {isMasterAdmin && adminViewSedeId && adminViewSedeNome && !actingRoleCookie ? (
        <AdminSedeViewBanner sedeNome={adminViewSedeNome} />
      ) : null}
      <AppPageHeaderStrip dense accent="sky" flushBottom>
        <AppPageHeaderTitleWithDashboardShortcut>
          <div className="flex min-w-0 flex-row flex-nowrap items-center gap-2 overflow-x-auto sm:gap-x-3">
            <h1 className="app-page-title min-w-0 flex-1 truncate text-lg font-bold leading-snug sm:text-xl md:text-2xl md:leading-tight">
              {dashboardSedeNome ?? t.dashboard.title}
            </h1>
            {operatorScoped ? (
              <Suspense fallback={null}>
                <DashboardFiscalYearHeaderSelect countryCode={sedeCountryCode} selectedFiscalYear={fiscalYear} />
              </Suspense>
            ) : null}
          </div>
        </AppPageHeaderTitleWithDashboardShortcut>
      </AppPageHeaderStrip>

      {!operatorScoped && (
        <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      )}
      {operatorScoped && (isMasterAdmin || isAdminSede) && (
        <Suspense fallback={null}>
          <DuplicateDashboardBanner />
        </Suspense>
      )}
      {supplierHints.length > 0 && sedeId && (
        <div className={`hidden md:block ${SUMMARY_HIGHLIGHT_SURFACE_CLASS}`}>
          <div className={`app-card-bar-accent ${SUMMARY_HIGHLIGHT_ACCENTS.violet.bar}`} aria-hidden />
          <div className={`app-workspace-surface-elevated ${SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}`}>
            <DashboardSedeSupplierSuggestion sedeId={sedeId} items={supplierHints} />
          </div>
        </div>
      )}
      {operatorScoped ? (
        <>
          {dashboardAdminSedeUi && sedeId ? (
            <DashboardAdminMobileActions
              sedeId={sedeId}
              sedeOperatoriHref={`/sedi/${sedeId}#sede-operatori`}
            />
          ) : null}
        </>
      ) : null}

      {!operatorScoped ? (
        <div className="dashboard-operator-desktop-column hidden min-h-0 w-full min-w-0 flex-col md:flex">
          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-app-fg-muted">
              {t.fornitori.tabRiepilogo}
            </h2>
            <DashboardOperatorKpiGrid
              kpis={kpis}
              t={t}
              locale={locale}
              currency={currency}
            />
          </div>
        </div>
      ) : null}

      {operatorScoped ? (
        <>
          <div className="dashboard-operator-desktop-column hidden min-h-0 w-full min-w-0 flex-col md:flex">
            <Suspense fallback={<DashboardOperatorKpiSkeleton />}>
              <div>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-app-fg-muted">
                  {t.fornitori.tabRiepilogo}
                </h2>
                <DashboardOperatorKpiGrid
                  kpis={kpis}
                  t={t}
                  locale={locale}
                  currency={currency}
                  fiscalYear={fiscalYear}
                />
              </div>
            </Suspense>
          </div>
          {/* Scanner: visibile su mobile e desktop (sotto i KPI ≥1024px). Vedi globals.css. */}
          <div className="dashboard-operator-scanner-bolle-stack">
            <DashboardScannerFlowCard
              summary={scannerFlowDetail.summary}
              events={scannerFlowDetail.events}
              formatEventTime={formatScannerEventTime}
              t={t}
              headerLinks={{ newScanHref: '/bolle/new', eventsHref: '/scanner/eventi' }}
              tz={tz}
              fiscalYearLabel={kpiFiscal ? formatFiscalYearShort(kpiFiscal.countryCode, kpiFiscal.labelYear) : undefined}
              detailTimeRange={
                scannerFiscalBounds
                  ? { from: scannerFiscalBounds.tsFrom, toExclusive: scannerFiscalBounds.tsToExclusive }
                  : undefined
              }
            />
          </div>
        </>
      ) : (
        <div className="dashboard-operator-empty-shell-desktop">
          <DashboardRecentBolleCard />
        </div>
      )}

    </div>
  )
}
