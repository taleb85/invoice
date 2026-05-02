import type { SupabaseClient } from '@supabase/supabase-js'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import {
  getT,
  getLocale,
  getTimezone,
  getCurrency,
  getCookieStore,
  formatDate as fmtDate,
} from '@/lib/locale-server'
import { fornitoreIdsForSede } from '@/lib/dashboard-operator-kpis'
import { resolveFiscalFilterForSede, type FiscalPgBounds } from '@/lib/fiscal-year-page'
import { formatCurrency } from '@/lib/locale-shared'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import DashboardDuplicateFattureButton from '@/components/DashboardDuplicateFattureButton'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  APP_SECTION_AMOUNT_POSITIVE_CLASS,
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import {
  analyzeFatturaDuplicatesForDeletion,
  serializeFatturaDuplicateDeletionPayload,
} from '@/lib/check-duplicates'
import FattureListWithDuplicates from '@/components/FattureListWithDuplicates'
import { ActionLink } from '@/components/ui/ActionButton'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ExportButton } from '@/components/export-button'
import type { ExportRow } from '@/lib/export-report'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'

type FatturaListRow = {
  id: string
  data: string
  numero_fattura: string | null
  file_url: string | null
  bolla_id: string | null
  fornitore_id: string | null
  importo: number | null
  fornitore: { nome: string } | null
  approval_status: string | null
  rejection_reason: string | null
  email_sync_auto_saved_at: string | null
}

async function getFatture(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<FatturaListRow[]> {
  let q = supabase
    .from('fatture')
    .select('id, data, numero_fattura, file_url, bolla_id, fornitore_id, importo, fornitore:fornitori(nome), approval_status, rejection_reason, email_sync_auto_saved_at')
    .order('data', { ascending: false })
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  if (fiscalBounds) {
    q = q.gte('data', fiscalBounds.dateFrom).lt('data', fiscalBounds.dateToExclusive)
  }
  const { data } = await q
  /* Tipi Supabase sull’embed `fornitore` possono essere array in inference; a runtime è un oggetto. */
  return (data ?? []) as unknown as FatturaListRow[]
}

export default async function FatturePage(props: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams = await unwrapSearchParams(props.searchParams)
  const [t, locale, tz, currency, cookieStore, profile, { supabase }] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getCurrency(),
    getCookieStore(),
    getProfile(),
    getRequestAuth(),
  ])

  const isMasterAdmin = isMasterAdminRole(profile?.role)
  const sedeId = await resolveActiveSedeIdForLists(supabase, profile, (n) => cookieStore.get(n))
  const fornitoreIds = sedeId ? await fornitoreIdsForSede(supabase, sedeId) : []

  let fatture: FatturaListRow[] = []
  let fiscal: Awaited<ReturnType<typeof resolveFiscalFilterForSede>> | null = null
  if (!sedeId && !isMasterAdmin) {
    fatture = []
  } else if (!sedeId && isMasterAdmin) {
    fatture = await getFatture(supabase, null, null)
  } else if (sedeId && fornitoreIds.length === 0) {
    fatture = []
  } else {
    fiscal = await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy)
    fatture = await getFatture(supabase, fornitoreIds, fiscal?.bounds ?? null)
  }
  const formatDate = (d: string) => fmtDate(d, locale, tz)
  const dupDel = analyzeFatturaDuplicatesForDeletion(
    fatture.map((f) => ({
      id: f.id,
      numero_fattura: f.numero_fattura,
      fornitore_id: f.fornitore_id ?? '',
      importo: f.importo,
      data: f.data,
    })),
  )
  const totaleImportoRaw = fatture.reduce((s, f) => s + (Number(f.importo) || 0), 0)
  const totaleImporto = Math.max(0, totaleImportoRaw - dupDel.surplusImporto)
  const duplicatePayload = serializeFatturaDuplicateDeletionPayload(dupDel)
  const fattureMergedSummary = {
    label: t.common.total,
    primary: (
      <span className={APP_SECTION_AMOUNT_POSITIVE_CLASS}>{formatCurrency(totaleImporto, currency, locale)}</span>
    ),
    secondary: `${fatture.length} ${t.fatture.countLabel}`,
  }

  const exportPeriod = String(fiscal?.labelYear ?? searchParams.fy ?? new Date().getFullYear())
  const exportRows: ExportRow[] = fatture.map(f => ({
    data: f.data,
    numero: f.numero_fattura,
    fornitore: f.fornitore?.nome ?? '—',
    importo: f.importo,
    stato: f.bolla_id ? 'Associata' : 'Senza bolla',
    sede: null,
  }))

  const showApprovalBadge = isMasterAdmin || isBranchSedeStaffRole(profile?.role)

  const fattureRowsClient = fatture.map((f) => ({
    id: f.id,
    dataLabel: formatDate(f.data),
    numero_fattura: f.numero_fattura,
    file_url: f.file_url,
    bolla_id: f.bolla_id,
    fornitore_id: f.fornitore_id,
    fornitoreNome: f.fornitore?.nome ?? null,
    importoLabel:
      f.importo != null && Number.isFinite(Number(f.importo))
        ? formatCurrency(Number(f.importo), currency, locale)
        : null,
    approval_status: showApprovalBadge ? (f.approval_status ?? null) : null,
    rejection_reason: showApprovalBadge ? (f.rejection_reason ?? null) : null,
    email_sync_auto_saved_at: f.email_sync_auto_saved_at ?? null,
  }))
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="emerald"
        mergedSummary={fattureMergedSummary}
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.fatture.title}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 md:gap-3">
          <DashboardDuplicateFattureButton alwaysShowLabel />
          <ExportButton rows={exportRows} type="fatture" period={exportPeriod} />
          <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
        </div>
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : null}

      <div className="min-w-0">
        {fatture.length === 0 ? (
          <AppSectionEmptyState message={t.fatture.noInvoices}>
            <ActionLink href="/fatture/new" intent="confirm" size="sm" className="mt-4">
              {t.fatture.addFirst}
            </ActionLink>
          </AppSectionEmptyState>
        ) : (
          <ErrorBoundary sectionName="lista fatture">
            <FattureListWithDuplicates rows={fattureRowsClient} duplicatePayload={duplicatePayload} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
