import Link from 'next/link'
import { openDocumentUrl } from '@/lib/open-document-url'
import { createClient } from '@/utils/supabase/server'
import { getBollaForViewer, getFattureRowsForBollaAuthorized } from '@/lib/supabase-detail-for-viewer'
import ToggleStato from './ToggleStato'
import DocumentUnavailable from '@/components/DocumentUnavailable'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'

/** True se la bolla è citata in statement_rows.bolle_json con rekki_meta.prezzo_da_verificare (richiede migration RPC). */
async function getRekkiPrezzoFlag(bollaId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('bolla_has_rekki_prezzo_flag', { p_bolla_id: bollaId })
  if (error) return false
  return Boolean(data)
}

export default async function BollaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [bolla, t, locale, tz] = await Promise.all([getBollaForViewer(id), getT(), getLocale(), getTimezone()])
  if (!bolla) return <DocumentUnavailable kind="bolla" />
  const [fatture, rekkiPrezzoFlag] = await Promise.all([
    getFattureRowsForBollaAuthorized(id),
    getRekkiPrezzoFlag(id),
  ])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  const fornitoreRekkiId = bolla.fornitore?.rekki_supplier_id?.trim()
  let listinoRows: { prodotto: string; prezzo: number; data_prezzo: string }[] = []
  if (fornitoreRekkiId) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('listino_prezzi')
      .select('prodotto, prezzo, data_prezzo')
      .eq('fornitore_id', bolla.fornitore_id)
      .order('data_prezzo', { ascending: false })
      .limit(24)
    listinoRows = (data ?? []) as typeof listinoRows
  }

  return (
    <div className="max-w-2xl p-4 md:p-8">
      <div className="mb-8 flex items-center gap-3">
        <Link
          href={`/fornitori/${bolla.fornitore_id}`}
          className="text-slate-500 transition-colors hover:text-slate-300"
          aria-label={t.appStrings.infoSupplierCard}
          title={t.appStrings.infoSupplierCard}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-100">{bolla.fornitore?.nome}</h1>
            {rekkiPrezzoFlag && (
              <span
                className="inline-flex max-w-full min-w-0 shrink items-center rounded-full border border-amber-400/45 bg-amber-950/50 px-2 py-1.5 text-[10px] font-semibold leading-snug text-amber-50 shadow-md shadow-amber-950/40 sm:px-2.5 sm:text-[11px]"
                title={`${t.bolle.verificaPrezzoFornitore} — ${t.bolle.prezzoDaApp}`}
              >
                {t.bolle.rekkiPrezzoIndicativoBadge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-400">{formatDate(bolla.data)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Info + stato */}
        <div className="app-card overflow-hidden rounded-xl border border-slate-700/50 p-6">
          <div className="app-card-bar mb-4" aria-hidden />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">{t.bolle.dettaglio}</h2>
            <ToggleStato id={bolla.id} stato={bolla.stato} />
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">{t.common.supplier}</dt>
              <dd className="font-medium text-slate-100">{bolla.fornitore?.nome}</dd>
            </div>
            {bolla.numero_bolla && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-400">{t.appStrings.colDeliveryNoteNum}</dt>
                <dd className="font-mono font-medium text-slate-100">{bolla.numero_bolla}</dd>
              </div>
            )}
            {bolla.fornitore?.email && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-400">{t.fornitori.email}</dt>
                <dd className="text-slate-300">{bolla.fornitore.email}</dd>
              </div>
            )}
            {bolla.fornitore?.piva && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-400">{t.fornitori.piva}</dt>
                <dd className="text-slate-300">{bolla.fornitore.piva}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">{t.common.date}</dt>
              <dd className="text-slate-300">{formatDate(bolla.data)}</dd>
            </div>
            {bolla.importo != null && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-400">{t.statements.colAmount}</dt>
                <dd className="font-semibold text-slate-100">
                  £ {Number(bolla.importo).toFixed(2)}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-400">{t.common.status}</dt>
              <dd>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  bolla.stato === 'completato'
                    ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                    : 'border border-amber-500/30 bg-amber-500/15 text-amber-200'
                }`}>
                  {bolla.stato === 'completato' ? t.status.completato : t.status.inAttesa}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Allegato */}
        {bolla.file_url && (
          <div className="app-card overflow-hidden rounded-xl border border-slate-700/50 p-6">
            <div className="app-card-bar mb-3" aria-hidden />
            <h2 className="mb-3 text-sm font-semibold text-slate-100">{t.common.attachment}</h2>
            <a
              href={openDocumentUrl({ bollaId: bolla.id })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-cyan-400 transition-colors hover:text-cyan-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {t.common.openAttachment}
            </a>
          </div>
        )}

        {fornitoreRekkiId && (
          <div className="app-card overflow-hidden rounded-xl border border-slate-700/50 p-6">
            <div className="app-card-bar mb-3" aria-hidden />
            <h2 className="mb-2 text-sm font-semibold text-slate-100">{t.bolle.listinoRekkiRefTitle}</h2>
            <p className="mb-3 text-[11px] leading-snug text-slate-500">{t.bolle.listinoRekkiRefHint}</p>
            {listinoRows.length === 0 ? (
              <p className="text-sm text-slate-500">{t.bolle.listinoRekkiRefEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/60 text-slate-500">
                      <th className="py-2 pr-3 font-medium">{t.fornitori.listinoProdotti}</th>
                      <th className="py-2 pr-3 font-medium text-right">{t.fornitori.listinoColImporto}</th>
                      <th className="py-2 font-medium">{t.fornitori.listinoColData}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {listinoRows.map((row) => (
                      <tr key={`${row.prodotto}-${row.data_prezzo}`}>
                        <td className="max-w-[200px] truncate py-2 pr-3 text-slate-200">{row.prodotto}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-100">
                          {Number(row.prezzo).toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap py-2 text-slate-500">{formatDate(row.data_prezzo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Fatture collegate */}
        <div className="app-card overflow-hidden rounded-xl border border-slate-700/50 p-6">
          <div className="app-card-bar mb-4" aria-hidden />
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">{t.bolle.fattureCollegate}</h2>
            <Link
              href={`/fatture/new?bolla_id=${bolla.id}&fornitore_id=${bolla.fornitore_id}`}
              className="text-xs font-medium text-cyan-400 transition-colors hover:text-cyan-300"
            >
              {t.bolle.aggiungi}
            </Link>
          </div>
          {fatture.length === 0 ? (
            <p className="text-sm text-slate-500">{t.bolle.nessunaFatturaCollegata}</p>
          ) : (
            <div className="space-y-2">
              {fatture.map((f: { id: string; data: string; file_url: string | null }) => (
                <Link
                  key={f.id}
                  href={`/fatture/${f.id}`}
                  className="-mx-2 flex items-center justify-between rounded px-2 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/50"
                >
                  <span>{formatDate(f.data)}</span>
                  {f.file_url && (
                    <span className="text-xs font-medium text-cyan-400">{t.bolle.allegatoLink}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
