import Link from 'next/link'
import { Suspense } from 'react'
import { createServiceClient } from '@/utils/supabase/server'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ScanEmailButton from '@/components/ScanEmailButton'
import CountrySelector from '@/components/CountrySelector'
import { LocaleCodeChip } from '@/components/ui/locale-code-chip'
import SedeAddOperatorForm from '@/components/SedeAddOperatorForm'
import { getLocale } from '@/lib/localization'
import { getT, getLocale as getAppLocale, getCurrency } from '@/lib/locale-server'
import { parseFiscalYearQueryParam } from '@/lib/fiscal-year'
import { fetchOperatorDashboardKpis, fornitoreIdsForSede } from '@/lib/dashboard-operator-kpis'
import DashboardOperatorKpiGrid, { DashboardOperatorKpiSkeleton } from '@/components/DashboardOperatorKpiGrid'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import DashboardFiscalYearHeaderSelect from '@/components/DashboardFiscalYearHeaderSelect'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'

interface SedeProfile {
  id: string
  nome: string
  imap_user: string | null
  imap_host: string | null
  country_code: string
  fornitori_count: number
  operators_count: number
}

async function fetchSedeProfile(sedeId: string): Promise<SedeProfile | null> {
  const service = createServiceClient()
  const { data: sede } = await service
    .from('sedi')
    .select('id, nome, imap_user, imap_host, country_code')
    .eq('id', sedeId)
    .single()

  if (!sede) return null

  const [{ count: fornitori_count }, { count: operators_count }] = await Promise.all([
    service.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId),
    service.from('profiles').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId),
  ])

  return {
    id: sede.id,
    nome: sede.nome,
    imap_user: sede.imap_user ?? null,
    imap_host: sede.imap_host ?? null,
    country_code: (sede as { country_code?: string }).country_code ?? 'UK',
    fornitori_count: fornitori_count ?? 0,
    operators_count: operators_count ?? 0,
  }
}

