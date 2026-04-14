import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { openDocumentUrl } from '@/lib/open-document-url'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import RetryButton from '@/components/RetryButton'
import DeleteButton from '@/components/DeleteButton'
import ScanEmailButton from '@/components/ScanEmailButton'
import LogSupplierAiSuggest from '@/components/LogSupplierAiSuggest'
import { getT, getLocale, getTimezone } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'

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

  const statCard = (children: ReactNode) => (
    <div className="app-card overflow-hidden">
      <div className="app-card-bar" aria-hidden />
      <div className="p-4 md:p-5">{children}</div>
    </div>
  )

  return (
    <div className="p-4 md:p-8">
      <AppPageHeaderStrip>
        <div className="min-w-0 flex-1">
          <h1 className="app-page-title pr-1 text-2xl font-bold">{t.log.title}</h1>
          <p className="mt-1 text-xs leading-snug text-slate-200">{t.log.subtitle}</p>
        </div>
        <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 pt-0.5 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
          <ScanEmailButton alwaysShowLabel />
        </div>
      </AppPageHeaderStrip>

      <AppSummaryHighlightCard
        accent="cyan"
        label={t.log.totalLogs}
        primary={entries.length}
        secondary={
          <>
            {t.log.linkedInvoices}: {totaleSuccessi}
            <span className="mx-1.5 text-slate-500" aria-hidden>
              ·
            </span>
            {t.log.withErrors}: {totaleErrori}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3 md:mb-8 md:gap-4">
        {statCard(
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-2xl font-bold tabular-nums text-slate-100 md:text-3xl">{entries.length}</p>
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-200 md:text-xs">{t.log.totalLogs}</p>
          </div>
        )}
        {statCard(
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-2xl font-bold tabular-nums text-emerald-300 md:text-3xl">{totaleSuccessi}</p>
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-emerald-400/90 md:text-xs">{t.log.linkedInvoices}</p>
          </div>
        )}
        {statCard(
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-2xl font-bold tabular-nums text-red-300 md:text-3xl">{totaleErrori}</p>
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-red-400/90 md:text-xs">{t.log.withErrors}</p>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="p-16 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 font-medium text-slate-200">{t.log.noLogs}</p>
            <p className="text-sm text-slate-500">{t.log.emptyHint}</p>
          </div>
        </div>
      ) : (
        <div className="app-card flex flex-col overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="divide-y divide-slate-800/80 md:hidden">
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
                      <span className="whitespace-nowrap text-[11px] text-slate-500">{formatDate(log.data)}</span>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-600">{t.log.colLogId}: {log.id.slice(0, 8)}…</p>
                    <p className="truncate text-sm font-semibold text-slate-100">{log.mittente}</p>
                    {log.oggetto_mail && <p className="truncate text-xs text-slate-200">{log.oggetto_mail}</p>}
                    {attach && <p className="truncate text-xs font-medium text-cyan-300/90">{t.log.colAttachment}: {attach}</p>}
                    {sedeNomeFromLog(log) && (
                      <p className="text-[11px] text-slate-500">
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
                        <a
                          href={openDocumentUrl({ logId: log.id })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                          {t.log.vediFile}
                        </a>
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
                  <tr className="border-b border-slate-700/60 bg-slate-700/40">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.log.colLogId}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.common.date}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.log.colSede}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.log.sender}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.log.subject}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.log.colAttachment}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.common.status}</th>
                    <th className="min-w-[200px] px-3 py-2 font-semibold text-slate-200">{t.common.detail}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-200">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {entries.map((log) => {
                    const cfg = STATO_CONFIG[log.stato]
                    const attach = logAttachmentLabel(log.file_url, log.allegato_nome)
                    const unknownHighlight = log.stato === 'fornitore_non_trovato'
                    return (
                      <tr
                        key={log.id}
                        className={`align-top transition-colors hover:bg-slate-700/40 ${
                          unknownHighlight ? 'bg-red-950/20' : ''
                        }`}
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[10px] text-slate-500">{log.id.slice(0, 8)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{formatDate(log.data)}</td>
                        <td className="max-w-[100px] truncate px-3 py-2 text-slate-500" title={sedeNomeFromLog(log) ?? ''}>
                          {sedeNomeFromLog(log) ?? '—'}
                        </td>
                        <td className="max-w-[140px] truncate px-3 py-2 font-medium text-slate-100">{log.mittente}</td>
                        <td className="max-w-[160px] truncate px-3 py-2 text-slate-200">
                          {log.oggetto_mail ?? <span className="italic text-slate-600">—</span>}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-2 font-mono text-[11px] text-cyan-300/85" title={attach}>
                          {attach || <span className="italic text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[11px] leading-snug text-slate-200">
                          {log.errore_dettaglio ? (
                            <span className="line-clamp-4" title={log.errore_dettaglio}>
                              {log.errore_dettaglio}
                            </span>
                          ) : log.file_url ? (
                            <a
                              href={openDocumentUrl({ logId: log.id })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 hover:underline"
                            >
                              {t.log.vediFile}
                            </a>
                          ) : (
                            <span className="italic text-slate-600">—</span>
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
