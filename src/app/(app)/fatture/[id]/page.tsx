import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale'
import ReplaceFileButton from './ReplaceFileButton'

async function getFattura(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fatture')
    .select('*, fornitore:fornitori(nome, email, piva), bolla:bolle(id, data, stato)')
    .eq('id', id)
    .single()
  return data
}

export default async function FatturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [fattura, t, locale, tz] = await Promise.all([getFattura(id), getT(), getLocale(), getTimezone()])
  if (!fattura) notFound()
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/fatture" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.fatture.invoice} – {fattura.fornitore?.nome}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(fattura.data)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">{t.fatture.dettaglio}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-28 shrink-0">{t.common.supplier}</dt>
              <dd className="font-medium text-gray-900">{fattura.fornitore?.nome}</dd>
            </div>
            {fattura.fornitore?.email && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">{t.fornitori.email}</dt>
                <dd className="text-gray-700">{fattura.fornitore.email}</dd>
              </div>
            )}
            {fattura.fornitore?.piva && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">{t.fornitori.piva}</dt>
                <dd className="text-gray-700">{fattura.fornitore.piva}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-500 w-28 shrink-0">{t.common.date}</dt>
              <dd className="text-gray-700">{formatDate(fattura.data)}</dd>
            </div>
            {fattura.bolla && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">{t.fatture.bollaCollegata}</dt>
                <dd>
                  <Link href={`/bolle/${fattura.bolla.id}`} className="text-accent hover:text-accent font-medium">
                    {formatDate(fattura.bolla.data)} →
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">{t.common.attachment}</h2>
          {fattura.file_url ? (
            <a
              href={fattura.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-accent hover:text-accent font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {t.common.openAttachment}
            </a>
          ) : (
            <p className="text-sm text-gray-400">Nessun allegato</p>
          )}
          <ReplaceFileButton fatturaId={fattura.id} />
        </div>
      </div>
    </div>
  )
}
