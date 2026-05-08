/**
 * Normalizza `tipo_documento` da OCR / metadata (solo stringhe, nessuna dipendenza server).
 * Usato da client e da scan email senza trascinare `ocr-invoice` + vision.
 * `curriculum` = CV / résumé — non va in coda fatture/bolle.
 */
export type NormalizedTipoDocumento =
  | 'fattura'
  | 'nota_credito'
  | 'bolla'
  | 'listino'
  | 'altro'
  | 'curriculum'
  | 'comunicazione_cliente'
  | null

/**
 * Salvataggio automatico come riga `fatture` dalla scansione email: solo se l’OCR classifica
 * esplicitamente una fattura. Oggetto/file che “sembrano” fattura ma `tipo_documento` null
 * o altro → restano in coda manuale (evita DDT/comunicazioni registrati come fattura).
 * Eccezione: scan con filtro documentKind=fattura (`docKind === 'fattura'`) può aggirare il controllo.
 */
export function ocrTipoAllowsEmailAutoFattura(tipoRaw: unknown): boolean {
  return normalizeTipoDocumento(tipoRaw) === 'fattura'
}

/**
 * Controllo post-OCR: il modello ha classificato il documento come "fattura" ma i dati
 * estratti non hanno le caratteristiche minime di una fattura (né numero documento né importo).
 * In questo caso è probabile una classificazione errata (es. comunicazione cliente, avviso,
 * chiusura) → il documento non deve essere auto-salvato ma restare in coda per revisione
 * manuale.
 */
export function ocrClassifiedAsFatturaButContentMissing(ocr: {
  tipo_documento: unknown
  numero_fattura: string | null | undefined
  totale_iva_inclusa: number | null | undefined
}): boolean {
  if (normalizeTipoDocumento(ocr.tipo_documento) !== 'fattura') return false
  const hasNumero = !!ocr.numero_fattura?.trim()
  const hasImporto = ocr.totale_iva_inclusa != null
  return !hasNumero && !hasImporto
}

export function normalizeTipoDocumento(raw: unknown): NormalizedTipoDocumento {
  if (raw == null || raw === '') return null
  const s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim()

  /** CV / resume personale — prima di heuristiche invoice/bolla che potrebbero confondersi. */
  if (
    s === 'cv' ||
    s === 'c.v' ||
    s === 'c.v.' ||
    s === 'curriculum' ||
    s === 'resume' ||
    s === 'résumé' ||
    s === 'resumé' ||
    s === 'lebenslauf' ||
    /\bcurriculum\s+vitae\b/.test(s) ||
    /\bcurriculum\b/.test(s) ||
    /\b(résumé|resumé|resume)\b/.test(s) ||
    /\blebenslauf\b/.test(s)
  ) {
    return 'curriculum'
  }

  if (
    s === 'comunicazione_cliente' ||
    s === 'comunicazione-cliente' ||
    s === 'customer_communication' ||
    s === 'client_communication' ||
    /\bcomunicazione\s+cliente\b/.test(s)
  ) {
    return 'comunicazione_cliente'
  }

  if (
    s === 'nota_credito' ||
    s === 'credito' ||
    s === 'credit_note' ||
    s === 'credit' ||
    s === 'nota_di_credito' ||
    s === 'note_de_credit' ||
    s === 'avoir' ||
    s === 'gutschrift'
  ) {
    return 'nota_credito'
  }

  if (
    s === 'fattura' ||
    s === 'invoice' ||
    s === 'tax_invoice' ||
    s === 'taxinvoice' ||
    s === 'vat_invoice' ||
    s === 'vatinvoice' ||
    s === 'commercial_invoice' ||
    s === 'sales_invoice' ||
    s === 'e_invoice' ||
    s === 'e-invoice' ||
    s === 'einvoice'
  ) {
    return 'fattura'
  }
  if (s === 'bolla' || s === 'ddt' || s === 'delivery' || s === 'delivery_note' || s === 'lieferschein' || s === 'albaran') return 'bolla'
  if (s === 'listino' || s === 'listino_prezzi' || s === 'price_list' || s === 'catalogue' || s === 'catalog') return 'listino'
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
    /\b(tax|vat|sales|commercial)[\s._-]*invoice\b/i.test(s) ||
    /\bfacture\b/.test(s) ||
    /\bfactura\b/.test(s) ||
    /\brechnung\b/.test(s) ||
    /\bself[\s-]?billed\b/.test(s) ||
    /\bself[\s-]?billing\b/.test(s)
  ) {
    return 'fattura'
  }
  if (
    /nota\s+credito/.test(s) ||
    /credit[\s_-]?note/.test(s) ||
    /\bavoir\b/.test(s) ||
    /\bgutschrift\b/.test(s)
  ) {
    return 'nota_credito'
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
