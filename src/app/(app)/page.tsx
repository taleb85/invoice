import Link from 'next/link'
import { createClient, getProfile } from '@/utils/supabase/server'
import SollecitiButton from '@/components/SollecitiButton'
import ScanEmailButton from '@/components/ScanEmailButton'
import DashboardHubQuickActions from '@/components/DashboardHubQuickActions'
import NotificationBell from '@/components/NotificationBell'
import { getT, getLocale, getTimezone, getCurrency, formatDate as fmtDate } from '@/lib/locale-server'
import { countPendingDocumentiForSede, countSyncLogErrors24h } from '@/lib/dashboard-notification-counts'
import {
  countFornitoriWithOverdueBolle,
  fetchOperatorDashboardKpis,
  fetchRecentBolleScoped,
  fornitoreIdsForSede,
} from '@/lib/dashboard-operator-kpis'
import DashboardOperatorKpiGrid from '@/components/DashboardOperatorKpiGrid'
import type { Sede } from '@/types'

async function getStatsBySede() {
  const supabase = await createClient()
  const { data: sedi } = await supabase.from('sedi').select('*').order('nome')

  const sediWithStats = await Promise.all(
    (sedi ?? []).map(async (sede: Sede) => {
      const [{ count: fornitori }, { count: bolleInAttesa }, { count: fattureFirmate }, documentiPendingSede] =
        await Promise.all([
          supabase.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
          supabase
            .from('bolle')
            .select('*', { count: 'exact', head: true })
            .eq('sede_id', sede.id)
            .eq('stato', 'in attesa'),
          supabase.from('fatture').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
          countPendingDocumentiForSede(supabase, sede.id),
        ])
      return {
        ...sede,
        fornitori:     fornitori ?? 0,
        bolleInAttesa: bolleInAttesa ?? 0,
        fatture:       (fattureFirmate ?? 0) + documentiPendingSede,
      }
    })
  )
  return sediWithStats
}

export default async function DashboardPage() {
  const [t, locale, tz, profile, currency] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getProfile(),
    getCurrency(),
  ])
  const isAdmin = profile?.role === 'admin'

  if (isAdmin) {
    const supabase = await createClient()
    const [sediStats, erroriRecenti, sollecitiFornitori] = await Promise.all([
      getStatsBySede(),
      countSyncLogErrors24h(supabase),
      countFornitoriWithOverdueBolle(supabase, null),
    ])

    return (
      <div className="max-w-5xl p-4 md:p-8">
        <div className="mb-8 w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3">
            <div className="min-w-0 sm:flex-1 sm:flex-initial">
              <h1 className="text-xl font-bold text-slate-100 md:text-2xl">{t.dashboard.title}</h1>
              <p className="mt-1 hidden text-sm text-slate-400 md:block">{t.sedi.subtitle}</p>
            </div>
            <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3">
              <NotificationBell
                variant="inline"
                isAdmin
                initialAdminErrors={erroriRecenti}
                initialOperatorPending={0}
                initialOperatorLogErrors={0}
              />
              <SollecitiButton fornitoriInScadenza={sollecitiFornitori} />
              <ScanEmailButton alwaysShowLabel />
              <Link
                href="/log"
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  erroriRecenti > 0
                    ? 'bg-red-950/60 text-red-200 ring-1 ring-red-500/40 hover:bg-red-950/80'
                    : 'bg-slate-800/90 text-slate-200 hover:bg-slate-800'
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
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-100">{t.dashboard.sedeOverview}</h2>
          <Link href="/sedi" className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
            {t.dashboard.manageSedi}
          </Link>
        </div>

        {sediStats.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-6 py-16 text-center">
            <svg className="mx-auto mb-3 h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-sm text-slate-400">{t.sedi.noSedi}</p>
            <Link href="/sedi" className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline">
              {t.dashboard.manageSedi}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sediStats.map((sede) => (
              <div
                key={sede.id}
                className="rounded-xl border border-cyan-500/20 bg-slate-900/45 p-5 shadow-[0_0_28px_-10px_rgba(6,182,212,0.35)]"
              >
                <div className="mb-4 flex items-center gap-2">
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
                  <span className="font-semibold text-slate-100">{sede.nome}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 py-2.5">
                    <p className="text-xl font-bold text-violet-200">{sede.fornitori}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-400/80">
                      {t.dashboard.suppliers}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 py-2.5">
                    <p className="text-xl font-bold text-amber-200">{sede.bolleInAttesa}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                      {t.dashboard.pendingBills}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 py-2.5">
                    <p className="text-xl font-bold text-emerald-200">{sede.fatture}</p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400/80">
                      {t.dashboard.invoices}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const supabase = await createClient()
  const sedeId = profile?.sede_id ?? null
  const fornitoreIds = sedeId ? await fornitoreIdsForSede(supabase, sedeId) : null
  const [kpis, bolle, sollecitiFornitori] = await Promise.all([
    fetchOperatorDashboardKpis(supabase, sedeId, sedeId ? fornitoreIds : undefined),
    fetchRecentBolleScoped(supabase, fornitoreIds),
    countFornitoriWithOverdueBolle(supabase, sedeId ? fornitoreIds : null),
  ])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="w-full max-w-5xl p-4 md:p-8">
      <div className="mb-6 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3 md:mb-8">
        <div className="min-w-0 sm:flex-1 sm:flex-initial">
          <h1 className="text-xl font-bold text-slate-100 md:text-2xl">{t.dashboard.title}</h1>
          <p className="mt-0.5 hidden text-sm text-slate-400 md:block">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3">
          <NotificationBell
            variant="inline"
            isAdmin={false}
            initialAdminErrors={0}
            initialOperatorPending={kpis.documentiPending}
            initialOperatorLogErrors={kpis.erroriRecenti}
          />
          <ScanEmailButton alwaysShowLabel />
          <Link
            href="/log"
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              kpis.erroriRecenti > 0
                ? 'bg-red-950/60 text-red-200 ring-1 ring-red-500/40 hover:bg-red-950/80'
                : 'bg-slate-800/90 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {kpis.erroriRecenti > 0 && (
              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold text-white">
                {kpis.erroriRecenti > 9 ? '9+' : kpis.erroriRecenti}
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
          <SollecitiButton fornitoriInScadenza={sollecitiFornitori} />
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-300">{t.fornitori.tabRiepilogo}</h2>
      <DashboardOperatorKpiGrid kpis={kpis} t={t} locale={locale} currency={currency} />

      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="flex flex-col gap-3 border-b border-slate-800/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
            <p className="text-sm text-slate-400">{t.bolle.noBills}</p>
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
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-800/40"
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

      {/* Operatore (mobile): azioni rapide in DashboardHubQuickActions — incluso «Ordina su Rekki» */}
      <DashboardHubQuickActions />
    </div>
  )
}
