import { inferPendingDocumentKindForQueueRow } from '@/lib/document-bozza-routing'

/** Tipi registrabili dal pulsante primario in AI Inbox (allineato a `finalizza_tipo`). */
export type InboxFinalizeKind =
  | 'fattura'
  | 'nota_credito'
  | 'comunicazione'
  | 'bolla'
  | 'listino'
  | 'statement'
  | 'ordine'

export type InboxDocRowContext = {
  file_name?: string | null
  oggetto_mail?: string | null
}

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
  sales_order: 'ordine',
  sales_order_confirmation: 'ordine',
  work_order: 'ordine',
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

function hasExplicitDocMetadata(meta: Record<string, unknown>): boolean {
  return !!(
    meta.tipo_documento != null ||
    meta.ocr_tipo != null ||
    meta.pending_kind != null ||
    meta.ai_tipo_suggerito != null ||
    (typeof meta.ragione_sociale === 'string' && meta.ragione_sociale.trim())
  )
}

function metadataForQueueInfer(metadata: Record<string, unknown>) {
  return {
    ragione_sociale:
      typeof metadata.ragione_sociale === 'string' ? metadata.ragione_sociale : null,
    note_corpo_mail:
      typeof metadata.note_corpo_mail === 'string' ? metadata.note_corpo_mail : null,
    tipo_documento: metadata.tipo_documento,
    ocr_tipo: metadata.ocr_tipo,
    numero_fattura:
      typeof metadata.numero_fattura === 'string' ? metadata.numero_fattura : null,
    totale_iva_inclusa:
      typeof metadata.totale_iva_inclusa === 'number' ? metadata.totale_iva_inclusa : null,
  }
}

/** Stessa euristica della coda fornitori / scan email (`inferPendingDocumentKindForQueueRow`). */
export function inferInboxKindFromDocument(
  metadata: unknown,
  ctx?: InboxDocRowContext,
): InboxFinalizeKind | null {
  const kind = inferPendingDocumentKindForQueueRow({
    oggetto_mail: ctx?.oggetto_mail,
    file_name: ctx?.file_name,
    metadata: metadataForQueueInfer(docMetadataRecord(metadata)),
  })
  if (!kind) return null
  return kind
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
 * Categoria per pulsante primario: prima contenuto documento (OCR/coda), poi sessione/AI,
 * così un vecchio `altro` non maschera un Sales Order letto nel PDF.
 */
export function resolveInboxSuggestedKind(
  metadata: unknown,
  sessionTipoSuggerito?: string | null,
  ctx?: InboxDocRowContext,
): InboxFinalizeKind | null {
  const fromDocument = inferInboxKindFromDocument(metadata, ctx)
  if (fromDocument === 'ordine') return 'ordine'
  if (fromDocument && fromDocument !== 'comunicazione') return fromDocument

  const sessionKind = sessionTipoSuggerito
    ? mapInboxTipoToPendingKind(sessionTipoSuggerito)
    : null
  if (sessionKind && sessionKind !== 'comunicazione') return sessionKind

  const meta = docMetadataRecord(metadata)
  const fromAi = mapInboxTipoToPendingKind(
    typeof meta.ai_tipo_suggerito === 'string' ? meta.ai_tipo_suggerito : null,
  )
  if (fromAi && fromAi !== 'comunicazione') return fromAi

  const pk = meta.pending_kind
  if (typeof pk === 'string' && isInboxFinalizeKind(pk) && pk !== 'comunicazione') return pk

  if (fromDocument && fromDocument !== 'comunicazione') return fromDocument
  if (sessionKind) return sessionKind
  if (fromAi) return fromAi
  if (typeof pk === 'string' && isInboxFinalizeKind(pk)) return pk
  if (fromDocument === 'comunicazione' && hasExplicitDocMetadata(meta)) return 'comunicazione'

  return null
}

export type InboxDocTypeKind = InboxFinalizeKind | 'da_determinare'

/** Badge tipo in lista: allineato a `resolveInboxSuggestedKind` + fallback «da determinare». */
export function resolveInboxDocTypeKind(
  metadata: unknown,
  sessionTipoSuggerito?: string | null,
  ctx?: InboxDocRowContext,
): InboxDocTypeKind {
  const suggested = resolveInboxSuggestedKind(metadata, sessionTipoSuggerito, ctx)
  if (suggested) return suggested
  return 'da_determinare'
}
