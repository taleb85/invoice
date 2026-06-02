/** Tipi registrabili dal pulsante primario in AI Inbox (allineato a `finalizza_tipo`). */
export type InboxFinalizeKind =
  | 'fattura'
  | 'nota_credito'
  | 'comunicazione'
  | 'bolla'
  | 'listino'
  | 'statement'
  | 'ordine'

const INBOX_FINALIZE_KINDS = new Set<InboxFinalizeKind>([
  'fattura',
  'nota_credito',
  'comunicazione',
  'bolla',
  'listino',
  'statement',
  'ordine',
])

const INBOX_TIPO_TO_PENDING_KIND: Record<string, InboxFinalizeKind> = {
  fattura: 'fattura',
  invoice: 'fattura',
  tax_invoice: 'fattura',
  sales_invoice: 'fattura',
  nota_credito: 'nota_credito',
  credit_note: 'nota_credito',
  bolla: 'bolla',
  bolla_ddt: 'bolla',
  ddt: 'bolla',
  delivery_note: 'bolla',
  estratto_conto: 'statement',
  statement: 'statement',
  ordine: 'ordine',
  order: 'ordine',
  purchase_order: 'ordine',
  order_confirmation: 'ordine',
  listino: 'listino',
  price_list: 'listino',
  comunicazione: 'comunicazione',
  altro: 'comunicazione',
  other: 'comunicazione',
}

export function mapInboxTipoToPendingKind(rawTipo: string | null | undefined): InboxFinalizeKind | null {
  if (!rawTipo) return null
  const norm = String(rawTipo).toLowerCase().replace(/\s+/g, '_').trim()
  return INBOX_TIPO_TO_PENDING_KIND[norm] ?? null
}

export function isInboxFinalizeKind(kind: string): kind is InboxFinalizeKind {
  return INBOX_FINALIZE_KINDS.has(kind as InboxFinalizeKind)
}

function docMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  return metadata as Record<string, unknown>
}

/** Suggerimento Gemini persistito in `metadata` dopo classificazione o reclassify. */
export function geminiSuggestionFromMetadata(
  docId: string,
  metadata: unknown,
): {
  doc_id: string
  tipo_suggerito: string
  fornitore_suggerito: string | null
  azione_consigliata: string
  confidenza: number
} | null {
  const meta = docMetadataRecord(metadata)
  const tipo = meta.ai_tipo_suggerito
  if (typeof tipo !== 'string' || !tipo.trim()) return null
  const confRaw = meta.ai_confidenza
  const confidenza =
    typeof confRaw === 'number' && Number.isFinite(confRaw)
      ? Math.min(1, Math.max(0, confRaw))
      : 0.5
  const forn =
    typeof meta.ai_fornitore_suggerito === 'string'
      ? meta.ai_fornitore_suggerito
      : typeof meta.fornitore_suggerito === 'string'
        ? meta.fornitore_suggerito
        : null
  const azione =
    typeof meta.ai_azione_consigliata === 'string'
      ? meta.ai_azione_consigliata
      : typeof meta.azione_consigliata === 'string'
        ? meta.azione_consigliata
        : ''
  return {
    doc_id: docId,
    tipo_suggerito: tipo.trim(),
    fornitore_suggerito: forn,
    azione_consigliata: azione,
    confidenza,
  }
}

/**
 * Categoria da usare per etichetta e azione del pulsante primario:
 * 1) suggerimento sessione (ultima analisi), 2) metadata AI, 3) `pending_kind` in coda.
 */
export function resolveInboxSuggestedKind(
  metadata: unknown,
  sessionTipoSuggerito?: string | null,
): InboxFinalizeKind | null {
  if (sessionTipoSuggerito) {
    const fromSession = mapInboxTipoToPendingKind(sessionTipoSuggerito)
    if (fromSession) return fromSession
  }
  const meta = docMetadataRecord(metadata)
  const fromAi = mapInboxTipoToPendingKind(
    typeof meta.ai_tipo_suggerito === 'string' ? meta.ai_tipo_suggerito : null,
  )
  if (fromAi) return fromAi
  const pk = meta.pending_kind
  if (typeof pk === 'string' && isInboxFinalizeKind(pk)) return pk
  return null
}

export type InboxDocTypeKind = InboxFinalizeKind | 'da_determinare'

/**
 * Tipo documento da mostrare in coda (badge): suggerimento AI/sessione, poi OCR/metadata, infine «da determinare».
 */
export function resolveInboxDocTypeKind(
  metadata: unknown,
  sessionTipoSuggerito?: string | null,
): InboxDocTypeKind {
  const suggested = resolveInboxSuggestedKind(metadata, sessionTipoSuggerito)
  if (suggested) return suggested

  const meta = docMetadataRecord(metadata)
  const fromTipoDoc = mapInboxTipoToPendingKind(
    typeof meta.tipo_documento === 'string' ? meta.tipo_documento : null,
  )
  if (fromTipoDoc) return fromTipoDoc

  const pk = meta.pending_kind
  if (typeof pk === 'string' && isInboxFinalizeKind(pk)) return pk

  return 'da_determinare'
}
