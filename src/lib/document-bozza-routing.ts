import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

/**
 * Oggetto mail tipico degli estratti conto (allineato alla scansione in scan-emails).
 *
 * NOTA: "Statement of Account" NON è un estratto conto processabile — è una comunicazione
 * commerciale/lettera di riepilogo, non un documento con righe transazionali da estrarre.
 * Per questo viene esplicitamente esclusa.
 */
export function emailSubjectLooksLikeStatement(subject: string | null | undefined): boolean {
  const s = (subject ?? '').toLowerCase()
  if (!s.trim()) return false

  if (/statement\s+of\s+account/.test(s) || /statement\s+of\s+the\s+account/.test(s)) return false

  return (
    /\bstatement\b/.test(s) ||
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
 * Ricevute di pagamento (QuickBooks, ecc.): NON sono estratti conto.
 * Vanno in coda comunicazioni / archivio, non nel parser statement.
 */
export function scanContextLooksLikePaymentReceiptDoc(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase()
  if (!blob.trim()) return false
  return (
    /\bpayment\s+receipt\b/.test(blob) ||
    (/\bpayment\b/.test(blob) && /\breceipt\b/.test(blob)) ||
    /ricevuta\s+di\s+pagamento/.test(blob) ||
    /ricevuta\s+pagamento/.test(blob) ||
    /\bquietanza\b/.test(blob) ||
    /\bpagamento\s+ricevuto\b/.test(blob) ||
    /\bpayment\s+received\b/.test(blob) ||
    /\bproof\s+of\s+payment\b/.test(blob)
  )
}

/** Alias per UI lista statement (oggetto mail tipico QuickBooks). */
export function statementEmailSubjectLooksLikePaymentReceipt(
  subject: string | null | undefined,
  fileName?: string | null,
): boolean {
  return scanContextLooksLikePaymentReceiptDoc(subject, fileName ?? null)
}

/**
 * Oggetto o nome file: remittance, payment advice — stessa coda “Estratto”
 * (pending_kind statement) e senza bozza fattura/bolla automatica.
 *
 * Le ricevute di pagamento (`scanContextLooksLikePaymentReceiptDoc`) sono escluse.
 */
export function scanContextLooksLikeStatementCategoryDoc(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  if (scanContextLooksLikePaymentReceiptDoc(subject, fileName)) return false
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase()
  if (!blob.trim()) return false
  return (
    /\bpayment\s+advice\b/.test(blob) ||
    /\bpayment\s+confirmation\b/.test(blob) ||
    /\bremittance\b/.test(blob) ||
    /\bremittance\s+advice\b/.test(blob) ||
    /\bcredit\s+note\s+receipt\b/.test(blob)
  )
}

/**
 * Corpo mail / campi OCR: pattern tipo “Statement from …” (inoltri con oggetto generico)
 * o intestazioni di estratto in inglese.
 */
export function snippetFieldsLookLikeStatementDoc(
  bodySnippet: string | null | undefined,
  ocr?: { ragione_sociale?: string | null; note_corpo_mail?: string | null } | null,
): boolean {
  const blob = [bodySnippet, ocr?.ragione_sociale, ocr?.note_corpo_mail]
    .map(s => (s ?? '').toLowerCase())
    .join('\n')
  if (!blob.trim()) return false
  return (
    /\bstatement\s+from\b/.test(blob) ||
    /\b(account|supplier|monthly)\s+statement\b/.test(blob) ||
    /\bstatement\s+of\s+account\b/.test(blob) ||
    /\bstatement\s+for\b/.test(blob)
  )
}

/**
 * L'oggetto (o filename) dice esplicitamente che si tratta di una fattura / nota credito / bolla
 * — o di una notifica/sollecito di pagamento riferito a una fattura specifica
 * (es. "Payment of £274.10 is outstanding for INV-2606", "INV-2882 from Tacco",
 *  "SI120832 18.05.26"). In tutti questi casi NON è uno statement.
 *
 * Quando aggiungi nuovi pattern, mantieni la regola "matcha un riferimento
 * a un singolo documento numerato" (non a un riepilogo periodico).
 */
export function subjectLooksLikeInvoice(s: string | null | undefined): boolean {
  const subj = (s ?? '').toLowerCase().replace(/[_.\-]/g, ' ')
  if (!subj.trim()) return false
  return (
    /\binvoice\b/.test(subj) ||
    /\bfattura\b/.test(subj) ||
    /\bfacture\b/.test(subj) ||
    /\bfactura\b/.test(subj) ||
    /\brechnung\b/.test(subj) ||
    /\btax\s?invoice\b/.test(subj) ||
    /\bsales\s?invoice\b/.test(subj) ||
    /\bvat\s?invoice\b/.test(subj) ||
    /\bcredit\s?note\b/.test(subj) ||
    /\bcredit\s?memo\b/.test(subj) ||
    /\breturn\s?note\b/.test(subj) ||
    /nota\s+credito/.test(subj) ||
    /\bddt\b/.test(subj) ||
    /\bbolla\b/.test(subj) ||
    /delivery\s?note/.test(subj) ||
    /\binv\s?\d{2,}\b/.test(subj) ||
    /\bsi\s?\d{4,}\b/.test(subj) ||
    /\brtn\s?\d{2,}\b/.test(subj) ||
    /\bpayment\s+of\b.*\boutstanding\s+for\b/.test(subj) ||
    /\boutstanding\s+for\s+(inv|si|invoice|fattura)\b/.test(subj) ||
    /\bpayment\s+reminder\b/.test(subj) ||
    /\bsollecito\s+(di\s+)?pagamento\b/.test(subj) ||
    /\bavviso\s+di\s+pagamento\b/.test(subj) ||
    /\boverdue\s+(invoice|payment)\b/.test(subj)
  )
}

/**
 * Estratto classico (oggetto) + ricevute/payment (oggetto/allegato) + stessi segnali nel corpo mail
 * o nel testo estratto dall’OCR (prime pagine / note).
 *
 * Se l'oggetto dice esplicitamente "invoice" / "fattura", la classificazione
 * non viene forzata a statement, anche se il corpo contiene "payment receipt".
 */
export function emailLooksLikeStatementInboxDoc(
  subject: string | null | undefined,
  firstAttachmentFileName: string | null | undefined,
  bodySnippet?: string | null | undefined,
  ocr?: { ragione_sociale?: string | null; note_corpo_mail?: string | null } | null,
): boolean {
  if (scanContextLooksLikePaymentReceiptDoc(subject, firstAttachmentFileName)) return false
  // Se oggetto o nome file dice fattura/bolla, non è un estratto conto — l'OCR deciderà
  if (subjectLooksLikeInvoice(subject) || subjectLooksLikeInvoice(firstAttachmentFileName)) return false
  if (emailSubjectLooksLikeStatement(subject)) return true
  if (scanContextLooksLikeStatementCategoryDoc(subject, firstAttachmentFileName)) return true
  if (snippetFieldsLookLikeStatementDoc(bodySnippet, ocr)) return true
  if (scanContextLooksLikeStatementCategoryDoc(bodySnippet, null)) return true
  return false
}

/** Ordine vs estratto da contesto scan (ordine ha priorità). */
export function inferAutoPendingKindFromEmailScan(
  subject: string | null | undefined,
  fileName: string | null | undefined,
  bodySnippet?: string | null | undefined,
  ocr?: { ragione_sociale?: string | null; note_corpo_mail?: string | null } | null,
): 'ordine' | 'statement' | null {
  if (scanContextLooksLikeOrderConfirmationDoc(subject, fileName)) return 'ordine'
  if (emailLooksLikeStatementInboxDoc(subject, fileName, bodySnippet, ocr ?? undefined)) return 'statement'
  return null
}

/**
 * Conferma ordine (oggetto o nome file) → coda “Ordine” (`pending_kind` ordine), senza bozza bolla/fattura.
 */
const SALES_OR_ORDER_IN_TEXT_HINT =
  /\bsales\s+order\b|\bpurchase\s+order\b|\bwork\s+order\b|\border\s+confirmation\b|\bpo\s+acknowledg|\bconferma\s+(d['’])?ordine\b|\bauftragsbestätigung\b/i

/** Preventivo / quotation / offerta — non ordine né fattura (Donovan e fornitori UK). */
const QUOTATION_DOC_HINT =
  /\bquotation\b|\bquotations\b|\bpreventivo\b|\bpreventiva\b|offerta\s+commerciale|price\s+quotation|\bquote\s+for\b|sales\s+quotation/i

type OcrContextForOrdine = {
  tipo_documento?: unknown
  ragione_sociale?: string | null
  numero_fattura?: string | null
  note_corpo_mail?: string | null
  ocr_tipo?: unknown
}

function ocrContextBlob(
  metadata: OcrContextForOrdine | null | undefined,
  opts?: { oggetto_mail?: string | null; file_name?: string | null },
): string {
  const rawTipo = metadata?.tipo_documento ?? metadata?.ocr_tipo
  return [
    opts?.oggetto_mail ?? '',
    opts?.file_name ?? '',
    typeof rawTipo === 'string' ? rawTipo : rawTipo != null ? String(rawTipo) : '',
    metadata?.ragione_sociale ?? '',
    metadata?.numero_fattura ?? '',
    metadata?.note_corpo_mail ?? '',
  ].join('\n')
}

export function documentOcrContextSuggestsQuotation(
  metadata: OcrContextForOrdine | null | undefined,
  opts?: { oggetto_mail?: string | null; file_name?: string | null },
): boolean {
  const blob = ocrContextBlob(metadata, opts)
  if (QUOTATION_DOC_HINT.test(blob)) return true
  const rawTipo = metadata?.tipo_documento ?? metadata?.ocr_tipo
  if (typeof rawTipo === 'string' && QUOTATION_DOC_HINT.test(rawTipo)) return true
  return false
}

/**
 * Segnali testuali da metadata/OCR (come audit pass1): Sales Order nel PDF anche se
 * `normalizeTipoDocumento` ha restituito `comunicazione` o il filename è solo numerico.
 */
export function documentOcrContextSuggestsOrdine(
  metadata: OcrContextForOrdine | null | undefined,
  opts?: { oggetto_mail?: string | null; file_name?: string | null },
): boolean {
  if (documentOcrContextSuggestsQuotation(metadata, opts)) return false

  if (scanContextLooksLikeOrderConfirmationDoc(opts?.oggetto_mail, opts?.file_name)) return true

  const rawTipo = metadata?.tipo_documento ?? metadata?.ocr_tipo
  if (normalizeTipoDocumento(rawTipo) === 'ordine') return true

  return SALES_OR_ORDER_IN_TEXT_HINT.test(ocrContextBlob(metadata, opts))
}

export function scanContextLooksLikeOrderConfirmationDoc(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase()
  if (!blob.trim()) return false
  const poConfirm =
    /\bpurchase\s+order\b/.test(blob) &&
    (/\bconfirm/.test(blob) || /\back/.test(blob) || /\breceived\b/.test(blob))
  const salesOrderConfirm =
    /\bsales\s+order\b/.test(blob) && /\bconfirm/.test(blob)
  return (
    /\border\s+confirmation\b/.test(blob) ||
    /\border\s+acknowledg/.test(blob) ||
    /\border\s+confirmed\b/.test(blob) ||
    poConfirm ||
    salesOrderConfirm ||
    /conferma\s+(d['’])?ordine/.test(blob) ||
    /ordine\s+confermato/.test(blob) ||
    /\bconfirmazione\s+ordine\b/.test(blob) ||
    /bestellbestätigung/.test(blob) ||
    /bestellbestaetigung/.test(blob) ||
    /commande\s+confirmée/.test(blob) ||
    /\bpedido\s+confirmado\b/.test(blob) ||
    /\bconfirmación\s+de\s+pedido\b/.test(blob) ||
    /\baufftragsbestätigung\b/.test(blob)
  )
}

/**
 * Report operativi (es. pest control, assistenza): non sono fatture/bolle — non salvare in coda.
 */
export function scanContextLooksLikeServiceReport(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`
  if (!blob.trim()) return false
  const b = blob.toLowerCase()
  return /\bservice\s+report\b/.test(b) || /\brapporto\s+di\s+servizio\b/.test(b)
}

/**
 * Heuristics for email-scan bolla vs fattura bozza when OCR `tipo_documento`
 * is missing, wrong, or the model returns free-text (e.g. "Tax invoice").
 */

export function scanContextSuggestsFattura(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase().replace(/[_.\-]/g, ' ')
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
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase().replace(/[_.\-]/g, ' ')
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

export function scanContextSuggestsListino(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase().replace(/[_.\-]/g, ' ')
  if (!blob.trim()) return false
  return (
    /\blistino\b/.test(blob) ||
    /\bprice\s*list\b/.test(blob) ||
    /\bpricelist\b/.test(blob) ||
    /\bcatalogue?\b/.test(blob) ||
    /\bcatalog\b/.test(blob) ||
    /\bmenu\b/.test(blob) ||
    /\bwine\s*list\b/.test(blob) ||
    /\btariffa\b/.test(blob) ||
    /\btariffs?\b/.test(blob) ||
    /\b(price|prezzi)\s*(update|list|sheet)\b/.test(blob)
  )
}

/**
 * Categoria documento per la coda “Da confermare” quando `metadata.pending_kind` non è ancora impostato.
 * Allineato alle euristiche di scan-email + tipo OCR; `null` se ambiguo (l’utente sceglie il chip).
 */
export function inferPendingDocumentKindForQueueRow(opts: {
  oggetto_mail: string | null | undefined
  file_name: string | null | undefined
  metadata:
    | {
        ragione_sociale?: string | null
        note_corpo_mail?: string | null
        tipo_documento?: unknown
        numero_fattura?: string | null
        totale_iva_inclusa?: number | null
      }
    | null
    | undefined
}): 'statement' | 'bolla' | 'fattura' | 'nota_credito' | 'comunicazione' | 'ordine' | 'listino' | null {
  const md = opts.metadata
  const tipo = normalizeTipoDocumento(md?.tipo_documento)

  if (scanContextLooksLikePaymentReceiptDoc(opts.oggetto_mail, opts.file_name)) {
    return 'comunicazione'
  }

  if (
    documentOcrContextSuggestsQuotation(md, {
      oggetto_mail: opts.oggetto_mail,
      file_name: opts.file_name,
    })
  ) {
    return 'comunicazione'
  }

  if (
    documentOcrContextSuggestsOrdine(md, {
      oggetto_mail: opts.oggetto_mail,
      file_name: opts.file_name,
    })
  ) {
    return 'ordine'
  }

  if (tipo === 'comunicazione') return 'comunicazione'
  if (tipo === 'bolla_ddt') return 'bolla'
  if (tipo === 'fattura') return 'fattura'
  if (tipo === 'nota_credito') return 'nota_credito'
  if (tipo === 'ordine') return 'ordine'
  if (tipo === 'estratto_conto') return 'statement'

  // Se l'OCR ha classificato come tipo noto ma non un documento direttamente
  // instradabile (es. null con contesto email), controlliamo l'euristica email.
  if (tipo !== null) {
    // L'OCR dice 'altro' ma l'oggetto/nome file è esplicito
    const subj = opts.oggetto_mail
    const fname = opts.file_name
    if (subjectLooksLikeInvoice(subj) || subjectLooksLikeInvoice(fname)) {
      const ctxFat = scanContextSuggestsFattura(subj, fname)
      const ctxBol = scanContextSuggestsBolla(subj, fname)
      if (ctxFat && !ctxBol) return 'fattura'
      if (ctxBol && !ctxFat) return 'bolla'
      if (ctxFat && ctxBol) return 'comunicazione'
      // Se subjectLooksLikeInvoice ha matchato ma scanContextSuggests non ha rilevato
      // è comunque più probabile una fattura che una comunicazione
      return 'fattura'
    }
    if (scanContextSuggestsListino(subj, fname)) return 'listino'
    if (scanContextSuggestsBolla(subj, fname)) return 'bolla'
    if (scanContextSuggestsFattura(subj, fname)) return 'fattura'
    if (scanContextLooksLikeOrderConfirmationDoc(subj, fname)) return 'ordine'
    return 'comunicazione'
  }

  // Solo se OCR non ha classificato affatto, usa euristica da oggetto/nome file
  const ocrForScan = {
    ragione_sociale: md?.ragione_sociale,
    note_corpo_mail: md?.note_corpo_mail,
  }
  const fromMail = inferAutoPendingKindFromEmailScan(
    opts.oggetto_mail,
    opts.file_name,
    null,
    ocrForScan,
  )
  if (fromMail === 'ordine' || fromMail === 'statement') return fromMail

  // Se il tipo documento non è riconosciuto ma nome file/oggetto suggerisce listino
  if (scanContextSuggestsListino(opts.oggetto_mail, opts.file_name)) return 'listino'

  const ctxFat = scanContextSuggestsFattura(opts.oggetto_mail, opts.file_name)
  const ctxBol = scanContextSuggestsBolla(opts.oggetto_mail, opts.file_name)
  if (ctxFat && ctxBol) return 'comunicazione'
  if (ctxFat) return 'fattura'
  if (ctxBol) return 'bolla'

  if (
    documentOcrContextSuggestsOrdine(md, {
      oggetto_mail: opts.oggetto_mail,
      file_name: opts.file_name,
    })
  ) {
    return 'ordine'
  }

  return 'comunicazione'
}
