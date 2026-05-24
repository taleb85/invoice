import type { PendingKind } from './types'

const MAPPA_PENDING_KIND_TIPO_DOC: Record<PendingKind, string> = {
  da_determinare: 'documento_generico',
  fattura: 'fattura',
  bolla: 'bolla',
  nota_credito: 'nota_credito',
  statement: 'statement',
  ordine: 'ordine',
  comunicazione: 'comunicazione',
  listino: 'listino',
}

const MAPPA_TIPO_DOC_PENDING_KIND: Record<string, PendingKind> = {
  fattura: 'fattura',
  bolla: 'bolla',
  nota_credito: 'nota_credito',
  statement: 'statement',
  ordine: 'ordine',
  comunicazione: 'comunicazione',
  listino: 'listino',
}

export function pendingKindDaTipoDocumento(tipo: string): PendingKind {
  return MAPPA_TIPO_DOC_PENDING_KIND[tipo] || 'da_determinare'
}

export function tipoDocumentoDaPendingKind(kind: PendingKind): string {
  return MAPPA_PENDING_KIND_TIPO_DOC[kind] || 'documento_generico'
}

export type PrioritaLabels = {
  priorityCritical: string
  priorityHigh: string
  priorityMedium: string
  priorityLow: string
}

const DEFAULT_PRIORITA_LABELS: PrioritaLabels = {
  priorityCritical: 'Critica',
  priorityHigh: 'Alta',
  priorityMedium: 'Media',
  priorityLow: 'Bassa',
}

export function formattaPriorita(
  priorita: number,
  labels: PrioritaLabels = DEFAULT_PRIORITA_LABELS,
): { label: string; colore: string } {
  if (priorita <= 1) return { label: labels.priorityCritical, colore: 'text-red-600 bg-red-50' }
  if (priorita <= 2) return { label: labels.priorityHigh, colore: 'text-orange-600 bg-orange-50' }
  if (priorita <= 3) return { label: labels.priorityMedium, colore: 'text-yellow-600 bg-yellow-50' }
  return { label: labels.priorityLow, colore: 'text-gray-600 bg-gray-50' }
}

export function labelPendingKind(kind: string): string {
  const labelMap: Record<string, string> = {
    da_determinare: 'Da determinare',
    fattura: 'Fattura',
    bolla: 'Bolla di consegna',
    nota_credito: 'Nota di credito',
    statement: 'Estratto conto',
    ordine: 'Ordine',
    comunicazione: 'Comunicazione',
    listino: 'Listino prezzi',
  }
  return labelMap[kind] || kind
}
