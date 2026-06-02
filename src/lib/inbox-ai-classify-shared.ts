/** Tipi e helper condivisi tra client Inbox AI e API server (nessuna dipendenza server-only). */

export type GeminiInboxClassification = {
  doc_id: string
  tipo_suggerito: string
  fornitore_suggerito: string | null
  azione_consigliata: string
  confidenza: number
  error?: string
}

/** Soglia per scarto automatico di documenti classificati come `altro`. */
export const GEMINI_AUTO_DISCARD_ALTRIO_MIN_CONF = 0.9

function clamp01InboxLike(n: unknown): number {
  const x = typeof n === 'number' ? n : parseFloat(String(n))
  if (!Number.isFinite(x)) return 0.5
  return Math.min(1, Math.max(0, x))
}

/**
 * Suggerisce di scartare la riga dall’AI Inbox senza revisione umana: contenuto dichiarato
 * non pertinente alla contabilità (CV, memo, ecc.) con confidenza sufficiente.
 */
export function inboxClassificationShouldAutoDiscard(
  suggestion: GeminiInboxClassification,
): boolean {
  if (suggestion.error) return false
  const tipo = (suggestion.tipo_suggerito ?? '').toLowerCase().trim()
  if (tipo !== 'altro') return false
  const c = clamp01InboxLike(suggestion.confidenza)
  return c >= GEMINI_AUTO_DISCARD_ALTRIO_MIN_CONF
}
