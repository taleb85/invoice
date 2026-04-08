import { createClient } from '@/utils/supabase/server'
import RetryButton from '@/components/RetryButton'
import { getT, getLocale, getTimezone } from '@/lib/locale'

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
      className: 'bg-green-50 text-green-700 ring-1 ring-green-200',
    },
    bolla_non_trovata: {
      label: t.log.bollaNotFound,
      className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    },
    fornitore_non_trovato: {
      label: t.log.supplierNotFound,
      className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    },
  }

  const { data: logs } = await supabase
    .from('log_sincronizzazione')
    .select('*')
    .order('data', { ascending: false })
    .limit(200)

  const entries: LogEntry[] = logs ?? []

  const totaleErrori = entries.filter(
    (l) => l.stato === 'fornitore_non_trovato' || l.stato === 'bolla_non_trovata'
  ).length
  const totaleSuccessi = entries.filter((l) => l.stato === 'successo').length

  const dateLocale = locale === 'it' ? 'it-IT' : locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-GB'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t.log.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.log.subtitle}</p>
      </div>

      {/* Statistiche */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t.log.totalLogs}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{entries.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wide">{t.log.linkedInvoices}</p>
          <p className="mt-1 text-3xl font-bold text-green-700">{totaleSuccessi}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-red-600 uppercase tracking-wide">{t.log.withErrors}</p>
          <p className="mt-1 text-3xl font-bold text-red-700">{totaleErrori}</p>
        </div>
      </div>

      {/* Tabella */}
      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <svg className="mx-auto w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500 font-medium">{t.log.noLogs}</p>
          <p className="text-sm text-gray-400">{t.log.emptyHint}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left font-semibold text-gray-600">{t.common.date}</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">{t.log.sender}</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">{t.log.subject}</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">{t.common.status}</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">{t.common.detail}</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.map((log) => {
                const cfg = STATO_CONFIG[log.stato]
                const dataFormatted = new Date(log.data).toLocaleString(dateLocale, {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                  timeZone: tz,
                })
                return (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{dataFormatted}</td>
                    <td className="px-5 py-3 font-medium text-gray-900 max-w-[200px] truncate">{log.mittente}</td>
                    <td className="px-5 py-3 text-gray-600 max-w-[220px] truncate">
                      {log.oggetto_mail ?? <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs max-w-[240px]">
                      {log.errore_dettaglio ? (
                        <span className="truncate block" title={log.errore_dettaglio}>
                          {log.errore_dettaglio}
                        </span>
                      ) : (
                        log.file_url ? (
                          <a href={log.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-[#1a3050] hover:underline">
                            {t.log.vediFile}
                          </a>
                        ) : (
                          <span className="text-gray-300 italic">—</span>
                        )
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {log.stato === 'bolla_non_trovata' && log.fornitore_id && log.file_url && (
                        <RetryButton logId={log.id} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
