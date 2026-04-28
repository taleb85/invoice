import { redirect } from 'next/navigation'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import RetryButton from '@/components/RetryButton'
import DeleteButton from '@/components/DeleteButton'
import EmailLogTabs from '@/components/EmailLogTabs'
import EmailBlacklistPanel from '@/components/EmailBlacklistPanel'
import LogBlacklistIgnoreButton from '@/components/LogBlacklistIgnoreButton'
import LogSupplierAiSuggest from '@/components/LogSupplierAiSuggest'
import { getT, getLocale, getTimezone } from '@/lib/locale-server'
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

type LogStato = 'successo' | 'fornitore_non_trovato' | 'bolla_non_trovata' | 'fornitore_suggerito'

interface LogEntry {
  id: string
  data: string
  mittente: string
  oggetto_mail: string | null
  /** Valori storici/aggiunte lato DB possono non essere nell’insieme tipo. */
  stato: LogStato | string
  errore_dettaglio: string | null
  fornitore_id: string | null
  file_url: string | null
  sede_id: string | null
  allegato_nome: string | null
  sedi?: { nome: string } | { nome: string }[] | null
}

function logAttachmentLabel(fileUrl: string | null, allegatoNome: string | null): string {
  if (allegatoNome?.trim()) return allegatoNome.trim()
  if (!fileUrl) return ''
  try {
    const path = new URL(fileUrl).pathname
    const seg = path.split('/').filter(Boolean).pop()
    return seg || ''
  } catch {
    return ''
  }
}

function sedeNomeFromLog(log: LogEntry): string | null {
  const s = log.sedi
  if (!s) return null
  const row = Array.isArray(s) ? s[0] : s
  return row?.nome?.trim() || null
}

const LOG_ACTION_DELETE_BUTTON_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-500/35 bg-red-950/45 p-0 text-red-200 transition-colors hover:border-red-400/45 hover:bg-red-950/65'

