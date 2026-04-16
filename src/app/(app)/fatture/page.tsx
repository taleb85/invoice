import Link from 'next/link'
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
import DashboardDuplicateFattureButton from '@/components/DashboardDuplicateFattureButton'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { StandardCard } from '@/components/ui/StandardCard'
import {
  APP_SECTION_AMOUNT_POSITIVE_CLASS,
  APP_SHELL_SECTION_PAGE_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
  APP_SECTION_EMPTY_LINK_CLASS,
} from '@/lib/app-shell-layout'
import {
  analyzeFatturaDuplicatesForDeletion,
  serializeFatturaDuplicateDeletionPayload,
} from '@/lib/check-duplicates'
import FattureListWithDuplicates from '@/components/FattureListWithDuplicates'

type FatturaListRow = {
  id: string
  data: string
  numero_fattura: string | null
  file_url: string | null
  bolla_id: string | null
  fornitore_id: string | null
  importo: number | null
  fornitore: { nome: string } | null
}

async function getFatture(
  supabase: SupabaseClient,
  fornitoreIds: string[] | null,
  fiscalBounds: FiscalPgBounds | null,
): Promise<FatturaListRow[]> {
  let q = supabase
    .from('fatture')
    .select('id, data, numero_fattura, file_url, bolla_id, fornitore_id, importo, fornitore:fornitori(nome)')
    .order('data', { ascending: false })
  if (fornitoreIds?.length) q = q.in('fornitore_id', fornitoreIds)
  if (fiscalBounds) {
    q = q.gte('data', fiscalBounds.dateFrom).lt('data', fiscalBounds.dateToExclusive)
  }
  const { data } = await q
  /* Tipi Supabase sull’embed `fornitore` possono essere array in inference; a runtime è un oggetto. */
  return (data ?? []) as unknown as FatturaListRow[]
}

export default async function FatturePage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ fy?: string }>
}) {
  const searchParams = searchParamsPromise != null ? await searchParamsPromise : {}
  const [t, locale, tz, currency, cookieStore, profile, { supabase }] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getCurrency(),
    getCookieStore(),
    getProfile(),
    getRequestAuth(),
  ])

  const isMasterAdmin = profile?.role === 'admin'
  const adminPick = isMasterAdmin ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  let adminViewSedeId: string | null = null
  if (isMasterAdmin && adminPick) {
    const { data } = await supabase.from('sedi').select('id').eq('id', adminPick).maybeSingle()
    if (data?.id) adminViewSedeId = data.id
  }

  const sedeId = adminViewSedeId ?? profile?.sede_id ?? null
  const fornitoreIds = sedeId ? await fornitoreIdsForSede(supabase, sedeId) : []

  let fatture: FatturaListRow[] = []
  if (!sedeId && !isMasterAdmin) {
    fatture = []
  } else if (!sedeId && isMasterAdmin) {
    fatture = await getFatture(supabase, null, null)
  } else if (sedeId && fornitoreIds.length === 0) {
    fatture = []
  } else {
    const fiscal = await resolveFiscalFilterForSede(supabase, sedeId, searchParams.fy)
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
  }))
  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip accent="emerald">
        <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.fatture.title}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 md:gap-3">
          <DashboardDuplicateFattureButton alwaysShowLabel />
          <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
        </div>
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : null}

      <AppSummaryHighlightCard
        accent="emerald"
        label={t.common.total}
        primary={
          <span className={APP_SECTION_AMOUNT_POSITIVE_CLASS}>{formatCurrency(totaleImporto, currency, locale)}</span>
        }
        secondary={`${fatture.length} ${t.fatture.countLabel}`}
      />

      <StandardCard accent="emerald">
        {fatture.length === 0 ? (
          <AppSectionEmptyState message={t.fatture.noInvoices}>
            <Link href="/fatture/new" className={APP_SECTION_EMPTY_LINK_CLASS}>
              {t.fatture.addFirst}
            </Link>
          </AppSectionEmptyState>
        ) : (
          <FattureListWithDuplicates rows={fattureRowsClient} duplicatePayload={duplicatePayload} />
        )}
      </StandardCard>
    </div>
  )
}
