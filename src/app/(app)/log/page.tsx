import { redirect } from 'next/navigation'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import RetryButton from '@/components/RetryButton'
import DeleteButton from '@/components/DeleteButton'
import LogSupplierAiSuggest from '@/components/LogSupplierAiSuggest'
import { getT, getLocale, getTimezone } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import {
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
  stato: LogStato
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

  return (
    <div className="app-shell-page-padding">
      <AppPageHeaderStrip accent="teal" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}>
        <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 flex-1 items-start gap-3">
          <h1 className="app-page-title pr-1 text-2xl font-bold">{t.log.title}</h1>
          <p className="mt-1 text-xs leading-snug text-app-fg-muted">{t.log.subtitle}</p>
        </AppPageHeaderTitleWithDashboardShortcut>
      </AppPageHeaderStrip>

      <AppSummaryHighlightCard
        accent="teal"
        label={t.log.totalLogs}
        primary={entries.length}
        secondary={
          <>
            {t.log.linkedInvoices}: {totaleSuccessi}
            <span className="mx-1.5 text-app-fg-muted" aria-hidden>
              ·
            </span>
            {t.log.withErrors}: {totaleErrori}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mb-8 md:gap-4">
        {/* Total Logs */}
        <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-transparent">
          <div className="h-0.5 shrink-0 bg-gradient-to-r from-teal-500 via-teal-400 to-teal-700" />
          <div className="p-4 md:p-5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-2xl font-bold tabular-nums text-app-fg md:text-3xl">{entries.length}</p>
              <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-app-fg-muted md:text-xs">{t.log.totalLogs}</p>
            </div>
          </div>
        </div>
        {/* Documents Received */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-transparent">
          <div className="h-0.5 shrink-0 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-700" />
          <div className="p-4 md:p-5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-2xl font-bold tabular-nums text-emerald-300 md:text-3xl">{totaleSuccessi}</p>
              <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-emerald-400/90 md:text-xs">{t.log.linkedInvoices}</p>
            </div>
          </div>
        </div>
        {/* With Errors */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-500/25 bg-transparent">
          <div className="h-0.5 shrink-0 bg-gradient-to-r from-rose-500 via-rose-400 to-rose-700" />
          <div className="p-4 md:p-5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-2xl font-bold tabular-nums text-red-300 md:text-3xl">{totaleErrori}</p>
              <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-red-400/90 md:text-xs">{t.log.withErrors}</p>
            </div>
          </div>
        </div>
      </div>

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
                const cfg = STATO_CONFIG[log.stato]
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
                      <DeleteButton
                        id={log.id}
                        table="log_sincronizzazione"
                        confirmMessage="Eliminare questo log? L'operazione è irreversibile."
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead>
                  <tr className={APP_SECTION_TABLE_HEAD_ROW}>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.log.colLogId}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.common.date}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.log.colSede}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.log.sender}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.log.subject}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.log.colAttachment}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.common.status}</th>
                    <th className="min-w-[200px] px-3 py-2 font-semibold text-app-fg-muted">{t.common.detail}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-app-fg-muted">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className={APP_SECTION_TABLE_TBODY}>
                  {entries.map((log) => {
                    const cfg = STATO_CONFIG[log.stato]
                    const attach = logAttachmentLabel(log.file_url, log.allegato_nome)
                    const unknownHighlight = log.stato === 'fornitore_non_trovato'
                    return (
                      <tr
                        key={log.id}
                        className={`align-top ${APP_SECTION_TABLE_TR} ${
                          unknownHighlight ? 'bg-red-950/20' : ''
                        }`}
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-app-fg-muted">{log.id.slice(0, 8)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-app-fg-muted">{formatDate(log.data)}</td>
                        <td className="max-w-[100px] truncate px-3 py-2 text-app-fg-muted" title={sedeNomeFromLog(log) ?? ''}>
                          {sedeNomeFromLog(log) ?? '—'}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 font-medium text-app-fg">{log.mittente}</td>
                        <td className="max-w-[160px] truncate px-3 py-2 text-app-fg-muted">
                          {log.oggetto_mail ?? <span className="italic text-app-fg-muted">—</span>}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2 font-mono text-[11px] text-app-fg-muted" title={attach}>
                          {attach || <span className="italic text-app-fg-muted">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[11px] leading-snug text-app-fg-muted">
                          {log.errore_dettaglio ? (
                            <span className="line-clamp-4" title={log.errore_dettaglio}>
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
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
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
                            <DeleteButton
                              id={log.id}
                              table="log_sincronizzazione"
                              confirmMessage="Eliminare questo log? L'operazione è irreversibile."
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
    </div>
  )
}
