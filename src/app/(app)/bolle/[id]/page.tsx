import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ToggleStato from './ToggleStato'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale'

async function getBolla(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bolle')
    .select('*, fornitore:fornitori(nome, email, piva)')
    .eq('id', id)
    .single()
  return data
}

async function getFatture(bollaId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fatture')
    .select('*')
    .eq('bolla_id', bollaId)
    .order('data', { ascending: false })
  return data ?? []
}

export default async function BollaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [bolla, fatture, t, locale, tz] = await Promise.all([getBolla(id), getFatture(id), getT(), getLocale(), getTimezone()])
  if (!bolla) notFound()
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/bolle" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{bolla.fornitore?.nome}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(bolla.data)}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Info + stato */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">{t.bolle.dettaglio}</h2>
            <ToggleStato id={bolla.id} stato={bolla.stato} />
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-28 shrink-0">{t.common.supplier}</dt>
              <dd className="font-medium text-gray-900">{bolla.fornitore?.nome}</dd>
            </div>
            {bolla.fornitore?.email && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">{t.fornitori.email}</dt>
                <dd className="text-gray-700">{bolla.fornitore.email}</dd>
              </div>
            )}
            {bolla.fornitore?.piva && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">{t.fornitori.piva}</dt>
                <dd className="text-gray-700">{bolla.fornitore.piva}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-500 w-28 shrink-0">{t.common.date}</dt>
              <dd className="text-gray-700">{formatDate(bolla.data)}</dd>
            </div>
          </dl>
        </div>

        {/* Allegato */}
        {bolla.file_url && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">{t.common.attachment}</h2>
            <a
              href={bolla.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#1a3050] hover:text-[#1a3050] font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {t.common.openAttachment}
            </a>
          </div>
        )}

        {/* Fatture collegate */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">{t.bolle.fattureCollegate}</h2>
            <Link
              href={`/fatture/new?bolla_id=${bolla.id}&fornitore_id=${bolla.fornitore_id}`}
              className="text-xs text-[#1a3050] hover:text-[#1a3050] font-medium"
            >
              {t.bolle.aggiungi}
            </Link>
          </div>
          {fatture.length === 0 ? (
            <p className="text-sm text-gray-400">{t.bolle.nessunaFatturaCollegata}</p>
          ) : (
            <div className="space-y-2">
              {fatture.map((f: any) => (
                <Link
                  key={f.id}
                  href={`/fatture/${f.id}`}
                  className="flex items-center justify-between py-2 text-sm hover:bg-gray-50 rounded px-2 -mx-2 transition-colors"
                >
                  <span className="text-gray-700">{formatDate(f.data)}</span>
                  {f.file_url && (
                    <span className="text-xs text-[#1a3050] font-medium">{t.bolle.allegatoLink}</span>
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
