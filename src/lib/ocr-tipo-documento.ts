/**
 * Normalizza `tipo_documento` da OCR / metadata (solo stringhe, nessuna dipendenza server).
 * Usato da client e da scan email senza trascinare `ocr-invoice` + vision.
 *
 * Enum canonico (allineato a OCR_INVOICE_SCHEMA e al prompt di sistema):
 *   fattura | nota_credito | bolla_ddt | ordine | estratto_conto | comunicazione
 *
 * Legacy → canonico (per retrocompatibilità con valori già presenti in DB):
 *   bolla / ddt           → bolla_ddt
 *   comunicazione_cliente → comunicazione
 *   curriculum / cv       → comunicazione  (non è un doc fiscale)
 *   listino / altro       → null           (non più tracciati come tipo distinto)
 */
export type NormalizedTipoDocumento =
  | 'fattura'
  | 'nota_credito'
  | 'bolla_ddt'
  | 'ordine'
  | 'estratto_conto'
  | 'comunicazione'
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

  // ── CV / résumé personale → comunicazione (non fiscale) ──────────────────
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
    return 'comunicazione'
  }

  // ── Comunicazione cliente (legacy alias inclusi) ──────────────────────────
  if (
    s === 'comunicazione' ||
    s === 'comunicazione_cliente' ||
    s === 'comunicazione-cliente' ||
    s === 'customer_communication' ||
    s === 'client_communication' ||
    /\bcomunicazione\s+cliente\b/.test(s)
  ) {
    return 'comunicazione'
  }

  // ── Nota credito (e suoi alias: return note, credit memo, RMA, storno) ────
  if (
    s === 'nota_credito' ||
    s === 'credito' ||
    s === 'credit_note' ||
    s === 'credit' ||
    s === 'credit_memo' ||
    s === 'credit_invoice' ||
    s === 'nota_di_credito' ||
    s === 'note_de_credit' ||
    s === 'avoir' ||
    s === 'gutschrift' ||
    s === 'return_note' ||
    s === 'returns_note' ||
    s === 'return' ||
    s === 'returns' ||
    s === 'reso' ||
    s === 'reso_merce' ||
    s === 'rma' ||
    s === 'rga' ||
    s === 'storno' ||
    s === 'rectificative' ||
    s === 'facture_rectificative'
  ) {
    return 'nota_credito'
  }

  // ── Fattura ───────────────────────────────────────────────────────────────
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

  // ── Bolla / DDT (legacy 'bolla' incluso come alias) ──────────────────────
  if (
    s === 'bolla_ddt' ||
    s === 'bolla' ||
    s === 'ddt' ||
    s === 'delivery' ||
    s === 'delivery_note' ||
    s === 'lieferschein' ||
    s === 'albaran'
  ) {
    return 'bolla_ddt'
  }

  // ── Estratto conto (legacy 'altro'/'estratto' inclusi come alias) ─────────
  if (
    s === 'estratto_conto' ||
    s === 'estratto' ||
    s === 'statement' ||
    s === 'account_statement'
  ) {
    return 'estratto_conto'
  }

  // ── Ordine / Order Confirmation ───────────────────────────────────────────
  if (
    s === 'ordine' ||
    s === 'order' ||
    s === 'purchase_order' ||
    s === 'po' ||
    s === 'order_confirmation' ||
    s === 'sales_order' ||
    s === 'so' ||
    s === 'conferma_ordine' ||
    s === 'auftragsbestätigung' ||
    s === 'confirmation_de_commande' ||
    s === 'confirmación_de_pedido'
  ) return 'ordine'

  // ── Listino / altro → null (non più tipi distinti nell'enum) ─────────────
  if (s === 'listino' || s === 'listino_prezzi' || s === 'price_list' || s === 'catalogue' || s === 'catalog') return null
  if (s === 'altro' || s === 'other') return null

  // ── Fuzzy matching ────────────────────────────────────────────────────────
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
    /nota\s+(?:di\s+)?credito/.test(s) ||
    /credit[\s_-]?(?:note|memo|invoice)/.test(s) ||
    /\bavoir\b/.test(s) ||
    /\bgutschrift\b/.test(s) ||
    /\bstorno\b/.test(s) ||
    /facture[\s_-]?rectificative/.test(s) ||
    /return[\s_-]?(?:note|form)/.test(s) ||
    /\breturns?\b/.test(s) ||
    /reso\s+merce/.test(s) ||
    /\b(?:rma|rga|rtv)\b/.test(s)
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
    return 'bolla_ddt'
  }
  if (/\bestratto\s+conto\b/.test(s) || /\baccount\s+statement\b/.test(s)) {
    return 'estratto_conto'
  }
  if (/preventivo|quotation|\bquote\b|pro[\s_-]?forma/.test(s)) {
    return null
  }
  if (
    /order[\s_-]?confirmation/.test(s) ||
    /\bordine\b/.test(s) ||
    /conferma[\s_-]?ordine/.test(s) ||
    /auftragsbestätigung/.test(s) ||
    /confirmation[\s_-]?de[\s_-]?commande/.test(s) ||
    /sales[\s_-]?order/.test(s) ||
    /\bso\d{5,}/.test(s)
  ) {
    return 'ordine'
  }
  return null
}

/**
 * Amount to persist on `bolle.importo` when ingesting from OCR.
 * Delivery notes (bolla_ddt) usually have no fiscal document total; Gemini often
 * still fills `totale_iva_inclusa` from line sums or unrelated sections.
 */
export function importoForBollaFromOcr(_ocr: {
  tipo_documento?: unknown
  totale_iva_inclusa?: number | null
}): number | null {
  return null
}

/** Forced bolla re-OCR classified as DDT: clear totals likely inferred by OCR earlier. */
export function shouldClearBollaImportoAfterBollaDdtReocr(
  ocrTipo: unknown,
  existingImporto: number | null | undefined
): boolean {
  if (existingImporto == null || Number.isNaN(Number(existingImporto))) return false
  return normalizeTipoDocumento(ocrTipo) === 'bolla_ddt'
}
