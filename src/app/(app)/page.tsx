import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import SollecitiButton from '@/components/SollecitiButton'
import DashboardDuplicateFattureButton from '@/components/DashboardDuplicateFattureButton'
import DashboardScannerFlowCard from '@/components/DashboardScannerFlowCard'
import { AdminSelectSedeButton } from '@/components/AdminSelectSedeButton'
import AdminSedeViewBanner from '@/components/AdminSedeViewBanner'
import { getT, getLocale, getTimezone, getCurrency, getCookieStore, formatDate as fmtDate } from '@/lib/locale-server'
import { countSyncLogErrors24h } from '@/lib/dashboard-notification-counts'
import {
  countFornitoriWithOverdueBolle,
  fetchOperatorDashboardKpis,
  fetchTodayScannerFlowDetail,
  fornitoreIdsForSede,
} from '@/lib/dashboard-operator-kpis'
import { fetchSedeSupplierSuggestion } from '@/lib/suggested-fornitore'
import { fetchRecurringEmailBodySupplierHints } from '@/lib/dashboard-email-body-supplier-hints'
import { fetchAdminDashboardSediWithStats } from '@/lib/dashboard-admin-sedi-overview'
import DashboardOperatorKpiGrid from '@/components/DashboardOperatorKpiGrid'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import DashboardRecentBolleCard from '@/components/DashboardRecentBolleCard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
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
    const [sediStats, erroriRecenti, sollecitiFornitori, emailBodySupplierHints] = await Promise.all([
      fetchAdminDashboardSediWithStats(supabase),
      countSyncLogErrors24h(supabase),
      countFornitoriWithOverdueBolle(supabase, null),
      fetchRecurringEmailBodySupplierHints(supabase),
    ])

    return (
      <div className="flex w-full min-w-0 flex-col gap-5 md:gap-6 app-shell-page-padding">
        <div className="w-full">
          <AppPageHeaderStrip embedded>
            <AppPageHeaderTitleWithDashboardShortcut
              dashboardLabel={t.nav.dashboard}
              showDashboardShortcut={false}
            >
              <h1 className="app-page-title text-xl font-bold leading-tight md:text-2xl">{t.dashboard.title}</h1>
              <p className="mt-1 hidden text-sm leading-snug text-slate-400 md:block">{t.sedi.subtitleGlobalAdmin}</p>
            </AppPageHeaderTitleWithDashboardShortcut>
            <div className="flex w-full min-w-0 max-w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 md:gap-3">
              <div className="hidden min-w-0 shrink-0 md:flex md:w-auto md:max-w-none md:self-center md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-3 lg:gap-4 md:overflow-x-auto">
                <SollecitiButton fornitoriInScadenza={sollecitiFornitori} />
                <DashboardDuplicateFattureButton alwaysShowLabel />
              </div>
              <Link
                href="/log"
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-xs font-medium transition-colors ${
                  erroriRecenti > 0
                    ? 'bg-red-950/60 text-red-200 ring-1 ring-red-500/40 hover:bg-red-950/80'
                    : 'bg-slate-700/90 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {erroriRecenti > 0 && (
                  <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold text-white">
                    {erroriRecenti > 9 ? '9+' : erroriRecenti}
                  </span>
                )}
                <span className="hidden md:inline">{t.dashboard.viewLog}</span>
                <svg className="h-4 w-4 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
        </div>

        {emailBodySupplierHints.length > 0 ? (
          <div className="flex flex-col gap-2">
            {emailBodySupplierHints.map((h) => (
              <div
                key={`${h.sedeId ?? 'all'}-${h.displayName}`}
                className="flex flex-col gap-2 rounded-xl border border-violet-500/35 bg-violet-950/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-violet-100">
                  {t.dashboard.potentialSupplierFromEmailBodyBanner.replace(/\{name\}/g, h.displayName)}
                  <span className="ml-1.5 tabular-nums text-violet-300/85">×{h.hits}</span>
                </p>
                <Link
                  href={h.newFornitoreHref}
                  className="shrink-0 text-sm font-semibold text-violet-300 underline decoration-violet-400/50 hover:text-violet-200"
                >
                  {t.dashboard.potentialSupplierFromEmailBodyCta}
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        {sediStats.length === 0 ? (
          <div className="rounded-xl border border-slate-600/80 bg-slate-700/50 px-6 py-16 text-center">
            <svg className="mx-auto mb-3 h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-sm text-slate-200">{t.sedi.noSedi}</p>
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
                className={`rounded-xl border bg-slate-700/45 p-5 shadow-[0_0_28px_-10px_rgba(6,182,212,0.35)] ${
                  unhealthy
                    ? 'border-red-500/45 ring-1 ring-red-500/25'
                    : 'border-cyan-500/20'
                }`}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20">
                      <svg className="h-4 w-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <span className="min-w-0 font-semibold text-slate-100">{sede.nome}</span>
                  </div>
                  <AdminSelectSedeButton
                    sedeId={sede.id}
                    className="shrink-0 rounded-lg border border-slate-600/80 bg-slate-700/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:border-cyan-500/40 hover:bg-slate-700"
                  >
                    {t.dashboard.enterAsSede}
                  </AdminSelectSedeButton>
                </div>
                {unhealthy && (
                  <div className="mb-3 rounded-lg border border-red-500/35 bg-red-950/35 px-2.5 py-2 text-[11px] leading-snug text-red-100">
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
                    className="rounded-lg border border-violet-500/20 bg-violet-500/5 py-2.5 transition-colors hover:border-violet-400/40 hover:bg-violet-500/15 active:scale-[0.98] touch-manipulation"
                  >
                    <p className="text-xl font-bold text-violet-200">{sede.fornitori}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-400/80">
                      {t.dashboard.suppliers}
                    </p>
                  </Link>
                  <Link
                    href="/bolle"
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 py-2.5 transition-colors hover:border-amber-400/40 hover:bg-amber-500/15 active:scale-[0.98] touch-manipulation"
                  >
                    <p className="text-xl font-bold text-amber-200">{sede.bolleInAttesa}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                      {t.dashboard.pendingBills}
                    </p>
                  </Link>
                  <Link
                    href="/fatture"
                    className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 py-2.5 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15 active:scale-[0.98] touch-manipulation"
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
  const needSedeNome = Boolean(sedeId && dashboardSedeNome == null)
  const [fornitoreIds, sedeNomeRow] = await Promise.all([
    sedeId ? fornitoreIdsForSede(supabase, sedeId) : Promise.resolve([] as string[]),
    needSedeNome && sedeId
      ? supabase.from('sedi').select('nome').eq('id', sedeId).maybeSingle()
      : Promise.resolve({ data: null as { nome: string | null } | null }),
  ])
  if (needSedeNome && sedeNomeRow.data) {
    dashboardSedeNome = sedeNomeRow.data.nome ?? null
  }
  const operatorScoped = !!sedeId
  const [kpis, sollecitiFornitori, supplierHint, scannerFlowDetail] = await Promise.all([
    operatorScoped
      ? fetchOperatorDashboardKpis(supabase, sedeId, fornitoreIds)
      : Promise.resolve({
          bolleTotal: 0,
          bolleInAttesa: 0,
          fornitoriCount: 0,
          fattureCount: 0,
          documentiPending: 0,
          documentiDaAssociare: 0,
          totaleImporto: 0,
          listinoRows: 0,
          ordiniCount: 0,
          statementsTotal: 0,
          statementsWithIssues: 0,
          erroriRecenti: 0,
        }),
    countFornitoriWithOverdueBolle(supabase, operatorScoped ? fornitoreIds : null),
    operatorScoped && sedeId ? fetchSedeSupplierSuggestion(supabase, sedeId) : Promise.resolve(null),
    operatorScoped && sedeId
      ? fetchTodayScannerFlowDetail(supabase, sedeId, tz)
      : Promise.resolve({ summary: { aiElaborate: 0, archiviate: 0 }, events: [] }),
  ])
  const formatScannerEventTime = (iso: string) => fmtDate(iso, locale, tz, { hour: '2-digit', minute: '2-digit' })
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 md:gap-6 app-shell-page-padding">
      {isMasterAdmin && adminViewSedeId && adminViewSedeNome && !actingRoleCookie ? (
        <AdminSedeViewBanner sedeNome={adminViewSedeNome} />
      ) : null}
      <AppPageHeaderStrip className="!mb-0">
        <AppPageHeaderTitleWithDashboardShortcut
          dashboardLabel={t.nav.dashboard}
          showDashboardShortcut={false}
        >
          <h1 className="app-page-title min-w-0 truncate text-xl font-bold leading-tight md:text-2xl">
            {dashboardSedeNome ?? t.dashboard.title}
          </h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="hidden min-w-0 shrink-0 md:flex md:w-auto md:max-w-none md:self-center md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-3 lg:gap-4 md:overflow-x-auto">
          <DashboardDuplicateFattureButton alwaysShowLabel />
          <SollecitiButton fornitoriInScadenza={sollecitiFornitori} />
        </div>
      </AppPageHeaderStrip>

      {!operatorScoped && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      )}
      {supplierHint && (
        <div className="hidden rounded-xl border border-violet-400/55 bg-gradient-to-br from-violet-900/70 via-violet-800/55 to-fuchsia-950/60 px-4 py-3 text-sm shadow-[0_8px_32px_-8px_rgba(91,33,182,0.45),inset_0_1px_0_rgba(196,181,253,0.12)] ring-1 ring-violet-400/25 md:block">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <p className="min-w-0 flex-1 font-semibold leading-snug text-violet-50 [text-shadow:0_0_28px_rgba(167,139,250,0.4)]">
            {t.dashboard.suggestedSupplierBanner.replace(/\{name\}/g, supplierHint.displayName)}
          </p>
          <div className="flex w-fit max-w-full shrink-0 flex-wrap justify-end gap-2 md:mr-12">
            <Link
              href={supplierHint.newFornitoreHref}
              className="inline-flex items-center rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-violet-950/40 ring-1 ring-violet-300/35 transition-colors hover:bg-violet-400 hover:ring-violet-200/40"
            >
              {t.dashboard.suggestedSupplierAdd}
            </Link>
            <Link
              href={supplierHint.importHref}
              className="inline-flex items-center rounded-lg border border-violet-400/60 bg-violet-800/45 px-3 py-2 text-xs font-semibold text-violet-100 transition-colors hover:border-violet-300/70 hover:bg-violet-700/50 hover:text-white"
            >
              {t.dashboard.suggestedSupplierImport}
            </Link>
            <Link
              href="/statements/da-processare"
              className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold text-violet-300 underline decoration-violet-400/60 underline-offset-2 transition-colors hover:text-violet-100 hover:decoration-violet-200"
            >
              {t.statements.tabDocumenti} →
            </Link>
          </div>
          </div>
        </div>
      )}
      {operatorScoped ? (
        <>
          {isAdminSede && sedeId ? (
            <div className="hidden flex-wrap gap-2 rounded-xl border border-violet-500/30 bg-violet-950/20 px-3 py-3 md:flex md:items-center">
              <Link
                href={`/fornitori/new?prefill_sede_id=${encodeURIComponent(sedeId)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
              >
                {t.fornitori.new}
              </Link>
              <Link
                href={`/sedi/${sedeId}#sede-operatori`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 px-3 py-2 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-950/40"
              >
                {t.sedi.addOperatorSedeTitle}
              </Link>
              <Link
                href="/log"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/60"
              >
                {t.nav.logEmail}
              </Link>
            </div>
          ) : null}
          {dashboardAdminSedeUi && sedeId ? (
            <div className="grid grid-cols-1 gap-2 md:hidden">
              <Link
                href={`/fornitori/new?prefill_sede_id=${encodeURIComponent(sedeId)}`}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-violet-500/35 bg-violet-600/20 px-3 py-2.5 text-sm font-bold text-violet-100"
              >
                {t.fornitori.new}
              </Link>
              <Link
                href={`/sedi/${sedeId}#sede-operatori`}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-950/25 px-3 py-2.5 text-sm font-semibold text-violet-200"
              >
                {t.sedi.addOperatorSedeTitle}
              </Link>
              <Link
                href="/log"
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-600/60 px-3 py-2 text-xs font-medium text-slate-200"
              >
                {t.nav.logEmail}
              </Link>
            </div>
          ) : null}
        </>
      ) : null}

      {!operatorScoped ? (
        <div className="dashboard-operator-desktop-column">
          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-200">
              {t.fornitori.tabRiepilogo}
            </h2>
            <DashboardOperatorKpiGrid
              kpis={kpis}
              t={t}
              locale={locale}
              currency={currency}
              hideBelowLg
            />
          </div>
        </div>
      ) : null}

      {operatorScoped ? (
        <>
          <div className="dashboard-operator-desktop-column">
            <div>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-200">
                {t.fornitori.tabRiepilogo}
              </h2>
              <DashboardOperatorKpiGrid
                kpis={kpis}
                t={t}
                locale={locale}
                currency={currency}
                hideBelowLg
              />
            </div>
          </div>
          {/* Scanner + bolle: visibile su mobile e desktop (sotto i KPI ≥1024px). Vedi globals.css. */}
          <div className="dashboard-operator-scanner-bolle-stack">
            <DashboardScannerFlowCard
              summary={scannerFlowDetail.summary}
              events={scannerFlowDetail.events}
              formatEventTime={formatScannerEventTime}
              t={t}
            />
            <div className="min-h-0 min-w-0">
              <DashboardRecentBolleCard
                bolle={[]}
                formatDate={formatDate}
                surface="scanner-flow"
                hideRecentList
                hrefScannerEvents="/scanner/eventi"
                labels={{
                  title: t.dashboard.recentBills,
                  newBill: t.bolle.new,
                  viewAll: t.dashboard.viewAll,
                  scannerHubTitle: t.dashboard.scannerFlowBolleHubTitle,
                  scannerHubOpenScanner: t.dashboard.scannerFlowOpenScanner,
                  scannerHubEventsLink: t.dashboard.scannerFlowEventsAllLink,
                  noBills: t.bolle.noBills,
                  addFirst: t.bolle.addFirst,
                  completato: t.status.completato,
                  inAttesa: t.status.inAttesa,
                }}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="dashboard-operator-empty-shell-desktop">
          <DashboardRecentBolleCard shellOnly />
        </div>
      )}

    </div>
  )
}
