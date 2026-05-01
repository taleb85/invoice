import { redirect } from 'next/navigation'
import Link from 'next/link'
import EmailLogTabs from '@/components/EmailLogTabs'
import EmailBlacklistPanel from '@/components/EmailBlacklistPanel'
import {
  EmailActivityLogPanel,
  type LogRowView,
} from '@/components/EmailActivityLogPanel'
import { LogProcessDocumentsButton } from '@/components/LogProcessDocumentsButton'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import {
  getT,
  getLocale,
  getTimezone,
  getCurrency,
  getEffectiveSedeId,
  formatCurrency,
} from '@/lib/locale-server'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import type { Locale } from '@/lib/translations'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import {
  loadEmailActivityDayRowsPage,
  countEmailActivityAutoSavedToday,
  loadEmailActivityQueueProcessDocIdsPeek,
  type EmailActivityRow,
  type EmailActivityTipoKey,
} from '@/lib/email-activity-day'

function tipoLabelFromKey(
  t: Awaited<ReturnType<typeof getT>>['log'],
  k: EmailActivityTipoKey,
): string {
  switch (k) {
    case 'invoice':
      return t.activityTipoInvoice
    case 'ddt':
      return t.activityTipoDdt
    case 'statement':
      return t.activityTipoStatement
    case 'ordine':
      return t.activityTipoOrdine
    case 'resume':
      return t.activityTipoResume
    default:
      return t.activityTipoQueue
  }
}

function statusLabelFromKey(t: Awaited<ReturnType<typeof getT>>['log'], row: EmailActivityRow): string {
  switch (row.statusKey) {
    case 'saved':
      return t.activityStatusSaved
    case 'needs_supplier':
      return t.activityStatusNeedsSupplier
    case 'ignored':
      return t.activityStatusIgnored
    default:
      return ''
  }
}

