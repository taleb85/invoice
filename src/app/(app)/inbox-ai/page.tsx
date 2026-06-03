import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getCookieStore, getT } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import InboxAiClient from './inbox-ai-client'
import { BackButton } from '@/components/BackButton'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import { isMasterAdminRole } from '@/lib/roles'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import {
  DEFAULT_OPERATOR_DASHBOARD_KPIS,
  fetchOperatorDashboardKpis,
  fornitoreIdsForSede,
} from '@/lib/dashboard-operator-kpis'
import { buildInboxOperationalHubItems } from '@/lib/inbox-operational-hub'

export const dynamic = 'force-dynamic'

export default async function InboxAiPage(props: {
  searchParams?: Promise<{ fy?: string; tab?: string; dup?: string }>
}) {
  const searchParams = await unwrapSearchParams(props.searchParams)
  const [cookieStore, profile, { supabase }, t] = await Promise.all([
    getCookieStore(),
    getProfile(),
    getRequestAuth(),
    getT(),
  ])

  const isMasterAdmin = isMasterAdminRole(profile?.role)
  const sedeId = await resolveActiveSedeIdForLists(
    supabase,
    profile ? { role: profile.role, sede_id: profile.sede_id } : undefined,
    (n) => cookieStore.get(n),
  )
  const blockedNoSede = !isMasterAdmin && !sedeId
  const fiscal = sedeId ? await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy) : null
  const fy = fiscal?.labelYear

  let kpis = DEFAULT_OPERATOR_DASHBOARD_KPIS
  let emailQueueCount = 0
  const hubVisible = !!(sedeId || isMasterAdmin)
  if (hubVisible) {
    try {
      if (sedeId) {
        const fornitoreIds = await fornitoreIdsForSede(supabase, sedeId)
        kpis = await fetchOperatorDashboardKpis(
          supabase,
          sedeId,
          fornitoreIds,
          fiscal ? { countryCode: fiscal.countryCode, labelYear: fiscal.labelYear } : null,
        )
        const { count } = await supabase
          .from('documenti_da_processare')
          .select('*', { count: 'exact', head: true })
          .eq('sede_id', sedeId)
          .in('stato', ['da_associare', 'da_revisionare'])
        emailQueueCount = count ?? 0
      } else {
        kpis = await fetchOperatorDashboardKpis(supabase, null, undefined, null)
      }
    } catch (e) {
      console.error('[InboxAiPage] KPI fetch', e)
    }
  }

  const hubItems = hubVisible
    ? buildInboxOperationalHubItems({
        fy,
        kpis,
        emailQueueCount,
        labels: {
          emailQueue: t.dashboard.inboxHubEmailQueue,
          docQueue: t.dashboard.inboxUrgenteNavDocQueue,
          priceAnomalies: t.dashboard.inboxUrgenteNavPriceAnomalies,
          dupInvoices: t.dashboard.inboxUrgenteNavInvoices,
          dupBolle: t.dashboard.inboxUrgenteNavBolle,
          dupOrdini: t.dashboard.inboxUrgenteNavOrdini,
        },
      })
    : []

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.dashboard.inboxAiPageTitle}</h1>
          <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} max-w-xl`}>
            {t.dashboard.inboxAiPageSubtitle}
          </p>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="flex min-h-14 min-w-0 shrink-0 flex-col justify-end gap-3 sm:flex-row sm:items-end sm:justify-end">
          <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
        </div>
      </AppPageHeaderStrip>

      <InboxAiClient
        sedeId={sedeId}
        blockedNoSede={Boolean(blockedNoSede)}
        initialTab={searchParams.tab ?? null}
        initialDup={searchParams.dup ?? null}
        fiscalYear={fy ?? null}
        hubItems={hubItems}
        hubIntro={t.dashboard.inboxUrgentePageIntro}
        hubEmptyMessage={t.dashboard.inboxHubEmptyAll}
        hubAdvancedLabel={t.dashboard.inboxHubAdvancedControlCentre}
        hubAdvancedHint={t.dashboard.inboxHubAdvancedHint}
      />
    </div>
  )
}
