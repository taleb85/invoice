import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale'

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

interface Fornitore {
  id: string
  nome: string
  email: string | null
  piva: string | null
  bolle: Bolla[]
  fatture: Fattura[]
}

export default async function ArchivioPage() {
  const supabase = await createClient()
  const [t, locale, tz] = await Promise.all([getT(), getLocale(), getTimezone()])
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  const [{ data: fornitori }, { data: bolle }, { data: fatture }] = await Promise.all([
    supabase.from('fornitori').select('*').order('nome'),
    supabase.from('bolle').select('*').order('data', { ascending: false }),
    supabase.from('fatture').select('*').order('data', { ascending: false }),
  ])

  const archivio: Fornitore[] = (fornitori ?? []).map((f) => ({
    ...f,
    bolle: (bolle ?? []).filter((b) => b.fornitore_id === f.id),
    fatture: (fatture ?? []).filter((fa) => fa.fornitore_id === f.id),
  }))

  const totBolle = bolle?.length ?? 0
  const totFatture = fatture?.length ?? 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t.archivio.title}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {archivio.length} {t.archivio.subtitle} · {totBolle} {t.archivio.bollaP} · {totFatture} {t.archivio.fatturaP}
        </p>
      </div>

      {archivio.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
          <p className="text-gray-400 text-sm">{t.fornitori.noSuppliers}</p>
          <Link href="/fornitori/new" className="mt-3 inline-block text-sm text-[#1a3050] font-medium hover:text-[#1a3050]">
            {t.fornitori.addFirst}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {archivio.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Intestazione fornitore */}
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#d0daea] flex items-center justify-center">
                    <span className="text-sm font-bold text-[#1a3050]">
                      {f.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{f.nome}</p>
                    <p className="text-xs text-gray-400">
                      {f.email ?? t.archivio.noEmail}{f.piva ? ` · ${f.piva}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {f.bolle.length} {f.bolle.length === 1 ? t.archivio.bollaS : t.archivio.bollaP}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {f.fatture.length} {f.fatture.length === 1 ? t.archivio.fatturaS : t.archivio.fatturaP}
                  </span>
                  <Link
                    href={`/fornitori/${f.id}/edit`}
                    className="text-[#2a4a7f] hover:text-[#1a3050] font-medium"
                  >
                    {t.archivio.editLink}
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-gray-100">
                {/* Colonna Bolle */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.bolle.title}</h3>
                    <Link
                      href={`/bolle/new`}
                      className="text-xs text-[#1a3050] hover:text-[#1a3050] font-medium"
                    >
                      {t.archivio.nuova}
                    </Link>
                  </div>
                  {f.bolle.length === 0 ? (
                    <p className="text-xs text-gray-300 italic py-2">{t.archivio.noBills}</p>
                  ) : (
                    <div className="space-y-2">
                      {f.bolle.map((b) => (
                        <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.stato === 'completato' ? 'bg-green-500' : 'bg-amber-400'}`} />
                            <span className="text-xs font-medium text-gray-700">{formatDate(b.data)}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              b.stato === 'completato'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-amber-50 text-amber-600'
                            }`}>
                              {b.stato === 'completato' ? t.status.completata : t.status.inAttesa}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {b.file_url && (
                              <a
                                href={b.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-[#2a4a7f] hover:text-[#1a3050] font-medium"
                              >
                                {t.archivio.documento}
                              </a>
                            )}
                            {b.stato === 'in attesa' && (
                              <Link
                                href={`/fatture/new?bolla_id=${b.id}&fornitore_id=${f.id}`}
                                className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
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

                {/* Colonna Fatture */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.fatture.title}</h3>
                    <Link
                      href={`/fatture/new?fornitore_id=${f.id}`}
                      className="text-xs text-[#1a3050] hover:text-[#1a3050] font-medium"
                    >
                      {t.archivio.nuova}
                    </Link>
                  </div>
                  {f.fatture.length === 0 ? (
                    <p className="text-xs text-gray-300 italic py-2">{t.archivio.noInvoices}</p>
                  ) : (
                    <div className="space-y-2">
                      {f.fatture.map((fa) => (
                        <div key={fa.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-700">{formatDate(fa.data)}</span>
                            {fa.bolla_id && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#e8edf5] text-[#2a4a7f] font-medium">
                                {t.archivio.withBill}
                              </span>
                            )}
                          </div>
                          {fa.file_url && (
                            <a
                              href={fa.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#2a4a7f] hover:text-[#1a3050] font-medium"
                            >
                              {t.archivio.documento}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
