import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
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
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
} from '@/lib/summary-highlight-accent'
import {
  APP_SHELL_SECTION_PAGE_CLASS,
  APP_SHELL_SECTION_PAGE_H1_CLASS,
  APP_SECTION_EMPTY_LINK_CLASS,
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_MOBILE_ROW,
  APP_SECTION_ROW_ACTION_CHIP,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TR,
} from '@/lib/app-shell-layout'

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
  const totaleImporto = fatture.reduce((s, f) => s + (Number(f.importo) || 0), 0)
  const fattureTheme = SUMMARY_HIGHLIGHT_ACCENTS.emerald

  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      <AppPageHeaderStrip accent="emerald">
        <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.fatture.title}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
      </AppPageHeaderStrip>

      {!sedeId && !isMasterAdmin ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
          {t.dashboard.operatorNoSede}
        </div>
      ) : null}

      <AppSummaryHighlightCard
        accent="emerald"
        label={t.common.total}
        primary={formatCurrency(totaleImporto, currency, locale)}
        secondary={`${fatture.length} ${t.fatture.countLabel}`}
      />

      <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${fattureTheme.border}`}>
        <div className={`app-card-bar-accent ${fattureTheme.bar}`} aria-hidden />
        <div className={SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}>
        {fatture.length === 0 ? (
          <AppSectionEmptyState message={t.fatture.noInvoices}>
            <Link href="/fatture/new" className={APP_SECTION_EMPTY_LINK_CLASS}>
              {t.fatture.addFirst}
            </Link>
          </AppSectionEmptyState>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className={APP_SECTION_MOBILE_LIST}>
              {fatture.map((f) => (
                <div key={f.id} className={APP_SECTION_MOBILE_ROW}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    {f.fornitore_id ? (
                      <Link href={`/fornitori/${f.fornitore_id}`} className={`truncate ${APP_SECTION_TABLE_CELL_LINK}`}>
                        {f.fornitore?.nome ?? '—'}
                      </Link>
                    ) : (
                      <p className="truncate font-semibold text-app-fg">{f.fornitore?.nome ?? '—'}</p>
                    )}
                    <Link
                      href={`/fatture/${f.id}`}
                      className="shrink-0 text-xs text-app-fg-muted transition-colors hover:text-app-fg-muted"
                    >
                      {formatDate(f.data)}
                    </Link>
                  </div>
                  <p className="mb-2 text-xs text-app-fg-muted">
                    <span className="font-medium text-app-fg-muted">{t.fatture.colNumFattura}</span>{' '}
                    <span className="text-app-fg-muted">{f.numero_fattura?.trim() || '—'}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {f.bolla_id && (
                      <Link href={`/bolle/${f.bolla_id}`} className={APP_SECTION_ROW_ACTION_CHIP}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                        </svg>
                        {t.fatture.openBill}
                      </Link>
                    )}
                  </div>
                  {f.file_url && (
                    <div className="mt-2">
                      <OpenDocumentInAppButton fatturaId={f.id} fileUrl={f.file_url}>
                        {t.fatture.apri}
                      </OpenDocumentInAppButton>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                  <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.common.date}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.fatture.colNumFattura}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.fatture.headerBolla}</th>
                  <th className={APP_SECTION_TABLE_TH}>{t.fatture.headerAllegato}</th>
                  <th className={APP_SECTION_TABLE_TH} />
                </tr>
              </thead>
              <tbody className={APP_SECTION_TABLE_TBODY}>
                {fatture.map((f) => (
                  <tr key={f.id} className={APP_SECTION_TABLE_TR}>
                    <td className="px-6 py-4">
                      {f.fornitore_id ? (
                        <Link href={`/fornitori/${f.fornitore_id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {f.fornitore?.nome ?? '—'}
                        </Link>
                      ) : (
                        <Link href={`/fatture/${f.id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {f.fornitore?.nome ?? '—'}
                        </Link>
                      )}
                    </td>
                    <td className="px-6 py-4 text-app-fg-muted">{formatDate(f.data)}</td>
                    <td className="max-w-[12rem] px-6 py-4 text-app-fg-muted">
                      <span className="line-clamp-2 break-words" title={f.numero_fattura?.trim() || undefined}>
                        {f.numero_fattura?.trim() || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {f.bolla_id ? (
                        <Link href={`/bolle/${f.bolla_id}`} className={`text-xs ${APP_SECTION_TABLE_CELL_LINK} hover:underline`}>
                          {t.fatture.openBill}
                        </Link>
                      ) : (
                        <span className="text-xs text-app-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {f.file_url ? (
                        <OpenDocumentInAppButton fatturaId={f.id} fileUrl={f.file_url}>
                          {t.fatture.apri}
                        </OpenDocumentInAppButton>
                      ) : (
                        <span className="text-xs text-app-fg-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DeleteButton id={f.id} table="fatture" confirmMessage={t.fatture.deleteConfirm} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