export default async function LogPage(props: {
  searchParams?: Promise<{ p?: string | string[]; page?: string | string[] }>
}) {
  const profile = await getProfile()
  const isMasterAdmin = profile?.role === 'admin'
  const isAdminSede = profile?.role === 'admin_sede'
  if (!isMasterAdmin && !isAdminSede) redirect('/')

  const [t, locale, tz, currency, sedeScopeIdRaw] = await Promise.all([
    getT(),
    getLocale(),
    getTimezone(),
    getCurrency(),
    getEffectiveSedeId(profile?.sede_id ?? null, isMasterAdmin),
  ])
  const { supabase } = await getRequestAuth()
  const service = createServiceClient()

  const sedeScopeId = sedeScopeIdRaw
  const masterSeesAllSedi = isMasterAdmin && !sedeScopeId

  const sp = await unwrapSearchParams(props.searchParams)
  const rawP = sp.p ?? sp.page
  const rawStr = Array.isArray(rawP) ? rawP[0] : rawP
  const parsed = typeof rawStr === 'string' ? parseInt(rawStr, 10) : NaN
  const requestedPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1

  const loadOpts = {
    user: supabase,
    service,
    timeZone: tz,
    sedeScopeId,
    masterSeesAllSedi,
  }

  const [pageResult, autoProcessedToday, documentoIdsForProcess] = await Promise.all([
    loadEmailActivityDayRowsPage(loadOpts, requestedPage),
    countEmailActivityAutoSavedToday(loadOpts),
    loadEmailActivityQueueProcessDocIdsPeek(loadOpts),
  ])

  const { rows, queueTotal, page, pageCount } = pageResult

  const sedeForProcessApi = isMasterAdmin ? sedeScopeId : profile?.sede_id ?? null

  let blacklistSedeId = profile?.sede_id ?? null
  if (!blacklistSedeId && profile?.role === 'admin') {
    const { data: firstSedeRow } = await supabase.from('sedi').select('id').limit(1).maybeSingle()
    blacklistSedeId = firstSedeRow?.id ?? null
  }

  const summaryLine = t.log.activitySummaryToday.replace(/\{n\}/g, String(autoProcessedToday))

  const dateLocale =
    locale === 'it'
      ? 'it-IT'
      : locale === 'de'
        ? 'de-DE'
        : locale === 'fr'
          ? 'fr-FR'
          : locale === 'es'
            ? 'es-ES'
            : 'en-GB'

  const fmtAmount = (n: number | null) =>
    typeof n === 'number' && Number.isFinite(n) ? formatCurrency(n, currency, locale as Locale) : '—'

  const logRowViews: LogRowView[] = rows.map((row) => ({
    ...row,
    amountDisplay: fmtAmount(row.importo),
    timeDisplay: new Date(row.atIso).toLocaleString(dateLocale, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }),
    tipoDisplay: tipoLabelFromKey(t.log, row.tipoLabelKey),
    statusDisplay: statusLabelFromKey(t.log, row),
  }))

  const toolbarEmpty = (
    <>
      <p className={`min-w-0 flex-1 text-sm ${queueTotal === 0 ? 'text-app-fg-muted' : 'text-app-fg'}`}>{summaryLine}</p>
      <LogProcessDocumentsButton
        documentoIds={documentoIdsForProcess}
        sedeId={sedeForProcessApi}
        labels={{
          cta: t.log.activityProcessDocumentsCta,
          busy: t.log.activityProcessDocumentsBusy,
          noEligibleInLog: t.log.activityProcessDocumentsNoEligibleInLog,
          summary: t.log.activityProcessDocumentsSummary,
          apiError: t.log.activityProcessDocumentsApiError,
          toastDetail: t.log.activityProcessToastDetail,
          queueEmpty: t.log.activityQueueEmptyCelebrate,
        }}
      />
    </>
  )

  const tLogPanel = {
    activityColSupplier: t.log.activityColSupplier,
    activityPdfDetectedLine: t.log.activityPdfDetectedLine,
    activityColTipo: t.log.activityColTipo,
    activityColAmount: t.log.activityColAmount,
    activityColStatus: t.log.activityColStatus,
    activityColDocument: t.log.activityColDocument,
    activityOpenDocument: t.log.activityOpenDocument,
    activityProcessDocumentsCta: t.log.activityProcessDocumentsCta,
    activityProcessDocumentsBusy: t.log.activityProcessDocumentsBusy,
    activityProcessDocumentsNoEligibleInLog: t.log.activityProcessDocumentsNoEligibleInLog,
    activityProcessDocumentsApiError: t.log.activityProcessDocumentsApiError,
    activityProcessToastDetail: t.log.activityProcessToastDetail,
    activityQueueEmptyCelebrate: t.log.activityQueueEmptyCelebrate,
    activityProcessDocumentsSummary: t.log.activityProcessDocumentsSummary,
    activityInboxIgnoreSender: t.log.activityInboxIgnoreSender,
    activityInboxAddSupplier: t.log.activityInboxAddSupplier,
    activityInboxDiscard: t.log.activityInboxDiscard,
    activityDocDiscardedToast: t.log.activityDocDiscardedToast,
    activityNeedEmailOnRow: t.log.activityNeedEmailOnRow,
    activityIgnoreSenderDoneToast: t.log.activityIgnoreSenderDoneToast,
    activitySupplierAddedReprocessedToast: t.log.activitySupplierAddedReprocessedToast,
    blacklistError: t.log.blacklistError,
    activityLogRowActions: t.log.activityLogRowActions,
  }

  const procLabels = {
    column: t.log.activityProcColumn,
    spinAria: t.log.activityProcSpinAria,
    processedAuto: t.log.activityProcProcessedAuto,
    processedRevision: t.log.activityProcProcessedRevision,
    processedOther: t.log.activityProcProcessedOther,
    outcomeError: t.log.activityProcOutcomeError,
    skippedScartato: t.log.activityProcSkippedScartato,
    skippedNoRowOrSede: t.log.activityProcSkippedNoRowOrSede,
    skippedNoMittente: t.log.activityProcSkippedNoMittente,
    skippedNoSupplier: t.log.activityProcSkippedNoSupplier,
    skippedHasOcr: t.log.activityProcSkippedHasOcr,
    pendingBatch: t.log.activityProcPendingBatch,
    rejectedCv: t.log.activityProcRejectedCv,
    dash: t.log.activityProcDash,
  }

  const paginationStatusLine = t.log.activityQueuePaginationStatus
    .replace(/\{page\}/g, String(page))
    .replace(/\{pageCount\}/g, String(pageCount))
    .replace(/\{total\}/g, String(queueTotal))

  const logPagination =
    pageCount > 1 ? (
      <div className="flex flex-col items-stretch gap-3 border-t border-white/[0.08] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
        <p className="text-center text-xs text-app-fg-muted md:text-left">{paginationStatusLine}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {page > 1 ? (
            <Link
              href={page === 2 ? '/log' : `/log?p=${page - 1}`}
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg border border-app-line-28 bg-app-line-10 px-4 text-sm font-semibold text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg md:min-h-0"
            >
              {t.log.activityQueuePaginationPrev}
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center px-4 text-sm font-semibold text-app-fg-muted/40 md:min-h-0">
              {t.log.activityQueuePaginationPrev}
            </span>
          )}
          {page < pageCount ? (
            <Link
              href={`/log?p=${page + 1}`}
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-lg border border-app-line-28 bg-app-line-10 px-4 text-sm font-semibold text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg md:min-h-0"
            >
              {t.log.activityQueuePaginationNext}
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center px-4 text-sm font-semibold text-app-fg-muted/40 md:min-h-0">
              {t.log.activityQueuePaginationNext}
            </span>
          )}
        </div>
      </div>
    ) : null

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <EmailLogTabs
        stickyHeader={
          <AppPageHeaderStrip
            accent="sky"
            flushBottom
            leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            }
          >
            <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 flex-1 items-start gap-3">
              <h1 className={`pr-1 ${APP_PAGE_HEADER_STRIP_H1_CLASS}`}>{t.log.title}</h1>
              <p className="text-xs leading-tight text-app-fg-muted">{t.log.subtitle}</p>
            </AppPageHeaderTitleWithDashboardShortcut>
          </AppPageHeaderStrip>
        }
        labels={{ log: t.log.tabEmailLog, blacklist: t.log.tabBlacklist }}
        blacklistPanel={
          blacklistSedeId ? (
            <div className="app-card overflow-hidden">
              <div className="min-w-0 flex-1 p-4 md:p-5">
                <EmailBlacklistPanel sedeId={blacklistSedeId} />
              </div>
            </div>
          ) : (
            <div className="app-card overflow-hidden">
              <div className="p-8 text-center text-sm text-app-fg-muted">{t.log.blacklistError}</div>
            </div>
          )
        }
        logPanel={
          <>
            {queueTotal === 0 ? (
              <div className="app-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 md:px-5">{toolbarEmpty}</div>
                <div className="p-16 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-app-fg-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-4 font-medium text-app-fg-muted">
                    {autoProcessedToday > 0 ? t.log.activityEmptySavedHidden : t.log.activityEmpty}
                  </p>
                </div>
              </div>
            ) : (
              <EmailActivityLogPanel
                rows={logRowViews}
                summaryLine={summaryLine}
                documentoIds={documentoIdsForProcess}
                sedeId={sedeForProcessApi}
                blacklistSedeFallback={blacklistSedeId ?? sedeForProcessApi ?? profile?.sede_id ?? null}
                tLog={tLogPanel}
                procLabels={procLabels}
                paginationFooter={logPagination}
              />
            )}
          </>
        }
      />
    </div>
  )
}
