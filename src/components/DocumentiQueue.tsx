'use client'

import Link from 'next/link'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'

export interface DocumentoInCoda {
  id: string
  created_at: string
  /** ISO date from the document itself — null when OCR couldn't read it. */
  data_documento: string | null
  file_url: string | null
  stato: 'in_attesa' | 'da_associare'
  fornitore_id: string | null
}

interface FornitoreRef {
  id: string
  nome: string
}

interface Props {
  documenti: DocumentoInCoda[]
  fornitori: FornitoreRef[]
  /** Pre-formatted dates (server locale/tz already applied). */
  formattedDates: Record<string, string>
  /** Localised strings so the component stays locale-agnostic. */
  labels: {
    sectionTitle: string        // "Documenti in coda"
    sectionSubtitle: string     // "da elaborare o da associare"
    unknownSender: string       // "Mittente sconosciuto"
    statusInAttesa: string      // "In attesa"
    statusDaAssociare: string   // "Da associare"
    openDoc: string             // "Documento"
    linkStatements: string      // "Associa →"
    noQueue: string             // "Nessun documento in attesa"
    noQueueHint: string         // "I documenti ricevuti via email appariranno qui."
    receivedOn: string          // "Ricevuto:"
    docDate: string             // "Data doc:"
  }
}

/**
 * Renders the full `documenti_da_processare` queue — both supplier-matched
 * and unmatched (fornitore_id = null) documents.
 *
 * Designed to be wrapped in an ErrorBoundary by the parent:
 *
 * ```tsx
 * <ErrorBoundary sectionName="documenti da elaborare">
 *   <DocumentiQueue ... />
 * </ErrorBoundary>
 * ```
 *
 * Accepts pre-formatted dates from the server component so it stays
 * a pure render client component without its own data fetching.
 */
export default function DocumentiQueue({ documenti, fornitori, formattedDates, labels }: Props) {
  if (documenti.length === 0) {
    return (
      <div className="app-card overflow-hidden">
        <div className="app-card-bar" aria-hidden />
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-line-25 bg-app-line-10/50">
            <svg className="h-5 w-5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-app-fg">{labels.noQueue}</p>
          <p className="text-xs text-app-fg-muted">{labels.noQueueHint}</p>
        </div>
      </div>
    )
  }

  const fornitoreMap = new Map(fornitori.map((f) => [f.id, f.nome]))

  /* Group: known suppliers first (sorted by name), then unmatched at the end */
  type Group = { key: string | null; nome: string; docs: DocumentoInCoda[] }
  const groups = new Map<string | null, Group>()

  for (const doc of documenti) {
    const key = doc.fornitore_id ?? null
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        nome: key ? (fornitoreMap.get(key) ?? key) : labels.unknownSender,
        docs: [],
      })
    }
    groups.get(key)!.docs.push(doc)
  }

  /* Sort: named groups alphabetically, unknown-sender group last */
  const sorted = [...groups.values()].sort((a, b) => {
    if (a.key === null) return 1
    if (b.key === null) return -1
    return a.nome.localeCompare(b.nome)
  })

  return (
    <div className="app-card overflow-hidden">
      <div className="app-card-bar" aria-hidden />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-app-line-22 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-app-fg">{labels.sectionTitle}</h2>
          <p className="mt-0.5 text-xs text-app-fg-muted">{labels.sectionSubtitle}</p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-200">
          {documenti.length}
        </span>
      </div>

      {/* Groups */}
      <div className="divide-y divide-app-line-18">
        {sorted.map((group) => (
          <div key={group.key ?? '__unmatched__'} className="px-4 py-3">
            {/* Group label */}
            <div className="mb-2.5 flex items-center gap-2">
              {group.key ? (
                <Link
                  href={`/fornitori/${group.key}`}
                  className="text-[11px] font-bold uppercase tracking-wider text-app-cyan-500 hover:underline"
                >
                  {group.nome}
                </Link>
              ) : (
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    {group.nome}
                  </span>
                </div>
              )}
              <span className="ml-auto shrink-0 rounded-full bg-app-line-15 px-1.5 py-0.5 text-[10px] font-semibold text-app-fg-muted">
                {group.docs.length}
              </span>
            </div>

            {/* Documents */}
            <div className="space-y-1.5">
              {group.docs.map((doc) => {
                const displayDate = doc.data_documento
                  ? (formattedDates[doc.data_documento] ?? doc.data_documento)
                  : (formattedDates[doc.created_at] ?? doc.created_at)
                const isUnmatched = doc.stato === 'da_associare' || !doc.fornitore_id

                return (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                      isUnmatched
                        ? 'border-amber-500/25 bg-amber-500/10'
                        : 'border-app-line-22 app-workspace-inset-bg-soft'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isUnmatched ? 'bg-amber-400' : 'bg-sky-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="whitespace-nowrap text-sm font-medium text-app-fg-muted">
                          {displayDate}
                        </p>
                        {doc.data_documento && doc.data_documento !== doc.created_at && (
                          <p className="text-[10px] text-app-fg-muted/60">
                            {labels.receivedOn} {formattedDates[doc.created_at] ?? doc.created_at}
                          </p>
                        )}
                      </div>
                      <span
                        className={`whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                          doc.stato === 'da_associare'
                            ? 'border-sky-500/30 bg-sky-500/15 text-sky-200'
                            : 'border-amber-500/30 bg-amber-500/15 text-amber-200'
                        }`}
                      >
                        {doc.stato === 'da_associare' ? labels.statusDaAssociare : labels.statusInAttesa}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {doc.file_url && (
                        <OpenDocumentInAppButton
                          documentoId={doc.id}
                          fileUrl={doc.file_url}
                          className="text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted hover:underline"
                        >
                          {labels.openDoc}
                        </OpenDocumentInAppButton>
                      )}
                      <Link
                        href="/statements"
                        className="whitespace-nowrap text-[10px] font-semibold text-amber-300 hover:text-amber-200 hover:underline"
                      >
                        {labels.linkStatements}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
