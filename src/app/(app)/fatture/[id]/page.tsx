import Link from 'next/link'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { getFatturaForViewer } from '@/lib/supabase-detail-for-viewer'
import DocumentUnavailable from '@/components/DocumentUnavailable'
import { getT, getLocale, getTimezone, formatDate as fmtDate } from '@/lib/locale-server'
import { fornitoreNomeMaiuscolo } from '@/lib/fornitore-display'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import ReplaceFileButton from './ReplaceFileButton'
export default async function FatturaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [fattura, t, locale, tz] = await Promise.all([
    getFatturaForViewer(id),
    getT(),
    getLocale(),
    getTimezone(),
  ])
  if (!fattura) return <DocumentUnavailable kind="fattura" />
  const formatDate = (d: string) => fmtDate(d, locale, tz)

  return (
    <div className="max-w-2xl app-shell-page-padding">
      <AppPageHeaderStrip accent="emerald" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Link
            href="/fatture"
            className="mt-1 shrink-0 text-app-fg-muted transition-colors hover:text-app-fg"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="app-page-title text-2xl font-bold">
              {t.fatture.invoice} – {fornitoreNomeMaiuscolo(fattura.fornitore?.nome)}
            </h1>
            <p className="mt-0.5 text-sm text-app-fg-muted">{formatDate(fattura.data)}</p>
          </div>
        </div>
      </AppPageHeaderStrip>

      <div className="space-y-4">
        <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-app-fg">{t.fatture.dettaglio}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.supplier}</dt>
              <dd className="font-medium text-app-fg">{fornitoreNomeMaiuscolo(fattura.fornitore?.nome)}</dd>
            </div>
            {fattura.fornitore?.email && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fornitori.email}</dt>
                <dd className="text-app-fg-muted">{fattura.fornitore.email}</dd>
              </div>
            )}
            {fattura.fornitore?.piva && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fornitori.piva}</dt>
                <dd className="text-app-fg-muted">{fattura.fornitore.piva}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.date}</dt>
              <dd className="text-app-fg-muted">{formatDate(fattura.data)}</dd>
            </div>
            {fattura.bolla && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fatture.bollaCollegata}</dt>
                <dd>
                  <Link href={`/bolle/${fattura.bolla.id}`} className="font-medium text-app-cyan-500 transition-colors hover:text-app-fg-muted">
                    {formatDate(fattura.bolla.data)} →
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          </div>
        </div>

        <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="p-6">
          <h2 className="mb-3 text-sm font-semibold text-app-fg">{t.common.attachment}</h2>
          {fattura.file_url ? (
            <OpenDocumentInAppButton
              fatturaId={fattura.id}
              fileUrl={fattura.file_url}
              className="flex items-center gap-2 text-sm font-medium text-app-cyan-500 transition-colors hover:text-app-fg-muted"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {t.common.openAttachment}
            </OpenDocumentInAppButton>
          ) : (
            <p className="text-sm text-app-fg-muted">Nessun allegato</p>
          )}
          <ReplaceFileButton fatturaId={fattura.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
