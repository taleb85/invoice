/** Campi opzionali in `statements.extracted_pdf_dates` (jsonb). */
export type StatementExtractedPdfDates = {
  issued_date?: string | null
  last_payment_date?: string | null
}

export type StatementDateFields = {
  document_date?: string | null
  extracted_pdf_dates?: StatementExtractedPdfDates | null
}

/** Data «ufficiale» da mostrare in lista/dettaglio estratto conto. */
export function statementOfficialDateIso(s: StatementDateFields): string | null {
  const pdf = s.extracted_pdf_dates
  const issued = pdf?.issued_date?.trim()
  if (issued) return issued
  const lastPay = pdf?.last_payment_date?.trim()
  if (lastPay) return lastPay
  const docDate = s.document_date?.trim()
  if (docDate) return docDate
  return null
}

/** Valore da salvare in `statements.document_date` dopo OCR. */
export function resolveStatementDocumentDate(
  extractedPdfDates: StatementExtractedPdfDates | null | undefined,
  dataDocumento?: string | null,
): string | null {
  const issued = extractedPdfDates?.issued_date?.trim()
  if (issued) return issued
  const lastPay = extractedPdfDates?.last_payment_date?.trim()
  if (lastPay) return lastPay
  const fromDoc = dataDocumento?.trim()
  if (fromDoc) return fromDoc
  return null
}
