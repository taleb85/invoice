import type { OcrResult } from '@/lib/ocr-invoice'
import { numeroLooksLikeUkAccountReference } from '@/lib/ocr-pdf-multi'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

export { numeroLooksLikeUkAccountReference }

/** Fornitore UK noto per PDF combinati estratto + fattura (Account No. ≠ Invoice No.). */
export function supplierNameLooksLikeEdenSprings(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase().replace(/\s+/g, ' ')
  return /\beden\s*springs\b/.test(n)
}

/**
 * L'OCR ha messo un Account No. (8–10 cifre) al posto del numero fattura fiscale.
 */
export function ocrAccountNumberMisusedAsInvoice(ocr: {
  tipo_documento: unknown
  numero_fattura: string | null | undefined
  segmenti_pdf?: OcrResult['segmenti_pdf']
}): boolean {
  if (normalizeTipoDocumento(ocr.tipo_documento) !== 'fattura') return false
  if (!numeroLooksLikeUkAccountReference(ocr.numero_fattura)) return false
  const realInvoice = ocr.segmenti_pdf?.find(
    (s) => s.tipo_documento === 'fattura' && !!s.numero_fattura?.trim(),
  )
  return !realInvoice
}

/**
 * Blocca auto-registrazione fattura da email quando il numero è solo un account reference.
 */
export function shouldSkipEmailAutoFattura(ocr: OcrResult): boolean {
  return ocrAccountNumberMisusedAsInvoice(ocr)
}

/** Numero fattura in DB che va azzerato (account UK usato per errore). */
export function fatturaNumeroIsMisusedUkAccount(
  numero: string | null | undefined,
  fornitoreNome: string | null | undefined,
): boolean {
  if (!numeroLooksLikeUkAccountReference(numero)) return false
  if (supplierNameLooksLikeEdenSprings(fornitoreNome)) return true
  return /^\d{9}$/.test(String(numero).replace(/\s/g, ''))
}
