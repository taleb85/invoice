/**
 * Parsing importi da stringhe (client-safe — nessuna dipendenza server).
 * Usato da UI e da {@link ocr-invoice}.
 */
export function parseAnyAmount(s: string): number | null {
  if (!s) return null
  const cleaned = s.replace(/[£€$¥₹CHFkr\s]/g, '').trim()
  if (!cleaned) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized: string

  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, '')
  } else {
    normalized = cleaned.replace(/,/g, '')
  }

  const n = parseFloat(normalized)
  return isNaN(n) ? null : n
}
