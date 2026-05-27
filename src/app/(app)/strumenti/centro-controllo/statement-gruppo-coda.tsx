'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ExternalLink, Loader2, Zap } from 'lucide-react'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import type { AiSuggestion, CodaItem, CommandId } from '@/lib/command-system/types'
import {
  countStatementRowsByStatus,
  formatStatementStatusCount,
  summarizeStatementGroup,
  statementStatusChipClass,
  worstPrioritaInGroup,
  type StatementCheckStatusKey,
  type StatementStatusCountLabels,
} from '@/lib/centro-controllo-coda-grouping'
import { formattaPriorita } from '@/lib/command-system/utils'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate } from '@/lib/locale'
import { interpolateTemplate } from '@/lib/interpolate-template'

type RigaDocumentoProps = {
  item: CodaItem
  sedeId: string | null
  suggerimento: AiSuggestion | null
  eseguendoId: string | null
  onEsegui: (item: CodaItem, commandId: CommandId) => void
  onConfermaSuggerimento: (item: CodaItem, commandId: CommandId) => void
  onRifiutaSuggerimento: (item: CodaItem, commandId: CommandId) => void
  onApriAzioni?: (item: CodaItem) => void
  nested?: boolean
}

type Props = {
  statementId: string
  items: CodaItem[]
  sedeId: string | null
  suggerimenti: Map<string, AiSuggestion>
  eseguendoId: string | null
  resolving: boolean
  onEsegui: (item: CodaItem, commandId: CommandId) => void
  onConfermaSuggerimento: (item: CodaItem, commandId: CommandId) => void
  onRifiutaSuggerimento: (item: CodaItem, commandId: CommandId) => void
  onApriAzioni?: (item: CodaItem) => void
  onResolveStatement: (
    statementId: string,
    fornitoreId: string,
    items: CodaItem[],
  ) => Promise<{ remaining: number } | void>
  RigaDocumento: React.ComponentType<RigaDocumentoProps>
}

const STATUS_ORDER: StatementCheckStatusKey[] = [
  'errore_importo',
  'fattura_mancante',
  'rekki_prezzo_discordanza',
  'bolle_mancanti',
  'pending',
  'other',
]

const MAX_REFS_SHOWN = 4

