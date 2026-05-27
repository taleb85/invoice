'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ExternalLink, Loader2, Zap } from 'lucide-react'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import type { AiSuggestion, CodaItem, CommandId } from '@/lib/command-system/types'
import {
  countStatementRowsByStatus,
  worstPrioritaInGroup,
  type StatementCheckStatusKey,
} from '@/lib/centro-controllo-coda-grouping'
import { formattaPriorita } from '@/lib/command-system/utils'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate } from '@/lib/locale'
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
  onResolveStatement: (statementId: string, fornitoreId: string) => void
  RigaDocumento: React.ComponentType<RigaDocumentoProps>
}

type CentroControlloStrings = {
  queueStatementStatusFatturaMancante: string
  queueStatementStatusBolleMancanti: string
  queueStatementStatusErroreImporto: string
  queueStatementStatusRekki: string
  queueStatementStatusPending: string
  queueStatementStatusOther: string
}

function statusLabel(key: StatementCheckStatusKey, t: CentroControlloStrings): string {
  switch (key) {
    case 'fattura_mancante':
      return t.queueStatementStatusFatturaMancante
    case 'bolle_mancanti':
      return t.queueStatementStatusBolleMancanti
    case 'errore_importo':
      return t.queueStatementStatusErroreImporto
    case 'rekki_prezzo_discordanza':
      return t.queueStatementStatusRekki
    case 'pending':
      return t.queueStatementStatusPending
    default:
      return t.queueStatementStatusOther
  }
}

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

  const statusCounts = useMemo(() => countStatementRowsByStatus(items), [items])

  const statusSummary = useMemo(() => {
    const parts: string[] = []
    for (const key of [
      'errore_importo',
      'fattura_mancante',
      'rekki_prezzo_discordanza',
      'bolle_mancanti',
      'pending',
      'other',
    ] as const) {
      const n = statusCounts[key]
      if (n && n > 0) parts.push(`${n} ${statusLabel(key, tc)}`)
    }
    return parts.join(' · ')
  }, [statusCounts, tc])

  const dateLabel = useMemo(() => {
    const dates = [...new Set(items.map((i) => i.data_doc).filter(Boolean))] as string[]
    if (dates.length === 0) return null
    if (dates.length === 1) return formatDate(dates[0], locale, timezone)
    const sorted = [...dates].sort()
    return `${formatDate(sorted[0], locale, timezone)} – ${formatDate(sorted[sorted.length - 1], locale, timezone)}`
  }, [items, locale, timezone])

  return (
    <div className="app-card overflow-hidden">
      <div className={`app-card-bar-accent ${priorita.colore.split(' ')[0].replace('text-', 'bg-')}`} aria-hidden />
      <div className="p-3 md:p-4">
        <div className="flex flex-wrap items-start gap-2 gap-y-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
            aria-expanded={expanded}
          >
            <ChevronRight
              className={`mt-0.5 h-4 w-4 shrink-0 text-app-fg-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${priorita.colore}`}>
                  {priorita.label}
                </span>
                <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300">
                  {tc.badgeStatement}
                </span>
              </div>
              <p className="text-sm font-semibold text-app-fg truncate" title={fornitoreNome}>
                {fornitoreNome}
              </p>
              <p className="text-xs text-app-fg-muted mt-0.5">
                {tc.queueStatementGroupRows.replace('{n}', String(items.length))}
                {dateLabel ? ` · ${dateLabel}` : ''}
              </p>
              {statusSummary && (
                <p className="text-[11px] text-app-fg-muted/80 mt-1">{statusSummary}</p>
              )}
            </div>
          </button>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:ml-auto">
            <OpenDocumentInAppButton
              statementId={statementId}
              fileUrl={null}
              className="inline-flex items-center gap-1 rounded-lg border border-app-line-22 bg-app-line-10/50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 transition-colors hover:bg-app-line-15 hover:text-sky-200"
            >
              <ExternalLink className="h-3 w-3" />
              {tc.queueStatementGroupOpen}
            </OpenDocumentInAppButton>
            {fornitoreId && (
              <button
                type="button"
                disabled={resolving || !sedeId}
                onClick={() => onResolveStatement(statementId, fornitoreId)}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:opacity-50"
              >
                {resolving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {resolving ? tc.queueStatementGroupResolving : tc.queueStatementGroupResolve}
              </button>
            )}
          </div>
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
