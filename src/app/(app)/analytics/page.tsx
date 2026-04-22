import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/utils/supabase/server'
import { getCookieStore, getT } from '@/lib/locale-server'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { parseFiscalYearQueryParam, formatFiscalYearShort } from '@/lib/fiscal-year'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ fy?: string; months?: string }>

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getProfile()
  if (!profile || !['admin', 'admin_sede'].includes(profile.role ?? '')) {
    redirect('/')
  }

  const [sp, cookieStore, t, supabase] = await Promise.all([
    searchParams,
    getCookieStore(),
    getT(),
    createClient(),
  ])

  const isMasterAdmin = profile.role === 'admin'
  const adminPick = isMasterAdmin
    ? (cookieStore.get('admin-sede-id')?.value?.trim() || null)
    : null
  const sedeId = adminPick ?? (profile.role !== 'admin' ? (profile.sede_id ?? null) : null)

  // Resolve country code to get correct default FY (UK vs IT/EU)
  let countryCode = 'IT'
  if (sedeId) {
    const { data } = await supabase.from('sedi').select('country_code').eq('id', sedeId).maybeSingle()
    countryCode = (data?.country_code ?? 'IT').trim() || 'IT'
  }

  const months = sp.months ? Math.min(24, Math.max(1, parseInt(sp.months, 10))) : 6
  // Always resolve a fiscal year (falls back to current FY for the country when ?fy is absent)
  const fiscalYear = parseFiscalYearQueryParam(sp.fy, countryCode)
  const fyLabel = formatFiscalYearShort(countryCode, fiscalYear)

  // Period button labels — always FY-anchored
  const periodLabels: Record<number, string> = {
    3: 'Q1',
    6: 'H1',
    12: fyLabel,
  }

  return (
    <div className="app-shell-page-padding">
      <AppPageHeaderStrip accent="sky">
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-app-fg truncate sm:text-lg">{t.nav.analytics}</h1>
            <p className="text-xs text-app-fg-muted truncate">{t.appStrings.analyticsPageSub}</p>
          </div>
          <DashboardFiscalYearHeaderForSede fyRaw={sp.fy} />
        </div>
      </AppPageHeaderStrip>

      {/* Period selector — sky accent card, matches AppPageHeaderStrip accent="sky" */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-sky-500/25 bg-transparent">
        <div className="h-0.5 w-full shrink-0 bg-gradient-to-r from-sky-500 via-sky-400 to-sky-600 [box-shadow:0_0_16px_rgba(14,165,233,0.6),0_0_28px_rgba(2,132,199,0.35)]" />
        <div className="flex items-center gap-1.5 px-4 py-3 sm:px-5">
          {[3, 6, 12].map((value) => (
            <a
              key={value}
              href={`/analytics?months=${value}&fy=${fiscalYear}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                months === value
                  ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'
                  : 'text-sky-300/50 hover:bg-sky-500/10 hover:text-sky-300/80'
              }`}
            >
              {periodLabels[value]}
            </a>
          ))}
          <span className="ml-2 text-[10px] font-medium text-sky-400/40 uppercase tracking-wider">
            da inizio FY
          </span>
        </div>
      </div>

      <AnalyticsDashboard sedeId={sedeId} months={months} fiscalYear={fiscalYear} />
    </div>
  )
}