export default function StatementGruppoCoda({
  statementId,
  items,
  sedeId,
  suggerimenti,
  eseguendoId,
  resolving,
  onEsegui,
  onConfermaSuggerimento,
  onRifiutaSuggerimento,
  onApriAzioni,
  onResolveStatement,
  RigaDocumento,
}: Props) {
  const t = useT()
  const tc = t.strumentiCentroControllo
  const { locale, timezone } = useLocale()
  const [expanded, setExpanded] = useState(false)

  const fornitoreNome = items[0]?.fornitore_nome ?? tc.badgeStatement
  const fornitoreId = items[0]?.fornitore_id
  const priorita = formattaPriorita(worstPrioritaInGroup(items), {
    priorityCritical: tc.priorityCritical,
    priorityHigh: tc.priorityHigh,
    priorityMedium: tc.priorityMedium,
    priorityLow: tc.priorityLow,
  })

  const summary = useMemo(() => summarizeStatementGroup(items), [items])
  const statusCounts = useMemo(() => countStatementRowsByStatus(items), [items])

  const statusLabels: StatementStatusCountLabels = useMemo(
    () => ({
      fattura_mancante: {
        one: tc.queueStatementStatusFatturaMancanteOne,
        many: tc.queueStatementStatusFatturaMancanteMany,
      },
      bolle_mancanti: {
        one: tc.queueStatementStatusBolleMancantiOne,
        many: tc.queueStatementStatusBolleMancantiMany,
      },
      errore_importo: {
        one: tc.queueStatementStatusErroreImportoOne,
        many: tc.queueStatementStatusErroreImportoMany,
      },
      rekki_prezzo_discordanza: {
        one: tc.queueStatementStatusRekkiOne,
        many: tc.queueStatementStatusRekkiMany,
      },
      pending: {
        one: tc.queueStatementStatusPendingOne,
        many: tc.queueStatementStatusPendingMany,
      },
      other: {
        one: tc.queueStatementStatusOtherOne,
        many: tc.queueStatementStatusOtherMany,
      },
    }),
    [tc],
  )

  const statusChips = useMemo(() => {
    return STATUS_ORDER.flatMap((key) => {
      const n = statusCounts[key]
      if (!n || n <= 0) return []
      return [
        {
          key,
          label: formatStatementStatusCount(n, key, statusLabels),
        },
      ]
    })
  }, [statusCounts, statusLabels])

  const totalFormatted =
    summary.totalImporto != null
      ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(summary.totalImporto)
      : null

  const docDateLabel = useMemo(() => {
    if (!summary.docDateFrom) return null
    const from = formatDate(summary.docDateFrom, locale, timezone)
    if (!summary.docDateTo || summary.docDateTo === summary.docDateFrom) {
      return from
    }
    const to = formatDate(summary.docDateTo, locale, timezone)
    return `${from} – ${to}`
  }, [summary.docDateFrom, summary.docDateTo, locale, timezone])

  const refsLabel = useMemo(() => {
    if (summary.numeriDoc.length === 0) return null
    const shown = summary.numeriDoc.slice(0, MAX_REFS_SHOWN)
    const rest = summary.numeriDoc.length - shown.length
    const list = shown.join(', ')
    if (rest > 0) {
      return `${list} ${interpolateTemplate(tc.queueStatementGroupRefsMore, { n: rest }, `+${rest}`)}`
    }
    return list
  }, [summary.numeriDoc, tc.queueStatementGroupRefsMore])

  const metaParts = useMemo(() => {
    const parts: string[] = [
      interpolateTemplate(tc.queueStatementGroupRows, { n: items.length }, `${items.length} rows`),
    ]
    if (totalFormatted) {
      parts.push(interpolateTemplate(tc.queueStatementGroupTotal, { amount: totalFormatted }, totalFormatted))
    }
    return parts.join(' · ')
  }, [items.length, totalFormatted, tc])

  return (
    <div className="app-card overflow-hidden">
      <div className={`app-card-bar-accent ${priorita.colore.split(' ')[0].replace('text-', 'bg-')}`} aria-hidden />
      <div className="space-y-3 p-3 md:p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start gap-2 text-left"
          aria-expanded={expanded}
        >
          <ChevronRight
            className={`mt-1 h-4 w-4 shrink-0 text-app-fg-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${priorita.colore}`}>
                {priorita.label}
              </span>
              <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300">
                {tc.badgeStatement}
              </span>
            </div>
            <p className="text-sm font-semibold leading-snug text-app-fg" title={fornitoreNome}>
              {fornitoreNome}
            </p>
            <p className="text-xs text-app-fg-muted">{metaParts}</p>
            {docDateLabel && (
              <p className="text-[11px] text-app-fg-muted/80">
                {interpolateTemplate(
                  tc.queueStatementGroupDocDates,
                  { range: docDateLabel },
                  docDateLabel,
                )}
              </p>
            )}
            {refsLabel && (
              <p className="text-[11px] font-mono text-app-fg-muted/70 truncate" title={summary.numeriDoc.join(', ')}>
                {interpolateTemplate(tc.queueStatementGroupRefs, { list: refsLabel }, refsLabel)}
              </p>
            )}
            {statusChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {statusChips.map(({ key, label }) => (
                  <span
                    key={key}
                    className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${statementStatusChipClass(key)}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>

        <div className="flex flex-col gap-2 border-t border-app-line-10 pt-3 sm:flex-row sm:items-center sm:justify-end">
          <OpenDocumentInAppButton
            statementId={statementId}
            fileUrl={null}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-app-line-15 hover:text-sky-200 sm:w-auto"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {tc.queueStatementGroupOpen}
          </OpenDocumentInAppButton>
            {fornitoreId && (
              <button
                type="button"
                disabled={resolving || !sedeId}
                title={tc.queueStatementGroupResolveHint}
                onClick={async () => {
                  const result = await onResolveStatement(statementId, fornitoreId, items)
                  if (result && result.remaining > 0) setExpanded(true)
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:opacity-50 sm:w-auto"
              >
              {resolving ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 shrink-0" />
              )}
              {resolving ? tc.queueStatementGroupResolving : tc.queueStatementGroupResolve}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-app-line-10 bg-black/10">
          {items.map((item) => (
            <RigaDocumento
              key={item.id}
              item={item}
              sedeId={sedeId}
              suggerimento={suggerimenti.get(item.id) ?? null}
              eseguendoId={eseguendoId}
              onEsegui={onEsegui}
              onConfermaSuggerimento={onConfermaSuggerimento}
              onRifiutaSuggerimento={onRifiutaSuggerimento}
              onApriAzioni={onApriAzioni}
              nested
            />
          ))}
        </div>
      )}
    </div>
  )
}
