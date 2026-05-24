import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

/**
 * Converts an OCR `tipo_documento` value (raw or normalised) to a human-readable label.
 * Returns null for types that are implicit from context (e.g. bolla_ddt in the Bolle tab).
 */
export function tipoDocumentoToLabel(rawTipo: unknown): string | null {
  const t = normalizeTipoDocumento(rawTipo)
  switch (t) {
    case 'fattura': return 'Invoice'
    case 'nota_credito': return 'Credit Note'
    case 'ordine': return 'Order Confirmation'
    case 'estratto_conto': return 'Statement'
    default: return null
  }
}

/**
 * Extracts a human-readable document-type label from a free-text string
 * (title, filename, reference number, storage URL path, etc.).
 * Matches common keywords in English, Italian, French, German and Spanish.
 * Returns null when the type cannot be inferred.
 */
export function extractDocTypeLabel(
  ...sources: Array<string | null | undefined>
): string | null {
  const text = sources
    .map((s) => {
      if (!s) return ''
      // For storage URLs extract just the filename segment
      const seg = s.includes('/') ? (s.split('/').pop() ?? s) : s
      // Strip query-string (e.g. ?token=...) and extension
      return seg.split('?')[0]!.replace(/\.[a-z0-9]+$/i, '')
    })
    .join(' ')
    .toLowerCase()

  if (!text.trim()) return null

  if (/invoice|fattura|facture|rechnung|factura/.test(text)) return 'Invoice'
  if (/credit.note|nota.credito|note.de.crédit|gutschrift|nota.de.crédito/.test(text))
    return 'Credit Note'
  if (/delivery.note|ddt|bon.de.livraison|lieferschein|albar[aá]n/.test(text))
    return 'Delivery Note'
  if (
    /order.confirm|conferma.ordin|confirmation.de.commande|auftragsbestätigung|confirmaci/.test(text)
  )
    return 'Order Confirmation'
  if (/purchase.order|ordine.acquisto|bon.de.commande|bestellung|orden.de.compra/.test(text))
    return 'Purchase Order'
  if (/statement|estratto.conto|relevé.de.compte|kontoauszug|extracto/.test(text))
    return 'Statement'
  if (/receipt|ricevuta|reçu|quittung|recibo/.test(text)) return 'Receipt'
  if (/proforma|pro.forma/.test(text)) return 'Pro-forma Invoice'

  return null
}

/**
 * Splits a title into a short reference code (primary display) and a type label (secondary).
 * e.g. "Enotria Order Confirmation: SO1965613" → { primary: "SO1965613", secondary: "Order Confirmation" }
 */
export function splitDocTitleForDisplay(
  titolo: string | null,
  fileName: string | null,
): { primary: string; secondary: string | null } {
  const text = titolo?.trim() ?? ''
  const docType = extractDocTypeLabel(text)

  if (text && docType) {
    const refMatch = text.match(/\b([A-Z]{1,6}[-/]?\d{3,}|\d{4,})\b/gi)
    const ref = refMatch ? refMatch[refMatch.length - 1] : null
    if (ref) return { primary: ref, secondary: docType }
  }

  const secondaryFromFile = extractDocTypeLabel(fileName)
  return {
    primary: text || fileName || '—',
    secondary: secondaryFromFile,
  }
}
