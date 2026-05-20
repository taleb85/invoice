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
 * Oggetto o nome file: ricevute di pagamento, remittance, payment advice — stessa coda “Estratto”
 * (pending_kind statement) e senza bozza fattura/bolla automatica.
 */
export function scanContextLooksLikeStatementCategoryDoc(
  subject: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const blob = `${subject ?? ''}\n${fileName ?? ''}`.toLowerCase()
  if (!blob.trim()) return false
  return (
    /\bpayment\s+receipt\b/.test(blob) ||
    /\bpayment\s+advice\b/.test(blob) ||
    /\bpayment\s+confirmation\b/.test(blob) ||
    /\bremittance\b/.test(blob) ||
    /\bremittance\s+advice\b/.test(blob) ||
    /\bcredit\s+note\s+receipt\b/.test(blob) ||
    (/\bpayment\b/.test(blob) && /\breceipt\b/.test(blob)) ||
    /ricevuta\s+di\s+pagamento/.test(blob) ||
    /ricevuta\s+pagamento/.test(blob) ||
    /\bquietanza\b/.test(blob) ||
    /\bpagamento\s+ricevuto\b/.test(blob) ||
    /\bpayment\s+received\b/.test(blob) ||
    /\bproof\s+of\s+payment\b/.test(blob)
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

/** L'oggetto dice esplicitamente che si tratta di una fattura. */
function subjectLooksLikeInvoice(s: string | null | undefined): boolean {
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
    /nota\s+credito/.test(subj) ||
    /\bddt\b/.test(subj) ||
    /\bbolla\b/.test(subj) ||
    /delivery\s?note/.test(subj)
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

  if (tipo === 'curriculum') return 'comunicazione'
  if (tipo === 'bolla') return 'bolla'
  if (tipo === 'fattura') return 'fattura'
  if (tipo === 'nota_credito') return 'nota_credito'
  if (tipo === 'listino') return 'listino'
  if (tipo === 'ordine') return 'ordine'

  // Se l'OCR ha classificato come "altro" / "statement" / "estratto_conto",
  // controlliamo comunque l'euristica email: l'oggetto/nome file è più affidabile
  // dell'OCR per capire se è una fattura, bolla, listino etc.
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

  // Tutto ciò che non è classificabile come ordine, bolla, fattura, nota credito, estratto conto, listino
  // viene salvato come comunicazione
  return 'comunicazione'
}
