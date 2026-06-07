/**
 * C Carnevale / J&G Italian Food: "Sales Delivery Note" numbers are SDN###### — never tax invoices.
 * OCR often misreads them as fattura because the PDF shows "Invoice To" / "Invoice Total".
 */
export function numeroLooksLikeSalesDeliveryNoteReference(num: string | null | undefined): boolean {
  if (!num?.trim()) return false
  const compact = num.trim().replace(/\s+/g, '').toUpperCase()
  return /^SDN\d{5,10}$/.test(compact)
}