export default async function SedeProfilePage(props: {
  params: Promise<{ sede_id: string }>
  searchParams?: Promise<{ fy?: string }>
}) {
  const { supabase, user } = await getRequestAuth()
  if (!user) redirect('/login')

  const { sede_id } = await props.params
  const searchParams = await unwrapSearchParams(props.searchParams)
  const sede = await fetchSedeProfile(sede_id)
  if (!sede) redirect('/sedi')

  const profile = await getProfile()
  const isMasterAdmin = profile?.role === 'admin'
  const isAdminSede = profile?.role === 'admin_sede' && profile?.sede_id === sede_id
  const canManageSedeOperators = isMasterAdmin || isAdminSede

  const [tDashboard, appLocale, currency, fornitoreIds] = await Promise.all([
    getT(),
    getAppLocale(),
    getCurrency(),
    fornitoreIdsForSede(supabase, sede_id),
  ])
  const fiscalYear = parseFiscalYearQueryParam(searchParams.fy, sede.country_code)
  const sedeKpis = await fetchOperatorDashboardKpis(supabase, sede_id, fornitoreIds, {
    countryCode: sede.country_code,
    labelYear: fiscalYear,
  })

  const imapConfigured = !!(sede.imap_host && sede.imap_user)

  return (
    <div className="w-full min-w-0 app-shell-page-padding">
      <AppPageHeaderStrip
        dense
        accent="teal"
        leadingAccessory={
          <BackButton
            href={isMasterAdmin ? '/sedi' : '/'}
            label={isMasterAdmin ? tDashboard.nav.sediNavGroupMaster : tDashboard.nav.dashboard}
            iconOnly
            className="mb-0 shrink-0"
          />
        }
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-row flex-nowrap items-center gap-2 overflow-x-auto sm:gap-x-3">
                <h1 className="app-page-title min-w-0 flex-1 truncate text-lg font-bold leading-snug sm:text-xl md:text-2xl">{sede.nome}</h1>
                <Suspense fallback={null}>
                  <DashboardFiscalYearHeaderSelect countryCode={sede.country_code} selectedFiscalYear={fiscalYear} />
                </Suspense>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-sm text-app-fg-muted">
                  {sede.operators_count} operatore{sede.operators_count !== 1 ? 'i' : ''}
                </span>
                <span className="text-app-fg-muted">·</span>
                <span className="text-sm text-app-fg-muted">
                  {sede.fornitori_count} fornitore{sede.fornitori_count !== 1 ? 'i' : ''}
                </span>
                <span className="text-app-fg-muted">·</span>
                {imapConfigured ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Email configurata ({sede.imap_user})
                  </span>
                ) : (
                  <span className="rounded-full border border-[rgba(34,211,238,0.15)] bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                    Email non configurata
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
            <ScanEmailButton sedeId={sede_id} alwaysShowLabel />
          </div>
        </div>
      </AppPageHeaderStrip>

      {/* Paese / Localizzazione */}
      {(() => {
        const loc = getLocale(sede.country_code)
        return (
          <div className="app-card mb-6 flex flex-col overflow-hidden">
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex shrink-0 items-center gap-2 text-sm text-app-fg-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l18-9-18-9v7l12 2-12 2v7z" />
              </svg>
              Paese sede
            </div>
            <CountrySelector sedeId={sede.id} initialCode={sede.country_code} />
            <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-app-fg-muted">
              <span><span className="font-medium text-app-fg-muted">{loc.vat}</span> · etichetta imposta</span>
              <span><span className="font-medium text-app-fg-muted">{loc.vatLabel}</span> · n. partita {loc.vat}</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="font-medium text-app-fg-muted">{loc.currency}</span>
                <span>· valuta</span>
                <LocaleCodeChip code={sede.country_code} className="inline-flex h-5 min-w-[1.5rem] text-[9px]" />
              </span>
            </div>
            </div>
          </div>
        )
      })()}

      {canManageSedeOperators ? (
        <section id="sede-operatori" className="scroll-mt-24">
          <SedeAddOperatorForm sedeId={sede_id} />
        </section>
      ) : null}

      <Suspense fallback={<DashboardOperatorKpiSkeleton />}>
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-app-fg-muted">
            {tDashboard.fornitori.tabRiepilogo}
          </h2>
          <DashboardOperatorKpiGrid
            kpis={sedeKpis}
            t={tDashboard}
            locale={appLocale}
            currency={currency}
            fiscalYear={fiscalYear}
          />
        </div>
      </Suspense>

      {/* Quick-action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link
          href={`/sedi/${sede_id}/statements`}
          className="app-card group flex flex-col overflow-hidden transition-all hover:border-app-line-40"
        >
          <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-app-line-15 transition-colors group-hover:bg-app-line-25">
            <svg className="h-5 w-5 text-app-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-app-fg">Estratti Conto</p>
            <p className="mt-0.5 text-xs text-app-fg-muted">Associa fatture alle bolle</p>
          </div>
          <svg className="mt-auto h-4 w-4 self-end text-app-fg-muted transition-colors group-hover:text-app-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          </div>
        </Link>

        <Link
          href={`/sedi/${sede_id}/discovery`}
          className="app-card group flex flex-col overflow-hidden transition-all hover:border-[rgba(34,211,238,0.15)]"
        >
          <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 transition-colors group-hover:bg-emerald-500/25">
            <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-app-fg">Scopri Fornitori</p>
            <p className="mt-0.5 text-xs text-app-fg-muted">Trova mittenti sconosciuti</p>
          </div>
          <svg className="mt-auto h-4 w-4 self-end text-app-fg-muted transition-colors group-hover:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          </div>
        </Link>

        <Link
          href={`/sedi/${sede_id}/fornitori`}
          className="app-card group flex flex-col overflow-hidden transition-all hover:border-[rgba(34,211,238,0.15)]"
        >
          <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 transition-colors group-hover:bg-violet-500/25">
            <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-app-fg">Fornitori</p>
            <p className="mt-0.5 text-xs text-app-fg-muted">{sede.fornitori_count} registrati</p>
          </div>
          <svg className="mt-auto h-4 w-4 self-end text-app-fg-muted transition-colors group-hover:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          </div>
        </Link>
      </div>

      {/* IMAP not configured warning */}
      {!imapConfigured && (
        <div className="flex items-start gap-3 bg-amber-50 border border-[rgba(34,211,238,0.15)] rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Casella email non configurata</p>
            <p className="text-xs text-amber-700 mt-1">
              Per abilitare la scansione email per questa sede, configura le impostazioni IMAP in{' '}
              <Link href="/sedi" className="underline">Gestione Sedi</Link>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
