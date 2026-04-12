import type { ReactNode } from 'react'
import { openDocumentUrl } from '@/lib/open-document-url'
import { createClient } from '@/utils/supabase/server'
import RetryButton from '@/components/RetryButton'
import DeleteButton from '@/components/DeleteButton'
import ScanEmailButton from '@/components/ScanEmailButton'
import { getT, getLocale, getTimezone } from '@/lib/locale-server'

type LogStato = 'successo' | 'fornitore_non_trovato' | 'bolla_non_trovata'

interface LogEntry {
  id: string
  data: string
  mittente: string
  oggetto_mail: string | null
  stato: LogStato
  errore_dettaglio: string | null
  fornitore_id: string | null
  file_url: string | null
}

export default async function LogPage() {
  const supabase = await createClient()
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
  }

  const { data: logs } = await supabase
    .from('log_sincronizzazione')
    .select('*')
    .order('data', { ascending: false })
    .limit(200)

  const entries: LogEntry[] = logs ?? []

  const totaleErrori = entries.filter((l) => l.stato === 'fornitore_non_trovato').length
  const totaleSuccessi = entries.filter(
    (l) => l.stato === 'successo' || l.stato === 'bolla_non_trovata'
  ).length

  const dateLocale = locale === 'it' ? 'it-IT' : locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-GB'

  const formatDate = (d: string) =>
    new Date(d).toLocaleString(dateLocale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
      <div className="mb-6 md:mb-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 pr-1 text-2xl font-bold text-slate-100">{t.log.title}</h1>
          <div className="shrink-0 pt-0.5">
            <ScanEmailButton alwaysShowLabel />
          </div>
        </div>
        <p className="mt-1 text-xs leading-snug text-slate-400">{t.log.subtitle}</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3 md:mb-8 md:gap-4">
        {statCard(
          <>
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-400 md:text-xs">{t.log.totalLogs}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-100 md:text-3xl">{entries.length}</p>
          </>
        )}
        {statCard(
          <>
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-emerald-400/90 md:text-xs">{t.log.linkedInvoices}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300 md:text-3xl">{totaleSuccessi}</p>
          </>
        )}
        {statCard(
          <>
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-red-400/90 md:text-xs">{t.log.withErrors}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-300 md:text-3xl">{totaleErrori}</p>
          </>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="p-16 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 font-medium text-slate-400">{t.log.noLogs}</p>
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
              return (
                <div key={log.id} className="space-y-2 px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(log.data)}</span>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-100">{log.mittente}</p>
                  {log.oggetto_mail && (
                    <p className="truncate text-xs text-slate-400">{log.oggetto_mail}</p>
                  )}
                  {log.errore_dettaglio && (
                    <p className="line-clamp-2 text-xs text-red-400">{log.errore_dettaglio}</p>
                  )}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-3">
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
                      {(log.stato === 'bolla_non_trovata' || log.stato === 'fornitore_non_trovato') && log.file_url && (
                        <RetryButton logId={log.id} />
                      )}
                    </div>
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

          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-950/40">
                <th className="px-5 py-3 text-left font-semibold text-slate-400">{t.common.date}</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-400">{t.log.sender}</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-400">{t.log.subject}</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-400">{t.common.status}</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-400">{t.common.detail}</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-400">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {entries.map((log) => {
                const cfg = STATO_CONFIG[log.stato]
                return (
                  <tr key={log.id} className="transition-colors hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(log.data)}</td>
                    <td className="max-w-[200px] truncate px-5 py-3 font-medium text-slate-100">{log.mittente}</td>
                    <td className="max-w-[220px] truncate px-5 py-3 text-slate-400">
                      {log.oggetto_mail ?? <span className="italic text-slate-600">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="max-w-[240px] px-5 py-3 text-xs text-slate-400">
                      {log.errore_dettaglio ? (
                        <span className="block truncate" title={log.errore_dettaglio}>
                          {log.errore_dettaglio}
                        </span>
                      ) : (
                        log.file_url ? (
                          <a href={openDocumentUrl({ logId: log.id })} target="_blank" rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 hover:underline">
                            {t.log.vediFile}
                          </a>
                        ) : (
                          <span className="italic text-slate-600">—</span>
                        )
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
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
      )}
    </div>
  )
}
