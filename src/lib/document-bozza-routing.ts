/** Oggetto mail tipico degli estratti conto (allineato alla scansione in scan-emails). */
export function emailSubjectLooksLikeStatement(subject: string | null | undefined): boolean {
  const s = (subject ?? '').toLowerCase()
  if (!s.trim()) return false
  return (
    s.includes('statement') ||
    s.includes('account statement') ||
    s.includes('estratto conto') ||
    s.includes('estratto mensile') ||
    /\bestratto\b/.test(s) ||
    /\brelevé\b/.test(s) ||
    /relevé\s+de\s+compte/.test(s) ||
    /kontoauszug/.test(s) ||
    /\bauszug\b/.test(s)
  )
}

/**
 * Heuristics for email-scan bolla vs fattura bozza when OCR `tipo_documento`
 * is missing, wrong, or the model returns free-text (e.g. "Tax invoice").
 */

export function scanContextSuggestsFattura(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase()
  if (!blob.trim()) return false
  return (
    /\bfattura\b/.test(blob) ||
    /\binvoice\b/.test(blob) ||
    /\bfacture\b/.test(blob) ||
    /\bfactura\b/.test(blob) ||
    /\brechnung\b/.test(blob) ||
    /nota\s+credito/.test(blob) ||
    /credit[\s_-]?note/.test(blob) ||
    /\btax[\s_-]?invoice\b/.test(blob) ||
    /\bvat[\s_-]?invoice\b/.test(blob) ||
    /\bsales[\s_-]?invoice\b/.test(blob)
  )
}

export function scanContextSuggestsBolla(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase()
  if (!blob.trim()) return false
  return (
    /\bddt\b/.test(blob) ||
    /\bbolla\b/.test(blob) ||
    /delivery[\s_-]?note/.test(blob) ||
    /\blieferschein\b/.test(blob) ||
    /documento[\s_-]?di[\s_-]?trasporto/.test(blob) ||
    /albar[aá]n/.test(blob) ||
    /bon\s+de\s+livraison/.test(blob)
  )
}
