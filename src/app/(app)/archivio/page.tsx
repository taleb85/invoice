import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import Link from 'next/link'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import ExportZipButton from './ExportZipButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import {
  APP_SECTION_EMPTY_LINK_CLASS_COMPACT,
  APP_SECTION_TABLE_HEAD_ROW,
  APP_SHELL_SECTION_PAGE_H1_CLASS,
} from '@/lib/app-shell-layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import DocumentiQueue, { type DocumentoInCoda as DocumentoInCodaProps } from '@/components/DocumentiQueue'
import { ReturnToLink } from '@/components/ReturnToLink'
import { BackButton } from '@/components/BackButton'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

const ARCHIVIO_LIST_PATH = '/archivio'

interface Bolla {
  id: string
  data: string
  stato: string
  file_url: string | null
}

interface Fattura {
  id: string
  data: string
  file_url: string | null
  bolla_id: string | null
}

// Documents received via email, not yet associated to a GRN
interface DocumentoInCoda {
  id: string
  created_at: string
  data_documento: string | null
  file_url: string | null
  stato: 'in_attesa' | 'da_associare' | 'da_revisionare'
  fornitore_id: string | null
}

interface Fornitore {
  id: string
  nome: string
  email: string | null
  piva: string | null
  bolle: Bolla[]
  fatture: Fattura[]
  documenti: DocumentoInCoda[]
}

