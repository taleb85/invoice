import { createClient, createServiceClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale'
import ExportZipButton from './ExportZipButton'

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
  const supabase = await createClient()
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
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.archivio.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {archivio.length} {t.archivio.subtitle} · {totBolle} {t.archivio.bollaP} · {totFatture} {t.archivio.fatturaP}
            </p>
          </div>
        </div>
        <ExportZipButton />
      </div>

      {archivio.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
          <p className="text-gray-400 text-sm">{t.fornitori.noSuppliers}</p>
          <Link href="/fornitori/new" className="mt-3 inline-block text-sm text-[#1a3050] font-medium hover:text-[#1a3050]">
            {t.fornitori.addFirst}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {archivio.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">

              {/* Header fornitore */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-[#d0daea] flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#1a3050]">{f.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate text-sm">{f.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {f.bolle.length} {f.bolle.length === 1 ? t.archivio.bollaS : t.archivio.bollaP}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {f.fatture.length + f.documenti.length} {(f.fatture.length + f.documenti.length) === 1 ? t.archivio.fatturaS : t.archivio.fatturaP}
                      {f.documenti.length > 0 && (
                        <span className="ml-0.5 text-[10px] font-semibold text-amber-600">
                          ({f.documenti.length} in attesa)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <Link href={`/fornitori/${f.id}/edit`} className="text-xs text-[#2a4a7f] font-medium shrink-0 px-3 py-2 min-h-[36px] rounded-lg hover:bg-[#e8edf5] active:bg-[#d0daea] transition-colors touch-manipulation">
                  {t.archivio.editLink} →
                </Link>
              </div>

              {/* Sezione Bolle */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t.bolle.title}</h3>
                  <Link href="/bolle/new" className="text-[11px] text-[#1a3050] font-semibold hover:underline">
                    + {t.archivio.nuova}
                  </Link>
                </div>
                {f.bolle.length === 0 ? (
                  <p className="text-xs text-gray-300 italic py-1.5">{t.archivio.noBills}</p>
                ) : (
                  <div className="space-y-1.5">
                    {f.bolle.map((b) => (
                      <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${b.stato === 'completato' ? 'bg-green-500' : 'bg-amber-400'}`} />
                          <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{formatDate(b.data)}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                            b.stato === 'completato' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {b.stato === 'completato' ? t.status.completata : t.status.inAttesa}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {b.file_url && (
                            <a href={b.file_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-[#2a4a7f] font-medium hover:underline">
                              {t.archivio.documento}
                            </a>
                          )}
                          {b.stato === 'in attesa' && (
                            <Link href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${f.id}`}
                              className="text-xs text-blue-600 font-medium hover:underline">
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
              <div className="px-4 pt-2 pb-3 border-t border-gray-100 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t.fatture.title}</h3>
                  <Link href={`/fatture/new?fornitore_id=${f.id}`} className="text-[11px] text-[#1a3050] font-semibold hover:underline">
                    + {t.archivio.nuova}
                  </Link>
                </div>

                {f.fatture.length === 0 && f.documenti.length === 0 ? (
                  <p className="text-xs text-gray-300 italic py-1.5">{t.archivio.noInvoices}</p>
                ) : (
                  <div className="space-y-1.5">
                    {/* Confirmed invoices (linked to a GRN) */}
                    {f.fatture.map((fa) => (
                      <div key={fa.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          <span className="text-sm font-medium text-gray-800 whitespace-nowrap">{formatDate(fa.data)}</span>
                          {fa.bolla_id ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#e8edf5] text-[#2a4a7f] font-semibold whitespace-nowrap">
                              {t.archivio.withBill}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold whitespace-nowrap">
                              Senza bolla
                            </span>
                          )}
                        </div>
                        {fa.file_url && (
                          <a href={fa.file_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-[#2a4a7f] font-medium hover:underline shrink-0 ml-2">
                            {t.archivio.documento}
                          </a>
                        )}
                      </div>
                    ))}

                    {/* Pending documents received via email — not yet matched to a GRN */}
                    {f.documenti.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-50 border border-amber-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                            {doc.data_documento ? formatDate(doc.data_documento) : formatDate(doc.created_at)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold whitespace-nowrap">
                            In attesa
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {doc.file_url && (
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-[#2a4a7f] font-medium hover:underline">
                              {t.archivio.documento}
                            </a>
                          )}
                          <Link
                            href="/statements"
                            className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 hover:underline whitespace-nowrap"
                          >
                            Associa →
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
