import Link from 'next/link'
import { cookies } from 'next/headers'
import { getRequestAuth } from '@/utils/supabase/server'
import DeleteButton from '@/components/DeleteButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import {
  SUMMARY_HIGHLIGHT_ACCENTS,
  SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS,
  SUMMARY_HIGHLIGHT_SURFACE_CLASS,
} from '@/lib/summary-highlight-accent'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'
import { resolveFiscalFilterForSede } from '@/lib/fiscal-year-page'
import { withFiscalYearQuery } from '@/lib/fiscal-link'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  APP_SHELL_SECTION_PAGE_CLASS,
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
  APP_SECTION_TRAILING_LINK_CLASS,
  APP_SECTION_TRAILING_SEP_CLASS,
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

  const bolleListTheme = SUMMARY_HIGHLIGHT_ACCENTS.indigo

  return (
    <div className={APP_SHELL_SECTION_PAGE_CLASS}>
      <AppPageHeaderStrip accent="indigo">
        <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
          <h1 className={APP_SHELL_SECTION_PAGE_H1_CLASS}>{t.bolle.title}</h1>
        </AppPageHeaderTitleWithDashboardShortcut>
        <DashboardFiscalYearHeaderForSede fyRaw={sp.fy} />
      </AppPageHeaderStrip>

      <AppSummaryHighlightCard
        accent="indigo"
        label={t.common.total}
        primary={bolle.length}
        secondary={subtitle}
        trailing={
          !showAll ? (
            <>
              <Link href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })} className={APP_SECTION_TRAILING_LINK_CLASS}>
                {t.bolle.listShowAll}
              </Link>
              <span className={APP_SECTION_TRAILING_SEP_CLASS} aria-hidden>
                ·
              </span>
              <Link
                href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1', pending: '1' })}
                className={APP_SECTION_TRAILING_LINK_CLASS}
              >
                {t.bolle.listAllPending}
              </Link>
            </>
          ) : pendingOnly ? (
            <>
              <Link href="/bolle" className={APP_SECTION_TRAILING_LINK_CLASS}>
                {t.bolle.listShowToday}
              </Link>
              <span className={APP_SECTION_TRAILING_SEP_CLASS} aria-hidden>
                ·
              </span>
              <Link href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1' })} className={APP_SECTION_TRAILING_LINK_CLASS}>
                {t.bolle.listShowAll}
              </Link>
            </>
          ) : (
            <>
              <Link href="/bolle" className={APP_SECTION_TRAILING_LINK_CLASS}>
                {t.bolle.listShowToday}
              </Link>
              <span className={APP_SECTION_TRAILING_SEP_CLASS} aria-hidden>
                ·
              </span>
              <Link
                href={withFiscalYearQuery('/bolle', fyForLinks, { tutte: '1', pending: '1' })}
                className={APP_SECTION_TRAILING_LINK_CLASS}
              >
                {t.bolle.listAllPending}
              </Link>
            </>
          )
        }
      />

      <div className={`${SUMMARY_HIGHLIGHT_SURFACE_CLASS} ${bolleListTheme.border}`}>
        <div className={`app-card-bar-accent ${bolleListTheme.bar}`} aria-hidden />
        <div className={SUMMARY_HIGHLIGHT_CARD_INNER_PADDING_CLASS}>
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
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                                />
                              </svg>
                            </span>
                          ) : null}
                          {b.stato === 'completato' ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                              {t.status.completato}
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              {t.status.inAttesa}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.file_url && (
                        <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {t.bolle.viewDocument}
                        </OpenDocumentInAppButton>
                      )}
                      {b.stato === 'in attesa' && (
                        <Link
                          href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
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
                        className={`whitespace-nowrap px-6 py-4 font-medium ${overdueInv ? 'text-amber-200' : 'text-app-fg-muted'}`}
                      >
                        <Link href={`/bolle/${b.id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {formatDate(b.data)}
                        </Link>
                      </td>
                      <td className="max-w-[10rem] px-6 py-4 font-mono text-sm text-app-fg-muted">
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
                      <td className={`px-6 py-4 font-medium ${overdueInv ? 'text-amber-100' : 'text-app-fg'}`}>
                        <Link href={`/bolle/${b.id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                          {supplierLabel || <span className="text-app-fg-muted">—</span>}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {overdueInv ? (
                            <span
                              className="inline-flex text-amber-400"
                              title={t.bolle.pendingInvoiceOverdueHint}
                              aria-label={t.bolle.pendingInvoiceOverdueHint}
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                                />
                              </svg>
                            </span>
                          ) : null}
                          {b.stato === 'completato' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                              {t.status.completato}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              {t.status.inAttesa}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {b.file_url && (
                            <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {t.bolle.viewDocument}
                            </OpenDocumentInAppButton>
                          )}
                          {b.stato === 'in attesa' && (
                            <Link
                              href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
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
        </div>
      </div>
    </div>
  )
}