export default async function ArchivioPage() {
  const { supabase } = await getRequestAuth()
  const [t, locale, tz] = await Promise.all([getT(), getLocale(), getTimezone()])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  // documenti_da_processare is fetched with the service client to bypass RLS:
  // documents can have sede_id = NULL (global IMAP / unknown sender) which
  // would be invisible via the user's RLS policy (NULL ≠ sede_id).
  const service = createServiceClient()

  const [{ data: fornitori }, { data: bolle }, { data: fatture }, { data: documentiInCoda }] = await Promise.all([
    supabase.from('fornitori').select('*').order('nome'),
    supabase.from('bolle').select('*').order('data', { ascending: false }),
    supabase.from('fatture').select('*').order('data', { ascending: false }),
    service
      .from('documenti_da_processare')
      .select('id, created_at, data_documento, file_url, stato, fornitore_id')
      .in('stato', ['in_attesa', 'da_associare', 'da_revisionare'])
      .order('created_at', { ascending: false }),
  ])

  const archivio: Fornitore[] = (fornitori ?? []).map((f) => ({
    ...f,
    bolle:     (bolle ?? []).filter((b)  => b.fornitore_id === f.id),
    fatture:   (fatture ?? []).filter((fa) => fa.fornitore_id === f.id),
    documenti: ((documentiInCoda ?? []) as DocumentoInCoda[]).filter((d) => d.fornitore_id === f.id),
  }))

  const totBolle    = bolle?.length ?? 0
  const totFatture  = (fatture?.length ?? 0) + (documentiInCoda?.length ?? 0)

  /* Pre-format every date that DocumentiQueue will render — server locale/tz applied once. */
  const allDates = new Set<string>()
  for (const doc of documentiInCoda ?? []) {
    if (doc.created_at)     allDates.add(doc.created_at)
    if (doc.data_documento) allDates.add(doc.data_documento)
  }
  const formattedDates: Record<string, string> = {}
  for (const d of allDates) {
    formattedDates[d] = formatDate(d)
  }

  const queueLabels = {
    sectionTitle:     t.archivio.queueTitle     ?? 'Documenti in coda',
    sectionSubtitle:  t.archivio.queueSubtitle  ?? 'da elaborare o da associare a una bolla',
    unknownSender:    t.archivio.unknownSender   ?? 'Mittente sconosciuto',
    statusInAttesa:   t.status.inAttesa,
    statusDaAssociare: t.archivio.statusDaAssociare ?? 'Da associare',
    openDoc:          t.archivio.documento,
    linkStatements:   t.archivio.linkAssociateStatements,
    noQueue:          t.archivio.noQueue         ?? 'Nessun documento in coda',
    noQueueHint:      t.archivio.noQueueHint     ?? 'I documenti ricevuti via email appariranno qui.',
    receivedOn:       t.archivio.receivedOn      ?? 'Ricevuto:',
    docDate:          t.archivio.docDate         ?? 'Data doc:',
  }

  return (
    <div className="app-shell-page-padding">
      <AppPageHeaderStrip
        rowAlign="start"
        accent="amber"
        mergedSummary={{
          label: t.common.total,
          primary: archivio.length,
          secondary: (
            <>
              {totBolle} {t.archivio.bollaP}
              <span className="mx-1.5 text-app-fg-muted" aria-hidden>
                ·
              </span>
              {totFatture} {t.archivio.fatturaP}
            </>
          ),
        }}
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className={`w-5 h-5 ${icon.statements}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>}
      >
        <div className="flex w-full min-w-0 flex-col gap-3">
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 className={`${APP_SHELL_SECTION_PAGE_H1_CLASS} font-bold`}>{t.archivio.title}</h1>
          </AppPageHeaderTitleWithDashboardShortcut>
          <ExportZipButton />
        </div>
      </AppPageHeaderStrip>

      {/* Documenti in coda — all pending docs including unmatched (fornitore_id = null) */}
      {(documentiInCoda?.length ?? 0) > 0 && (
        <ErrorBoundary sectionName="documenti da elaborare">
          <DocumentiQueue
            documenti={(documentiInCoda ?? []) as DocumentoInCodaProps[]}
            fornitori={(fornitori ?? []).map((f) => ({ id: f.id, nome: f.nome }))}
            formattedDates={formattedDates}
            labels={queueLabels}
          />
        </ErrorBoundary>
      )}

      {archivio.length === 0 ? (
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <AppSectionEmptyState message={t.fornitori.noSuppliers} messageClassName="text-app-fg-muted" density="comfortable">
            <Link href="/fornitori/new" className={APP_SECTION_EMPTY_LINK_CLASS_COMPACT}>
              {t.fornitori.addFirst}
            </Link>
          </AppSectionEmptyState>
        </div>
      ) : (
        <div className="space-y-4">
          {archivio.map((f) => (
            <div key={f.id} className="app-card overflow-hidden">
              <div className="app-card-bar" aria-hidden />

              {/* Header fornitore */}
              <div className={`flex items-center gap-3 px-4 py-3 ${APP_SECTION_TABLE_HEAD_ROW}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-app-cyan-500 to-blue-600">
                  <span className="text-sm font-bold text-white">{f.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-app-fg">{f.nome}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-app-fg-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {f.bolle.length} {f.bolle.length === 1 ? t.archivio.bollaS : t.archivio.bollaP}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-app-fg-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {f.fatture.length + f.documenti.length}{' '}
                      {(f.fatture.length + f.documenti.length) === 1 ? t.archivio.fatturaS : t.archivio.fatturaP}
                      {f.documenti.length > 0 && (
                        <span className="ml-0.5 text-[10px] font-semibold text-amber-300">
                          {t.archivio.pendingDocCount.replace(/\{n\}/g, String(f.documenti.length))}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <ReturnToLink
                  to={`/fornitori/${f.id}/edit`}
                  from={ARCHIVIO_LIST_PATH}
                  className="min-h-[36px] shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-app-cyan-500 transition-colors hover:bg-black/12 hover:text-app-fg-muted touch-manipulation"
                >
                  {t.archivio.editLink} →
                </ReturnToLink>
              </div>

              {/* Sezione Bolle */}
              <div className="px-4 pb-2 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-app-fg-muted">{t.bolle.title}</h3>
                  <ReturnToLink
                    to={`/bolle/new?fornitore_id=${f.id}`}
                    from={ARCHIVIO_LIST_PATH}
                    className="text-[11px] font-semibold text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                  >
                    + {t.archivio.nuova}
                  </ReturnToLink>
                </div>
                {f.bolle.length === 0 ? (
                  <p className="py-1.5 text-xs italic text-app-fg-muted">{t.archivio.noBills}</p>
                ) : (
                  <div className="space-y-1.5">
                    {f.bolle.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg app-workspace-inset-bg-soft px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${b.stato === 'completato' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          />
                          <span className="whitespace-nowrap text-sm font-medium text-app-fg-muted">{formatDate(b.data)}</span>
                          <span
                            className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              b.stato === 'completato'
                                ? 'border border-[rgba(34,211,238,0.15)] bg-emerald-500/15 text-emerald-200'
                                : 'border border-[rgba(34,211,238,0.15)] bg-amber-500/15 text-amber-200'
                            }`}
                          >
                            {b.stato === 'completato' ? t.status.completata : t.status.inAttesa}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          {b.file_url && (
                            <OpenDocumentInAppButton
                              bollaId={b.id}
                              fileUrl={b.file_url}
                              className="text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                            >
                              {t.archivio.documento}
                            </OpenDocumentInAppButton>
                          )}
                          {b.stato === 'in attesa' && (
                            <ReturnToLink
                              to={`/fatture/new?bolla_id=${b.id}&fornitore_id=${f.id}`}
                              from={ARCHIVIO_LIST_PATH}
                              className="text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                            >
                              {t.archivio.nuovaFattura}
                            </ReturnToLink>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sezione Fatture */}
              <div className="mt-2 border-t border-app-line-22 px-4 pb-3 pt-2">
                <div className="mb-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-app-fg-muted">{t.fatture.title}</h3>
                </div>

                {f.fatture.length === 0 && f.documenti.length === 0 ? (
                  <p className="py-1.5 text-xs italic text-app-fg-muted">{t.archivio.noInvoices}</p>
                ) : (
                  <div className="space-y-1.5">
                    {/* Confirmed invoices (linked to a GRN) */}
                    {f.fatture.map((fa) => (
                      <div key={fa.id} className="flex items-center justify-between rounded-lg app-workspace-inset-bg-soft px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                          <span className="whitespace-nowrap text-sm font-medium text-app-fg-muted">{formatDate(fa.data)}</span>
                          {fa.bolla_id ? (
                            <span className="whitespace-nowrap rounded-full border border-app-line-30 bg-app-line-10 px-1.5 py-0.5 text-[10px] font-semibold text-app-fg-muted">
                              {t.archivio.withBill}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full border border-app-line-28 app-workspace-inset-bg px-1.5 py-0.5 text-[10px] font-semibold text-app-fg-muted">
                              {t.fatture.statusSenzaBolla}
                            </span>
                          )}
                        </div>
                        {fa.file_url && (
                          <OpenDocumentInAppButton
                            fatturaId={fa.id}
                            fileUrl={fa.file_url}
                            className="ml-2 shrink-0 text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                          >
                            {t.archivio.documento}
                          </OpenDocumentInAppButton>
                        )}
                      </div>
                    ))}

                    {/* Pending documents received via email — not yet matched to a GRN */}
                    {f.documenti.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-500/10 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                          <span className="whitespace-nowrap text-sm font-medium text-app-fg-muted">
                            {doc.data_documento ? formatDate(doc.data_documento) : formatDate(doc.created_at)}
                          </span>
                          <span className="whitespace-nowrap rounded-full border border-[rgba(34,211,238,0.15)] bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                            {t.status.inAttesa}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          {doc.file_url && (
                            <OpenDocumentInAppButton
                              documentoId={doc.id}
                              fileUrl={doc.file_url}
                              className="text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                            >
                              {t.archivio.documento}
                            </OpenDocumentInAppButton>
                          )}
                          <Link
                            href="/statements"
                            className="whitespace-nowrap text-[10px] font-semibold text-amber-300 hover:text-amber-200 hover:underline"
                          >
                            {t.archivio.linkAssociateStatements}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