export default async function LogPage() {
  const profile = await getProfile()
  const isMasterAdmin = profile?.role === 'admin'
  const isAdminSede = profile?.role === 'admin_sede'
  if (!isMasterAdmin && !isAdminSede) redirect('/')

  const { supabase } = await getRequestAuth()
  const [t, locale, tz] = await Promise.all([getT(), getLocale(), getTimezone()])

  const STATO_CONFIG: Record<LogStato, { label: string; className: string }> = {
    successo: {
      label: t.log.success,
      className: 'bg-green-500/15 text-green-300 ring-1 ring-green-500/35',
    },
    bolla_non_trovata: {
      label: t.log.bollaNotFound,
      className: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/35',
    },
    fornitore_non_trovato: {
      label: t.log.supplierNotFound,
      className: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/35',
    },
    fornitore_suggerito: {
      label: t.log.supplierSuggested,
      className: 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/35',
    },
  }

  const badgeForStato = (stato: string): { label: string; className: string } => {
    const known = STATO_CONFIG[stato as LogStato]
    if (known) return known
    return {
      label: stato?.trim() || '—',
      className: 'bg-white/10 text-app-fg-muted ring-1 ring-white/15',
    }
  }

  let logQuery = supabase
    .from('log_sincronizzazione')
    .select('*, sedi ( nome )')
    .order('data', { ascending: false })
    .limit(200)

  if (isAdminSede && profile?.sede_id) {
    logQuery = logQuery.eq('sede_id', profile.sede_id) as typeof logQuery
  }

  const { data: logs } = await logQuery

  const entries: LogEntry[] = (logs ?? []) as LogEntry[]

  let blacklistSedeId = profile?.sede_id ?? null
  if (!blacklistSedeId && profile?.role === 'admin') {
    const { data: firstSedeRow } = await supabase.from('sedi').select('id').limit(1).maybeSingle()
    blacklistSedeId = firstSedeRow?.id ?? null
  }

  const totaleErrori = entries.filter((l) => l.stato === 'fornitore_non_trovato').length
  const totaleSuccessi = entries.filter(
    (l) =>
      l.stato === 'successo' ||
      l.stato === 'bolla_non_trovata' ||
      l.stato === 'fornitore_suggerito'
  ).length

  const dateLocale =
    locale === 'it' ? 'it-IT' : locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-GB'

  const formatDate = (d: string) =>
    new Date(d).toLocaleString(dateLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    })

  const sedeForBlacklistIgnore = (log: LogEntry) =>
    log.sede_id ?? profile?.sede_id ?? blacklistSedeId

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="sky"
        mergedSummary={{
          label: t.log.totalLogs,
          primary: entries.length,
          secondary: (
            <>
              {t.log.linkedInvoices}: {totaleSuccessi}
              <span className="mx-1.5 text-app-fg-muted" aria-hidden>
                ·
              </span>
              {t.log.withErrors}: {totaleErrori}
            </>
          ),
        }}
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 flex-1 items-start gap-3">
          <h1 className={`pr-1 ${APP_PAGE_HEADER_STRIP_H1_CLASS}`}>{t.log.title}</h1>
          <p className="text-xs leading-tight text-app-fg-muted">{t.log.subtitle}</p>
        </AppPageHeaderTitleWithDashboardShortcut>
      </AppPageHeaderStrip>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mb-8 md:gap-4">
        {/* Total Logs */}
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent">
          <div className="h-0.5 shrink-0 bg-gradient-to-r from-teal-500 via-teal-400 to-teal-700" />
          <div className="p-4 md:p-5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-xl font-bold tabular-nums text-app-fg md:text-2xl">{entries.length}</p>
              <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-app-fg-muted md:text-xs">{t.log.totalLogs}</p>
            </div>
          </div>
        </div>
        {/* Documents Received */}
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent">
          <div className="h-0.5 shrink-0 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-700" />
          <div className="p-4 md:p-5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-xl font-bold tabular-nums text-emerald-300 md:text-2xl">{totaleSuccessi}</p>
              <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-emerald-400/90 md:text-xs">{t.log.linkedInvoices}</p>
            </div>
          </div>
        </div>
        {/* With Errors */}
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(34,211,238,0.15)] bg-transparent">
          <div className="h-0.5 shrink-0 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-700" />
          <div className="p-4 md:p-5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-xl font-bold tabular-nums text-red-300 md:text-2xl">{totaleErrori}</p>
              <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-red-400/90 md:text-xs">{t.log.withErrors}</p>
            </div>
          </div>
        </div>
      </div>

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
      {entries.length === 0 ? (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="p-16 text-center">
            <svg className="mx-auto h-12 w-12 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 font-medium text-app-fg-muted">{t.log.noLogs}</p>
            <p className="text-sm text-app-fg-muted">{t.log.emptyHint}</p>
          </div>
        </div>
      ) : (
        <div className="app-card flex flex-col overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className={APP_SECTION_MOBILE_LIST}>
              {entries.map((log) => {
                const cfg = badgeForStato(log.stato)
                const attach = logAttachmentLabel(log.file_url, log.allegato_nome)
                const unknownHighlight = log.stato === 'fornitore_non_trovato'
                return (
                  <div
                    key={log.id}
                    className={`space-y-2 px-4 py-4 ${unknownHighlight ? 'bg-red-950/25 ring-1 ring-inset ring-red-500/20' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="whitespace-nowrap text-[11px] text-app-fg-muted">{formatDate(log.data)}</span>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-app-fg-muted">{t.log.colLogId}: {log.id.slice(0, 8)}…</p>
                    <p className="truncate text-sm font-semibold text-app-fg">{log.mittente}</p>
                    {log.oggetto_mail && <p className="truncate text-xs text-app-fg-muted">{log.oggetto_mail}</p>}
                    {attach && <p className="truncate text-xs font-medium text-app-fg-muted">{t.log.colAttachment}: {attach}</p>}
                    {sedeNomeFromLog(log) && (
                      <p className="text-[11px] text-app-fg-muted">
                        {t.log.colSede}: {sedeNomeFromLog(log)}
                      </p>
                    )}
                    {log.errore_dettaglio && (
                      <p
                        className={`line-clamp-3 text-[11px] leading-snug ${
                          log.stato === 'fornitore_suggerito' ? 'text-violet-300' : 'text-red-400'
                        }`}
                      >
                        {log.errore_dettaglio}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {log.file_url && (
                        <OpenDocumentInAppButton
                          logId={log.id}
                          fileUrl={log.file_url}
                          className="text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                        >
                          {t.log.vediFile}
                        </OpenDocumentInAppButton>
                      )}
                      {isMasterAdmin && log.stato === 'fornitore_non_trovato' && log.file_url && (
                        <LogSupplierAiSuggest
                          logId={log.id}
                          fileUrl={log.file_url}
                          mittente={log.mittente}
                          sedeId={log.sede_id}
                        />
                      )}
                      {(log.stato === 'bolla_non_trovata' || log.stato === 'fornitore_non_trovato') && log.file_url && (
                        <RetryButton logId={log.id} />
                      )}
                      {log.stato === 'fornitore_non_trovato' && (
                        <LogBlacklistIgnoreButton mittente={log.mittente} sedeId={sedeForBlacklistIgnore(log)} />
                      )}
                      <DeleteButton
                        id={log.id}
                        table="log_sincronizzazione"
                        confirmMessage={t.appStrings.deleteLogConfirm}
                        iconOnly
                        className={LOG_ACTION_DELETE_BUTTON_CLASS}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden min-w-0 md:block">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                    <th className="w-[6%] min-w-0 whitespace-nowrap px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.colLogId}</th>
                    <th className="w-[10%] min-w-0 whitespace-nowrap px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.common.date}</th>
                    <th className="w-[9%] min-w-0 whitespace-nowrap px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.colSede}</th>
                    <th className="w-[14%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.sender}</th>
                    <th className="w-[16%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.subject}</th>
                    <th className="w-[12%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.log.colAttachment}</th>
                    <th className="w-[9%] min-w-0 whitespace-nowrap px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.common.status}</th>
                    <th className="w-[16%] min-w-0 px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.common.detail}</th>
                    <th className="w-[8%] min-w-0 whitespace-nowrap px-2 py-2 font-semibold text-app-fg-muted sm:px-3">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {entries.map((log) => {
                    const cfg = badgeForStato(log.stato)
                    const attach = logAttachmentLabel(log.file_url, log.allegato_nome)
                    const unknownHighlight = log.stato === 'fornitore_non_trovato'
                    return (
                      <tr
                        key={log.id}
                        className={`align-top ${APP_SECTION_TABLE_TR} ${
                          unknownHighlight ? 'bg-red-950/20' : ''
                        }`}
                      >
                        <td className="min-w-0 whitespace-nowrap px-2 py-2 font-mono text-[10px] text-app-fg-muted sm:px-3">{log.id.slice(0, 8)}</td>
                        <td className="min-w-0 whitespace-nowrap px-2 py-2 text-app-fg-muted sm:px-3">{formatDate(log.data)}</td>
                        <td className="min-w-0 truncate px-2 py-2 text-app-fg-muted sm:px-3" title={sedeNomeFromLog(log) ?? ''}>
                          {sedeNomeFromLog(log) ?? '—'}
                        </td>
                        <td className="min-w-0 truncate px-2 py-2 font-medium text-app-fg sm:px-3" title={log.mittente}>
                          {log.mittente}
                        </td>
                        <td className="min-w-0 truncate px-2 py-2 text-app-fg-muted sm:px-3" title={log.oggetto_mail ?? ''}>
                          {log.oggetto_mail ?? <span className="italic text-app-fg-muted">—</span>}
                        </td>
                        <td className="min-w-0 truncate px-2 py-2 font-mono text-[11px] text-app-fg-muted sm:px-3" title={attach}>
                          {attach || <span className="italic text-app-fg-muted">—</span>}
                        </td>
                        <td className="min-w-0 px-2 py-2 sm:px-3">
                          <span className={`inline-flex max-w-full truncate items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="min-w-0 overflow-hidden px-2 py-2 text-[11px] leading-snug text-app-fg-muted sm:px-3">
                          {log.errore_dettaglio ? (
                            <span className="line-clamp-4 break-words" title={log.errore_dettaglio}>
                              {log.errore_dettaglio}
                            </span>
                          ) : log.file_url ? (
                            <OpenDocumentInAppButton
                              logId={log.id}
                              fileUrl={log.file_url}
                              className="border-0 bg-transparent p-0 text-left font-inherit text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                            >
                              {t.log.vediFile}
                            </OpenDocumentInAppButton>
                          ) : (
                            <span className="italic text-app-fg-muted">—</span>
                          )}
                        </td>
                        <td className="min-w-0 px-2 py-2 sm:px-3">
                          <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1">
                            {isMasterAdmin && log.stato === 'fornitore_non_trovato' && log.file_url && (
                              <LogSupplierAiSuggest
                                logId={log.id}
                                fileUrl={log.file_url}
                                mittente={log.mittente}
                                sedeId={log.sede_id}
                              />
                            )}
                            {(log.stato === 'bolla_non_trovata' || log.stato === 'fornitore_non_trovato') && log.file_url && (
                              <RetryButton logId={log.id} />
                            )}
                            {log.stato === 'fornitore_non_trovato' && (
                              <LogBlacklistIgnoreButton mittente={log.mittente} sedeId={sedeForBlacklistIgnore(log)} />
                            )}
                            <DeleteButton
                              id={log.id}
                              table="log_sincronizzazione"
                              confirmMessage={t.appStrings.deleteLogConfirm}
                              iconOnly
                              className={LOG_ACTION_DELETE_BUTTON_CLASS}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
