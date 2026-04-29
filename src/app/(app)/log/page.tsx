import { redirect } from 'next/navigation'
import EmailLogTabs from '@/components/EmailLogTabs'
import EmailBlacklistPanel from '@/components/EmailBlacklistPanel'
import { LogActivityDocumentLink } from '@/components/LogActivityDocumentLink'
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
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TR,
} from '@/lib/app-shell-layout'
import { ActionLink } from '@/components/ui/ActionButton'
import type { Locale } from '@/lib/translations'
import {
  loadEmailActivityDayRows,
  countAutoSavedTodayFromRows,
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

export default async function LogPage() {
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

  const rows = await loadEmailActivityDayRows({
    user: supabase,
    service,
    timeZone: tz,
    sedeScopeId,
    masterSeesAllSedi,
  })

  const autoProcessedToday = countAutoSavedTodayFromRows(rows)

  let blacklistSedeId = profile?.sede_id ?? null
  if (!blacklistSedeId && profile?.role === 'admin') {
    const { data: firstSedeRow } = await supabase.from('sedi').select('id').limit(1).maybeSingle()
    blacklistSedeId = firstSedeRow?.id ?? null
  }

  const summaryLine = t.log.activitySummaryToday.replace(/\{n\}/g, String(autoProcessedToday))

  const logToolbar = (
    <>
      <p className={`min-w-0 flex-1 text-sm ${rows.length === 0 ? 'text-app-fg-muted' : 'text-app-fg'}`}>{summaryLine}</p>
      <ActionLink href="/inbox-ai" intent="nav" size="sm">
        {t.log.activityProcessDocumentsCta}
      </ActionLink>
    </>
  )

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

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="sky"
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

      <EmailLogTabs
        labels={{ log: t.log.tabEmailLog, blacklist: t.log.tabBlacklist }}
        blacklistPanel={
          blacklistSedeId ? (
            <div className="app-card overflow-hidden">
              <div className="app-card-bar" aria-hidden />
              <div className="min-w-0 flex-1 p-4 md:p-5">
                <EmailBlacklistPanel sedeId={blacklistSedeId} />
              </div>
            </div>
          ) : (
            <div className="app-card overflow-hidden">
              <div className="app-card-bar" aria-hidden />
              <div className="p-8 text-center text-sm text-app-fg-muted">{t.log.blacklistError}</div>
            </div>
          )
        }
        logPanel={
          <>
            {rows.length === 0 ? (
              <div className="app-card overflow-hidden">
                <div className="app-card-bar" aria-hidden />
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 md:px-5">
                  {logToolbar}
                </div>
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
                  <p className="mt-4 font-medium text-app-fg-muted">{t.log.activityEmpty}</p>
                </div>
              </div>
            ) : (
              <div className="app-card flex flex-col overflow-hidden">
                <div className="app-card-bar" aria-hidden />
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3 md:px-5">
                  {logToolbar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={APP_SECTION_MOBILE_LIST}>
                    {rows.map((row, idx) => (
                      <div key={`${row.atIso}-${idx}`} className="space-y-3 px-4 py-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-snug text-app-fg">{row.fornitoreNome}</p>
                            <p className="mt-0.5 text-[10px] text-app-fg-muted tabular-nums">
                              {new Date(row.atIso).toLocaleString(dateLocale, {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: tz,
                              })}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-app-fg-muted">{tipoLabelFromKey(t.log, row.tipoLabelKey)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs">
                          <span className="text-app-fg-muted">
                            {t.log.activityColAmount}: <span className="font-medium text-app-fg">{fmtAmount(row.importo)}</span>
                          </span>
                          <span className="text-app-fg-muted">{statusLabelFromKey(t.log, row)}</span>
                        </div>
                        {row.href || row.docOpen ? (
                          <LogActivityDocumentLink
                            label={t.log.activityOpenDocument}
                            href={row.href}
                            docOpen={row.docOpen}
                            variant="mobile"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="hidden min-w-0 md:block">
                    <table className="w-full table-fixed border-collapse text-left text-xs">
                      <thead>
                        <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                          <th className="min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.activityColSupplier}</th>
                          <th className="w-[12%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.activityColTipo}</th>
                          <th className="w-[14%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.activityColAmount}</th>
                          <th className="min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.activityColStatus}</th>
                          <th className="w-[18%] min-w-0 whitespace-nowrap px-2 py-2 font-semibold text-app-fg-muted sm:px-3">
                            {t.log.activityOpenDocument}
                          </th>
                        </tr>
                      </thead>
                      <tbody className={APP_SECTION_TABLE_TBODY}>
                        {rows.map((row, idx) => (
                          <tr key={`${row.atIso}-t-${idx}`} className={`align-top ${APP_SECTION_TABLE_TR}`}>
                            <td className="min-w-0 px-2 py-2 font-medium text-app-fg sm:px-3">{row.fornitoreNome}</td>
                            <td className="min-w-0 px-2 py-2 text-app-fg-muted sm:px-3">{tipoLabelFromKey(t.log, row.tipoLabelKey)}</td>
                            <td className="min-w-0 whitespace-nowrap px-2 py-2 tabular-nums text-app-fg sm:px-3">{fmtAmount(row.importo)}</td>
                            <td className="min-w-0 px-2 py-2 text-app-fg sm:px-3">{statusLabelFromKey(t.log, row)}</td>
                            <td className="min-w-0 px-2 py-2 sm:px-3">
                              <LogActivityDocumentLink
                                label={t.log.activityOpenDocument}
                                href={row.href}
                                docOpen={row.docOpen}
                                variant="table"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        }
      />
    </div>
  )
}
