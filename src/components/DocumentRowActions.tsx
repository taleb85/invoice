'use client'

import type { ReactNode } from 'react'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import DocumentActionsButton from '@/components/DocumentActionsButton'
import type { DocumentActionItem } from '@/components/DocumentActionsModal'
import { useT } from '@/lib/use-t'

/** Pill cyan condiviso: «View document» + icona azioni nelle colonne tabella. */
export const TABLE_DOCUMENT_ACTION_PILL =
  'inline-flex items-center gap-1 rounded-lg border border-app-line-30 bg-app-line-10 px-2 py-1 text-[10px] font-semibold text-app-fg-muted transition-colors hover:bg-app-line-20 touch-manipulation'

function defaultViewIcon(className?: string) {
  return (
    <svg className={className ?? 'h-3 w-3'} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}

function entityIdsFromItem(item: DocumentActionItem) {
  switch (item.origine) {
    case 'bolla':
    case 'bolla_aperta':
      return { bollaId: item.id }
    case 'fattura':
      return { fatturaId: item.id }
    case 'documento_da_processare':
      return { documentoId: item.id }
    case 'riga_statement':
    case 'statement':
    case 'statement_inbox':
      return { statementId: item.id }
    default:
      return {}
  }
}

type Props = {
  item: DocumentActionItem
  bollaId?: string
  fatturaId?: string
  documentoId?: string
  statementId?: string
  confermaOrdineId?: string
  fileUrl?: string | null
  fornitoreId?: string | null
  categoria?: string
  readOnly?: boolean
  viewLabel?: string
  viewIcon?: ReactNode
  className?: string
  stopTriggerPropagation?: boolean
  actionsButtonClassName?: string
  /** ID HTML sul pulsante "View document" per accesso programmatico. */
  docButtonId?: string
  /** Nodi extra tra «View document» e il pulsante azioni (es. rimuovi duplicato). */
  beforeActions?: ReactNode
  /** Nasconde il menu azioni documento (es. conferme ordine senza origine dedicata). */
  hideViewButton?: boolean
  hideActionsButton?: boolean
  /** Solo icona per «Vedi documento» (tabelle compatte). */
  iconOnly?: boolean
}

export function DocumentRowActions({
  item,
  bollaId,
  fatturaId,
  documentoId,
  statementId,
  confermaOrdineId,
  fileUrl,
  fornitoreId,
  categoria,
  readOnly,
  viewLabel,
  viewIcon,
  className = 'flex items-center justify-end gap-1.5 whitespace-nowrap',
  stopTriggerPropagation = true,
  actionsButtonClassName = 'h-7 w-7 touch-manipulation',
  docButtonId,
  beforeActions,
  hideActionsButton,
  hideViewButton,
  iconOnly = false,
}: Props) {
  const t = useT()
  const url = (fileUrl ?? item.file_url)?.trim() || null
  const label = viewLabel ?? t.bolle.viewDocument
  const derived = entityIdsFromItem(item)
  const ids = {
    bollaId: bollaId ?? derived.bollaId,
    fatturaId: fatturaId ?? derived.fatturaId,
    documentoId: documentoId ?? derived.documentoId,
    statementId: statementId ?? derived.statementId,
    confermaOrdineId,
  }

  return (
    <div
      className={className}
      {...(stopTriggerPropagation ? { onClick: (e: React.MouseEvent) => e.stopPropagation() } : {})}
    >
      {url && !hideViewButton ? (
        <OpenDocumentInAppButton
          {...ids}
          fileUrl={url}
          fornitoreId={fornitoreId ?? item.fornitore_id ?? null}
          documentActionsItem={item}
          stopTriggerPropagation={stopTriggerPropagation}
          buttonId={docButtonId}
          className={
            iconOnly
              ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-app-line-30 bg-app-line-10 text-app-fg-muted transition-colors hover:bg-app-line-20 touch-manipulation'
              : TABLE_DOCUMENT_ACTION_PILL
          }
          title={label}
          aria-label={iconOnly ? label : undefined}
          categoria={categoria}
        >
          {viewIcon ?? defaultViewIcon(iconOnly ? 'h-3.5 w-3.5' : undefined)}
          {iconOnly ? null : label}
        </OpenDocumentInAppButton>
      ) : null}
      {beforeActions}
      {!readOnly && !hideActionsButton ? (
        <DocumentActionsButton item={item} className={actionsButtonClassName} />
      ) : null}
    </div>
  )
}
