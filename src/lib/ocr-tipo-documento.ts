/**
 * Normalizza `tipo_documento` da OCR / metadata (solo stringhe, nessuna dipendenza server).
 * Usato da client e da scan email senza trascinare `ocr-invoice` + vision.
 */
export function normalizeTipoDocumento(raw: unknown): 'fattura' | 'bolla' | 'altro' | null {
  if (raw == null || raw === '') return null
  const s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim()

  if (s === 'fattura' || s === 'invoice' || s === 'nota_credito' || s === 'credito' || s === 'credit_note') return 'fattura'
  if (s === 'bolla' || s === 'ddt' || s === 'delivery' || s === 'delivery_note' || s === 'lieferschein' || s === 'albaran') return 'bolla'
  if (
    s === 'altro' ||
    s === 'other' ||
    s === 'ordine' ||
    s === 'purchase_order' ||
    s === 'po' ||
    s === 'estratto_conto' ||
    s === 'estratto' ||
    s === 'statement' ||
    s === 'account_statement'
  ) {
    return 'altro'
  }

  if (
    /\bfattura\b/.test(s) ||
    /\binvoice\b/.test(s) ||
    /\bfacture\b/.test(s) ||
    /\bfactura\b/.test(s) ||
    /\brechnung\b/.test(s) ||
    /nota\s+credito/.test(s) ||
    /credit[\s_-]?note/.test(s) ||
    /\bavoir\b/.test(s) ||
    /\bgutschrift\b/.test(s) ||
    /\btax[\s_-]?invoice\b/.test(s) ||
    /\bvat[\s_-]?invoice\b/.test(s) ||
    /\bsales[\s_-]?invoice\b/.test(s)
  ) {
    return 'fattura'
  }
  if (
    /\bddt\b/.test(s) ||
    /\bbolla\b/.test(s) ||
    /delivery[\s_-]?note/.test(s) ||
    /\blieferschein\b/.test(s) ||
    /albar[aá]n/.test(s) ||
    /bon\s+de\s+livraison/.test(s) ||
    /documento\s+di\s+trasporto/.test(s)
  ) {
    return 'bolla'
  }
  if (/preventivo|quotation|\bquote\b|pro[\s_-]?forma|order\s+confirmation|\bordine\b/.test(s)) {
    return 'altro'
  }
  return null
}
