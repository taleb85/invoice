import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import SollecitiButton from '@/components/SollecitiButton'
import ScanEmailButton from '@/components/ScanEmailButton'
import DashboardHubQuickActions from '@/components/DashboardHubQuickActions'
import { AdminSelectSedeButton } from '@/components/AdminSelectSedeButton'
import AdminSedeViewBanner from '@/components/AdminSedeViewBanner'
import { getT, getLocale, getTimezone, getCurrency, getCookieStore, formatDate as fmtDate } from '@/lib/locale-server'
import { countSyncLogErrors24h } from '@/lib/dashboard-notification-counts'
import {
  countFornitoriWithOverdueBolle,
  fetchOperatorDashboardKpis,
  fetchRecentBolleScoped,
  fornitoreIdsForSede,
} from '@/lib/dashboard-operator-kpis'
import { fetchSedeSupplierSuggestion } from '@/lib/suggested-fornitore'
import { fetchRecurringEmailBodySupplierHints } from '@/lib/dashboard-email-body-supplier-hints'
import { fetchAdminDashboardSediWithStats } from '@/lib/dashboard-admin-sedi-overview'
import DashboardOperatorKpiGrid from '@/components/DashboardOperatorKpiGrid'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

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
      <div className="w-full min-w-0 app-shell-page-padding">
        <div className="mb-8 w-full">
          <AppPageHeaderStrip embedded>
            <AppPageHeaderTitleWithDashboardShortcut
              dashboardLabel={t.nav.dashboard}
              showDashboardShortcut={false}
            >
              <h1 className="app-page-title text-xl font-bold md:text-2xl">{t.dashboard.title}</h1>
              <p className="mt-1 hidden text-sm text-slate-100/90 md:block">{t.sedi.subtitleGlobalAdmin}</p>
            </AppPageHeaderTitleWithDashboardShortcut>
            <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3">
              <SollecitiButton fornitoriInScadenza={sollecitiFornitori} />
              <ScanEmailButton alwaysShowLabel />
              <Link
                href="/log"
                className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
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
          <div className="mb-4 flex flex-col gap-2">
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
          <div className="mt-4 rounded-xl border border-slate-600/80 bg-slate-700/50 px-6 py-16 text-center">
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
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
  const [kpis, bolle, sollecitiFornitori, supplierHint] = await Promise.all([
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
    operatorScoped ? fetchRecentBolleScoped(supabase, fornitoreIds) : Promise.resolve([]),
    countFornitoriWithOverdueBolle(supabase, operatorScoped ? fornitoreIds : null),
    operatorScoped && sedeId ? fetchSedeSupplierSuggestion(supabase, sedeId) : Promise.resolve(null),
  ])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="w-full min-w-0 app-shell-page-padding">
      {isMasterAdmin && adminViewSedeId && adminViewSedeNome && !actingRoleCookie ? (
        <AdminSedeViewBanner sedeNome={adminViewSedeNome} />
      ) : null}
      <AppPageHeaderStrip>
        <AppPageHeaderTitleWithDashboardShortcut
          dashboardLabel={t.nav.dashboard}
          showDashboardShortcut={false}
        >
          <h1 className="app-page-title text-xl font-bold md:text-2xl">
            {dashboardSedeNome ?? t.dashboard.title}
          </h1>
          <p className="mt-0.5 hidden text-sm text-slate-200 md:block">{t.dashboard.subtitle}</p>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3">
          <ScanEmailButton alwaysShowLabel sedeId={adminViewSedeId ?? undefined} />
          <SollecitiButton fornitoriInScadenza={sollecitiFornitori} />
        </div>
      </AppPageHeaderStrip>

      {!operatorScoped && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      )}
      {supplierHint && (
        <div className="mb-4 rounded-xl border border-violet-400/55 bg-gradient-to-br from-violet-900/70 via-violet-800/55 to-fuchsia-950/60 px-4 py-3 text-sm shadow-[0_8px_32px_-8px_rgba(91,33,182,0.45),inset_0_1px_0_rgba(196,181,253,0.12)] ring-1 ring-violet-400/25">
          <p className="font-semibold leading-snug text-violet-50 [text-shadow:0_0_28px_rgba(167,139,250,0.4)]">
            {t.dashboard.suggestedSupplierBanner.replace(/\{name\}/g, supplierHint.displayName)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
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
      )}
      {operatorScoped ? (
        <>
          {isAdminSede && sedeId ? (
            <div className="mb-4 hidden flex-wrap gap-2 rounded-xl border border-violet-500/30 bg-violet-950/20 px-3 py-3 md:flex md:items-center">
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
          <Link
            href="/bolle/new"
            className="mb-4 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/15 to-violet-500/10 px-4 py-3 text-sm font-bold text-cyan-100 shadow-[0_0_24px_-8px_rgba(6,182,212,0.45)] transition-colors hover:border-cyan-400/50 hover:from-cyan-500/25 md:hidden"
          >
            <svg className="h-5 w-5 shrink-0 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-center leading-tight">{t.bolle.scannerTitle}</span>
          </Link>
          {dashboardAdminSedeUi && sedeId ? (
            <div className="mb-4 grid grid-cols-1 gap-2 md:hidden">
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
          <DashboardHubQuickActions />
        </>
      ) : null}
      <h2
        className={`mb-3 text-sm font-semibold tracking-wide text-slate-200 ${operatorScoped ? 'operator-dash-hide-mobile' : ''}`}
      >
        {t.fornitori.tabRiepilogo}
      </h2>
      <div className={operatorScoped ? 'operator-dash-hide-mobile' : ''}>
        <DashboardOperatorKpiGrid kpis={kpis} t={t} locale={locale} currency={currency} />
      </div>

      <div
        className={`app-card overflow-hidden ${SUMMARY_HIGHLIGHT_ACCENTS.cyan.border} ${operatorScoped ? 'operator-dash-hide-mobile' : ''}`}
      >
        <div className={`app-card-bar ${SUMMARY_HIGHLIGHT_ACCENTS.cyan.bar}`} aria-hidden />
        <div className="flex flex-col gap-3 border-b border-slate-600/80/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="font-semibold text-slate-100">{t.dashboard.recentBills}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/bolle/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.bolle.new}
            </Link>
            <Link href="/bolle" className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
              {t.dashboard.viewAll} →
            </Link>
          </div>
        </div>

        {bolle.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="mx-auto mb-3 h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-sm text-slate-200">{t.bolle.noBills}</p>
            <Link href="/bolle/new" className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
              {t.bolle.addFirst}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {bolle.map((b: { id: string; data: string; stato: string; fornitori?: { nome?: string | null } | null }) => (
              <Link
                key={b.id}
                href={`/bolle/${b.id}`}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-700/40"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">{b.fornitori?.nome ?? '—'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDate(b.data)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    b.stato === 'completato'
                      ? 'bg-green-500/15 text-green-300 ring-1 ring-green-500/30'
                      : 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30'
                  }`}
                >
                  {b.stato === 'completato' ? t.status.completato : t.status.inAttesa}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
