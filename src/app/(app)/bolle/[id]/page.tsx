import Link from 'next/link'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { getRequestAuth, getProfile } from '@/utils/supabase/server'
import { getBollaForViewer, getFattureRowsForBollaAuthorized } from '@/lib/supabase-detail-for-viewer'
import ListinoDocReferenceTable from '@/components/ListinoDocReferenceTable'
import ToggleStato from './ToggleStato'
import DocumentUnavailable from '@/components/DocumentUnavailable'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import { fornitoreNomeMaiuscolo } from '@/lib/fornitore-display'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import { hrefWithReturnTo } from '@/lib/return-navigation'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

/** True se la bolla è citata in statement_rows.bolle_json con rekki_meta.prezzo_da_verificare (richiede migration RPC). */
async function getRekkiPrezzoFlag(bollaId: string): Promise<boolean> {
  const { supabase } = await getRequestAuth()
  const { data, error } = await supabase.rpc('bolla_has_rekki_prezzo_flag', { p_bolla_id: bollaId })
  if (error) return false
  return Boolean(data)
}

export default async function BollaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const [bolla, t, locale, tz] = await Promise.all([getBollaForViewer(id), getT(), getLocale(), getTimezone()])
  if (!bolla) return <DocumentUnavailable kind="bolla" />
  const [fatture, rekkiPrezzoFlag, profile] = await Promise.all([
    getFattureRowsForBollaAuthorized(id),
    getRekkiPrezzoFlag(id),
    getProfile(),
  ])
  const formatDate = (d: string) => fmtDate(d, locale, tz)
  const allowListinoForce = Boolean(profile)

  const fornitoreRekkiId = bolla.fornitore?.rekki_supplier_id?.trim()
  let listinoRows: { prodotto: string; prezzo: number; data_prezzo: string }[] = []
  if (fornitoreRekkiId) {
    const { supabase } = await getRequestAuth()
    const { data } = await supabase
      .from('listino_prezzi')
      .select('prodotto, prezzo, data_prezzo')
      .eq('fornitore_id', bolla.fornitore_id)
      .order('data_prezzo', { ascending: false })
      .limit(24)
    listinoRows = (data ?? []) as typeof listinoRows
  }

  return (
    <div className="max-w-2xl app-shell-page-padding">
      <BackButton href="/bolle" label="Bolle" />
      <AppPageHeaderStrip accent="indigo" icon={<svg className={`w-5 h-5 ${icon.bolle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>}>
        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="app-page-title text-2xl font-bold">{fornitoreNomeMaiuscolo(bolla.fornitore?.nome)}</h1>
              {rekkiPrezzoFlag && (
                <span
                  className="inline-flex max-w-full min-w-0 shrink items-center rounded-full border border-[rgba(34,211,238,0.15)] bg-amber-950/50 px-2 py-1.5 text-[10px] font-semibold leading-snug text-amber-50 shadow-md shadow-amber-950/40 sm:px-2.5 sm:text-[11px]"
                  title={`${t.bolle.verificaPrezzoFornitore} — ${t.bolle.prezzoDaApp}`}
                >
                  {t.bolle.rekkiPrezzoIndicativoBadge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-app-fg-muted">{formatDate(bolla.data)}</p>
          </div>
      </AppPageHeaderStrip>

      <div className="space-y-4">
        {/* Info + stato */}
        <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-app-fg">{t.bolle.dettaglio}</h2>
            <ToggleStato id={bolla.id} stato={bolla.stato} />
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.supplier}</dt>
              <dd className="font-medium text-app-fg">{fornitoreNomeMaiuscolo(bolla.fornitore?.nome)}</dd>
            </div>
            {bolla.numero_bolla && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.appStrings.colDeliveryNoteNum}</dt>
                <dd className="font-mono font-medium text-app-fg">{bolla.numero_bolla}</dd>
              </div>
            )}
            {bolla.fornitore?.email && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fornitori.email}</dt>
                <dd className="text-app-fg-muted">{bolla.fornitore.email}</dd>
              </div>
            )}
            {bolla.fornitore?.piva && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fornitori.piva}</dt>
                <dd className="text-app-fg-muted">{bolla.fornitore.piva}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.date}</dt>
              <dd className="text-app-fg-muted">{formatDate(bolla.data)}</dd>
            </div>
            {bolla.importo != null && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.statements.colAmount}</dt>
                <dd className="font-semibold text-app-fg">
                  £ {Number(bolla.importo).toFixed(2)}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.status}</dt>
              <dd>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  bolla.stato === 'completato'
                    ? 'border border-[rgba(34,211,238,0.15)] bg-emerald-500/15 text-emerald-300'
                    : 'border border-[rgba(34,211,238,0.15)] bg-amber-500/15 text-amber-200'
                }`}>
                  {bolla.stato === 'completato' ? t.status.completato : t.status.inAttesa}
                </span>
              </dd>
            </div>
          </dl>
          </div>
        </div>

        {/* Allegato */}
        {bolla.file_url && (
          <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
            <div className="app-card-bar shrink-0" aria-hidden />
            <div className="p-6">
            <h2 className="mb-3 text-sm font-semibold text-app-fg">{t.common.attachment}</h2>
            <OpenDocumentInAppButton
              bollaId={bolla.id}
              fileUrl={bolla.file_url}
              className="flex items-center gap-2 text-sm font-medium text-app-cyan-500 transition-colors hover:text-app-fg-muted"
            >
              <svg className={`h-4 w-4 ${icon.bolle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {t.common.openAttachment}
            </OpenDocumentInAppButton>
            </div>
          </div>
        )}

        {fornitoreRekkiId && (
          <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
            <div className="app-card-bar shrink-0" aria-hidden />
            <div className="p-6">
            <h2 className="mb-2 text-sm font-semibold text-app-fg">{t.bolle.listinoRekkiRefTitle}</h2>
            <p className="mb-3 text-[11px] leading-snug text-app-fg-muted">{t.bolle.listinoRekkiRefHint}</p>
            {listinoRows.length === 0 ? (
              <p className="text-sm text-app-fg-muted">{t.bolle.listinoRekkiRefEmpty}</p>
            ) : (
              <ListinoDocReferenceTable
                documentDateIso={bolla.data}
                fornitoreId={bolla.fornitore_id}
                rows={listinoRows}
                allowAdminForce={allowListinoForce}
              />
            )}
            </div>
          </div>
        )}

        {/* Fatture collegate */}
        <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-app-fg">{t.bolle.fattureCollegate}</h2>
            <Link
              href={hrefWithReturnTo(
                `/fatture/new?bolla_id=${bolla.id}&fornitore_id=${bolla.fornitore_id}`,
                `/bolle/${bolla.id}`,
              )}
              className="text-xs font-medium text-app-cyan-500 transition-colors hover:text-app-fg-muted"
            >
              {t.bolle.aggiungi}
            </Link>
          </div>
          {fatture.length === 0 ? (
            <p className="text-sm text-app-fg-muted">{t.bolle.nessunaFatturaCollegata}</p>
          ) : (
            <div className="space-y-2">
              {fatture.map((f: { id: string; data: string; file_url: string | null }) => (
                <Link
                  key={f.id}
                  href={`/fatture/${f.id}`}
                  className="-mx-2 flex items-center justify-between rounded px-2 py-2 text-sm text-app-fg-muted transition-colors hover:bg-black/12"
                >
                  <span>{formatDate(f.data)}</span>
                  {f.file_url && (
                    <span className="text-xs font-medium text-app-cyan-500">{t.bolle.allegatoLink}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
