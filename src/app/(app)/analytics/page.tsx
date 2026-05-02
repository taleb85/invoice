import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/utils/supabase/server'
import { getCookieStore, getT } from '@/lib/locale-server'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard'
import { AnalyticsPeriodStrip } from '@/components/analytics/analytics-period-strip'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import { parseFiscalYearQueryParam, formatFiscalYearShort } from '@/lib/fiscal-year'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { isSedePrivilegedRole } from '@/lib/roles'
import { resolveOperationalSedeIdForAdminPortal } from '@/lib/admin-portal-operational-sede'

export const dynamic = 'force-dynamic'

type SearchParamsShape = { fy?: string; months?: string }

export default async function AnalyticsPage(props: { searchParams: Promise<SearchParamsShape> }) {
  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    redirect('/')
  }

  const [sp, cookieStore, t, supabase] = await Promise.all([
    unwrapSearchParams(props.searchParams),
    getCookieStore(),
    getT(),
    createClient(),
  ])

  const sedeId = await resolveOperationalSedeIdForAdminPortal(supabase, profile, (n) =>
    cookieStore.get(n),
  )

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

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="teal"
        leadingAccessory={
          <BackButton
            href="/"
            label={t.nav.dashboard}
            iconOnly
            className="mb-0 shrink-0"
          />
        }
        icon={<svg className="h-11 w-11 sm:h-12 sm:w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.nav.analytics}</h1>
          <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} lg:max-w-4xl`}>{t.appStrings.analyticsPageSub}</p>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={sp.fy} />
      </AppPageHeaderStrip>

      <div className="mb-5">
        <AnalyticsPeriodStrip
          basePath="/analytics"
          fiscalYear={fiscalYear}
          months={months}
          fyLabel={fyLabel}
        />
      </div>

      <AnalyticsDashboard sedeId={sedeId} months={months} fiscalYear={fiscalYear} />
    </div>
  )
}
