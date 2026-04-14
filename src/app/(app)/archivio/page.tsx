import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import Link from 'next/link'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import ExportZipButton from './ExportZipButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'

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
  stato: 'in_attesa' | 'da_associare'
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
      .in('stato', ['in_attesa', 'da_associare'])
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

  return (
    <div className="app-shell-page-padding">
      <Link
        href="/"
        className="mb-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-cyan-300 touch-manipulation md:min-h-0 md:py-0"
      >
        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t.appStrings.backToHome}
      </Link>

      <AppPageHeaderStrip>
        <div className="flex w-full min-w-0 flex-col gap-3">
          <AppPageHeaderTitleWithDashboardShortcut dashboardLabel={t.nav.dashboard}>
            <h1 className="app-page-title text-2xl font-bold">{t.archivio.title}</h1>
          </AppPageHeaderTitleWithDashboardShortcut>
          <ExportZipButton />
        </div>
      </AppPageHeaderStrip>

      <AppSummaryHighlightCard
        accent="amber"
        label={t.common.total}
        primary={archivio.length}
        secondary={
          <>
            {totBolle} {t.archivio.bollaP}
            <span className="mx-1.5 text-slate-500" aria-hidden>
              ·
            </span>
            {totFatture} {t.archivio.fatturaP}
          </>
        }
      />

      {archivio.length === 0 ? (
        <div className="app-card overflow-hidden px-6 py-16 text-center">
          <div className="app-card-bar" aria-hidden />
          <p className="text-sm text-slate-500">{t.fornitori.noSuppliers}</p>
          <Link href="/fornitori/new" className="mt-3 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300">
            {t.fornitori.addFirst}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {archivio.map((f) => (
            <div key={f.id} className="app-card overflow-hidden">
              <div className="app-card-bar" aria-hidden />

              {/* Header fornitore */}
              <div className="flex items-center gap-3 border-b border-slate-700/50 bg-slate-700/40 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                  <span className="text-sm font-bold text-white">{f.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{f.nome}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] text-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {f.bolle.length} {f.bolle.length === 1 ? t.archivio.bollaS : t.archivio.bollaP}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-200">
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
                <Link
                  href={`/fornitori/${f.id}/edit`}
                  className="min-h-[36px] shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-cyan-400 transition-colors hover:bg-slate-700/50 hover:text-cyan-300 touch-manipulation"
                >
                  {t.archivio.editLink} →
                </Link>
              </div>

              {/* Sezione Bolle */}
              <div className="px-4 pb-2 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.bolle.title}</h3>
                  <Link href="/bolle/new" className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline">
                    + {t.archivio.nuova}
                  </Link>
                </div>
                {f.bolle.length === 0 ? (
                  <p className="py-1.5 text-xs italic text-slate-500">{t.archivio.noBills}</p>
                ) : (
                  <div className="space-y-1.5">
                    {f.bolle.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${b.stato === 'completato' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          />
                          <span className="whitespace-nowrap text-sm font-medium text-slate-200">{formatDate(b.data)}</span>
                          <span
                            className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              b.stato === 'completato'
                                ? 'border border-emerald-500/25 bg-emerald-500/15 text-emerald-200'
                                : 'border border-amber-500/25 bg-amber-500/15 text-amber-200'
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
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                            >
                              {t.archivio.documento}
                            </OpenDocumentInAppButton>
                          )}
                          {b.stato === 'in attesa' && (
                            <Link
                              href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${f.id}`}
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                            >
                              {t.archivio.nuovaFattura}
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sezione Fatture */}
              <div className="mt-2 border-t border-slate-700/50 px-4 pb-3 pt-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.fatture.title}</h3>
                  <Link
                    href={`/fatture/new?fornitore_id=${f.id}`}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                  >
                    + {t.archivio.nuova}
                  </Link>
                </div>

                {f.fatture.length === 0 && f.documenti.length === 0 ? (
                  <p className="py-1.5 text-xs italic text-slate-500">{t.archivio.noInvoices}</p>
                ) : (
                  <div className="space-y-1.5">
                    {/* Confirmed invoices (linked to a GRN) */}
                    {f.fatture.map((fa) => (
                      <div key={fa.id} className="flex items-center justify-between rounded-lg bg-slate-700/50 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                          <span className="whitespace-nowrap text-sm font-medium text-slate-200">{formatDate(fa.data)}</span>
                          {fa.bolla_id ? (
                            <span className="whitespace-nowrap rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                              {t.archivio.withBill}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full border border-slate-600/60 bg-slate-700/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
                              {t.fatture.statusSenzaBolla}
                            </span>
                          )}
                        </div>
                        {fa.file_url && (
                          <OpenDocumentInAppButton
                            fatturaId={fa.id}
                            fileUrl={fa.file_url}
                            className="ml-2 shrink-0 text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
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
                        className="flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                          <span className="whitespace-nowrap text-sm font-medium text-slate-200">
                            {doc.data_documento ? formatDate(doc.data_documento) : formatDate(doc.created_at)}
                          </span>
                          <span className="whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                            {t.status.inAttesa}
                          </span>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-2">
                          {doc.file_url && (
                            <OpenDocumentInAppButton
                              documentoId={doc.id}
                              fileUrl={doc.file_url}
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
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
