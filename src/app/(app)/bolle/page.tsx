import Link from 'next/link'
import { cookies } from 'next/headers'
import { AlertTriangle, Eye, Upload } from 'lucide-react'
import { getRequestAuth } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import AppSectionFiltersBar from '@/components/AppSectionFiltersBar'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import { StandardBadge } from '@/components/ui/StandardBadge'
import { StandardCard } from '@/components/ui/StandardCard'
import { standardLinkButtonClassName } from '@/components/ui/StandardButton'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
  APP_SHELL_SECTION_PAGE_H1_CLASS,
  APP_SECTION_EMPTY_LINK_CLASS,
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_MOBILE_ROW,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TR_GROUP,
  APP_SECTION_TABLE_TD,
} from '@/lib/app-shell-layout'
import { analyzeBolleDuplicatesForDeletion, serializeFatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'
import { DuplicateLedgerRowExtras } from '@/components/DuplicateLedgerRowExtras'

const BOLLE_LIST_LIMIT = 500

type BollaListRow = {
  id: string
  data: string
  stato: string
  file_url: string | null
  fornitore_id: string
  numero_bolla?: string | null
  fornitori?: { nome: string; display_name?: string | null } | null
}

/** YYYY-MM-DD for the user's calendar day in IANA timezone (matches Impostazioni fuso). */
function calendarDateInTimeZone(timeZone: string): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone })
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function daysBetweenIsoCalendarDates(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd.slice(0, 10)}T12:00:00`)
  const b = Date.parse(`${toYmd.slice(0, 10)}T12:00:00`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor((b - a) / 86_400_000)
}

async function getListSedeId(): Promise<string | null> {
  const { supabase, user } = await getRequestAuth()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const cookieStore = await cookies()
  if (profile?.role === 'admin') {
    return cookieStore.get('admin-sede-id')?.value?.trim() || null
  }
  return profile?.sede_id ?? null
}

async function getBolleForToday(timeZone: string, sedeId: string | null) {
  const today = calendarDateInTimeZone(timeZone)
  const { supabase } = await getRequestAuth()
  let q = supabase
    .from('bolle')
    .select('*, fornitori(nome, display_name)')
    .eq('data', today)
    .order('id', { ascending: false })
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
  const { data, error } = await q

  if (error) console.error('Errore caricamento bolle:', error.message)
  return data ?? []
}

async function getBolleAll(
  sedeId: string | null,
  pendingOnly: boolean,
  fiscalDataBounds: { dateFrom: string; dateToExclusive: string } | null,
) {
  const { supabase } = await getRequestAuth()
  let q = supabase
    .from('bolle')
    .select('*, fornitori(nome, display_name)')
    .order('data', { ascending: false })
    .order('id', { ascending: false })
    .limit(BOLLE_LIST_LIMIT)
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
  if (pendingOnly) q = q.eq('stato', 'in attesa') as typeof q
  if (fiscalDataBounds) {
    q = q
      .gte('data', fiscalDataBounds.dateFrom)
      .lt('data', fiscalDataBounds.dateToExclusive) as typeof q
  }
  const { data, error } = await q

  if (error) console.error('Errore caricamento bolle:', error.message)
  return data ?? []
}

export default async function BollePage({
  searchParams,
}: {
  searchParams?: Promise<{ tutte?: string; pending?: string; fy?: string }>
}) {
  const sp = searchParams ? await searchParams : {}
  const showAll = sp.tutte === '1' || sp.tutte === 'true'
  const pendingOnly = sp.pending === '1' || sp.pending === 'true'

  const [tz, t, locale, sedeId, { supabase }] = await Promise.all([
    getTimezone(),
    getT(),
    getLocale(),
    getListSedeId(),
    getRequestAuth(),
  ])
  const fiscal = sedeId ? await resolveFiscalFilterForSede(supabase, sedeId, sp.fy) : null
  const fyForLinks = fiscal?.labelYear
  const bolleRaw =
    showAll && sedeId
      ? await getBolleAll(sedeId, pendingOnly, fiscal?.bounds ?? null)
      : showAll
        ? await getBolleAll(sedeId, pendingOnly, null)
        : await getBolleForToday(tz, sedeId)
  const bolle = bolleRaw as BollaListRow[]
  const todayYmd = calendarDateInTimeZone(tz)
  const dupAnalysis = analyzeBolleDuplicatesForDeletion(
    bolle.map((b) => ({
      id: b.id,
      numero_bolla: b.numero_bolla ?? null,
      fornitore_id: b.fornitore_id,
      data: (b.data ?? '').trim().slice(0, 10),
    })),
  )
  const dupPayload = serializeFatturaDuplicateDeletionPayload(dupAnalysis)
  const excessBollaIds = dupAnalysis.excessIds
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  const subtitle = (() => {
    if (!showAll) {
      return `${bolle.length} ${bolle.length === 1 ? t.bolle.countTodaySingolo : t.bolle.countTodayPlural}`
    }
    if (pendingOnly) {
      return `${bolle.length} · ${t.dashboard.pendingBills}`
    }
    return `${bolle.length} ${bolle.length === 1 ? t.bolle.countSingolo : t.bolle.countPlural}`
  })()

  const emptyMessage = (() => {
    if (!showAll) return t.bolle.noBillsToday
    if (pendingOnly) return t.dashboard.kpiNoPendingBills
    return t.bolle.noBills
  })()

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip accent="indigo">
        <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.bolle.title}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={sp.fy} />
      </AppPageHeaderStrip>

      <AppSummaryHighlightCard accent="indigo" label={t.common.total} primary={bolle.length} secondary={subtitle} />

      <AppSectionFiltersBar>
        {!showAll ? (
          <>
            <Link
              href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })}
              className={standardLinkButtonClassName('secondary', 'sm')}
            >
              {t.bolle.listShowAll}
            </Link>
            <Link
              href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1', pending: '1' })}
              className={standardLinkButtonClassName('secondary', 'sm')}
            >
              {t.bolle.listAllPending}
            </Link>
          </>
        ) : pendingOnly ? (
          <>
            <Link href="/bolle" className={standardLinkButtonClassName('secondary', 'sm')}>
              {t.bolle.listShowToday}
            </Link>
            <Link href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })} className={standardLinkButtonClassName('secondary', 'sm')}>
              {t.bolle.listShowAll}
            </Link>
          </>
        ) : (
          <>
            <Link href="/bolle" className={standardLinkButtonClassName('secondary', 'sm')}>
              {t.bolle.listShowToday}
            </Link>
            <Link
              href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1', pending: '1' })}
              className={standardLinkButtonClassName('secondary', 'sm')}
            >
              {t.bolle.listAllPending}
            </Link>
          </>
        )}
      </AppSectionFiltersBar>

      <StandardCard accent="indigo">
          {bolle.length === 0 ? (
            <AppSectionEmptyState message={emptyMessage}>
              {!showAll ? (
                <Link href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })} className={APP_SECTION_EMPTY_LINK_CLASS}>
                  {t.bolle.listShowAll} →
                </Link>
              ) : null}
            </AppSectionEmptyState>
          ) : (
            <>
              <div className={APP_SECTION_MOBILE_LIST}>
                {bolle.map((b) => {
                  const supplierLabel = b.fornitori ? fornitoreDisplayLabel(b.fornitori) : ''
                  const overdueInv =
                    b.stato === 'in attesa' && daysBetweenIsoCalendarDates(b.data, todayYmd) > 7
                  return (
                  <div key={b.id} className={APP_SECTION_MOBILE_ROW}>
                    <Link href={`/bolle/${b.id}`} className="mb-3 block text-left transition-colors hover:opacity-90">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={`truncate font-semibold ${overdueInv ? 'text-amber-200' : 'text-app-fg'}`}
                          >
                            {supplierLabel || <span className="text-app-fg-muted">—</span>}
                          </p>
                          <p className={`mt-0.5 text-xs ${overdueInv ? 'text-amber-200/90' : 'text-app-fg-muted'}`}>
                            {formatDate(b.data)}
                          </p>
                          <p className="mt-1 text-[11px] text-app-fg-muted">
                            <span className="font-semibold uppercase tracking-wide text-app-fg-muted/90">
                              {t.bolle.colNumero}
                            </span>{' '}
                            <span className={`font-mono ${overdueInv ? 'text-amber-100' : 'text-app-fg'}`}>
                              {b.numero_bolla?.trim() || '—'}
                            </span>
                            <DuplicateLedgerRowExtras
                              rowId={b.id}
                              payload={dupPayload}
                              kind="bolla"
                              duplicateBadgeLabel={t.common.duplicateBadge}
                              duplicateDeleteConfirm={t.bolle.duplicateCopyDeleteConfirm}
                              removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                              deleteFailedPrefix={t.appStrings.deleteFailed}
                            />
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {overdueInv ? (
                            <span
                              className="inline-flex text-amber-400"
                              title={t.bolle.pendingInvoiceOverdueHint}
                              aria-label={t.bolle.pendingInvoiceOverdueHint}
                            >
                              <AlertTriangle className="h-4 w-4" aria-hidden strokeWidth={2} />
                            </span>
                          ) : null}
                          {b.stato === 'completato' ? (
                            <StandardBadge variant="success" dot="emerald" className="shrink-0 normal-case">
                              {t.status.completato}
                            </StandardBadge>
                          ) : (
                            <StandardBadge variant="pending" dot="amber" className="shrink-0 normal-case">
                              {t.status.inAttesa}
                            </StandardBadge>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.file_url && (
                        <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                          <Eye className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                          {t.bolle.viewDocument}
                        </OpenDocumentInAppButton>
                      )}
                      {b.stato === 'in attesa' && (
                        <Link
                          href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                          className={standardLinkButtonClassName('primary', 'sm')}
                        >
                          <Upload className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                          {t.bolle.uploadInvoice}
                        </Link>
                      )}
                      {!excessBollaIds.has(b.id) ? (
                        <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                      ) : null}
                    </div>
                  </div>
                  )
                })}
              </div>

              <table className="hidden w-full text-sm md:table">
                <thead>
                  <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.date}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.bolle.colNumero}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
                    <th className={APP_SECTION_TABLE_TH}>{t.common.status}</th>
                    <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {bolle.map((b) => {
                    const supplierLabel = b.fornitori ? fornitoreDisplayLabel(b.fornitori) : ''
                    const overdueInv =
                      b.stato === 'in attesa' && daysBetweenIsoCalendarDates(b.data, todayYmd) > 7
                    return (
                    <tr key={b.id} className={APP_SECTION_TABLE_TR_GROUP}>
                      <td
                        className={`${APP_SECTION_TABLE_TD} whitespace-nowrap font-medium ${overdueInv ? 'text-amber-200' : 'text-app-fg-muted'}`}
                      >
                        <Link href={`/bolle/${b.id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {formatDate(b.data)}
                        </Link>
                      </td>
                      <td className={`${APP_SECTION_TABLE_TD} max-w-[10rem] font-mono text-app-fg-muted`}>
                        <Link
                          href={`/bolle/${b.id}`}
                          className={`${APP_SECTION_TABLE_CELL_LINK} ${overdueInv ? 'text-amber-100' : ''}`}
                        >
                          {b.numero_bolla?.trim() || '—'}
                        </Link>
                        <DuplicateLedgerRowExtras
                          rowId={b.id}
                          payload={dupPayload}
                          kind="bolla"
                          duplicateBadgeLabel={t.common.duplicateBadge}
                          duplicateDeleteConfirm={t.bolle.duplicateCopyDeleteConfirm}
                          removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                          deleteFailedPrefix={t.appStrings.deleteFailed}
                        />
                      </td>
                      <td className={`${APP_SECTION_TABLE_TD} font-medium ${overdueInv ? 'text-amber-100' : 'text-app-fg'}`}>
                        <Link href={`/bolle/${b.id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {supplierLabel || <span className="text-app-fg-muted">—</span>}
                        </Link>
                      </td>
                      <td className={APP_SECTION_TABLE_TD}>
                        <div className="flex flex-wrap items-center gap-2">
                          {overdueInv ? (
                            <span
                              className="inline-flex text-amber-400"
                              title={t.bolle.pendingInvoiceOverdueHint}
                              aria-label={t.bolle.pendingInvoiceOverdueHint}
                            >
                              <AlertTriangle className="h-4 w-4" aria-hidden strokeWidth={2} />
                            </span>
                          ) : null}
                          {b.stato === 'completato' ? (
                            <StandardBadge variant="success" dot="emerald" className="normal-case">
                              {t.status.completato}
                            </StandardBadge>
                          ) : (
                            <StandardBadge variant="pending" dot="amber" className="normal-case">
                              {t.status.inAttesa}
                            </StandardBadge>
                          )}
                        </div>
                      </td>
                      <td className={APP_SECTION_TABLE_TD}>
                        <div className="flex items-center justify-end gap-2">
                          {b.file_url && (
                            <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                              <Eye className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                              {t.bolle.viewDocument}
                            </OpenDocumentInAppButton>
                          )}
                          {b.stato === 'in attesa' && (
                            <Link
                              href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                              className={standardLinkButtonClassName('primary', 'sm')}
                            >
                              <Upload className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                              {t.bolle.uploadInvoice}
                            </Link>
                          )}
                          {!excessBollaIds.has(b.id) ? (
                            <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
      </StandardCard>
    </div>
  )
}
