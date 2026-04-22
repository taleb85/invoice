import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

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

/**
 * Estratto classico (oggetto) + ricevute/payment (oggetto/allegato) + stessi segnali nel corpo mail
 * o nel testo estratto dall’OCR (prime pagine / note).
 */
export function emailLooksLikeStatementInboxDoc(
  subject: string | null | undefined,
  firstAttachmentFileName: string | null | undefined,
  bodySnippet?: string | null | undefined,
  ocr?: { ragione_sociale?: string | null; note_corpo_mail?: string | null } | null,
): boolean {
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
}): 'statement' | 'bolla' | 'fattura' | 'ordine' | null {
  const md = opts.metadata
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

  const tipo = normalizeTipoDocumento(md?.tipo_documento)
  if (tipo === 'bolla') return 'bolla'
  if (tipo === 'fattura') return 'fattura'

  const ctxFat = scanContextSuggestsFattura(opts.oggetto_mail, opts.file_name)
  const ctxBol = scanContextSuggestsBolla(opts.oggetto_mail, opts.file_name)
  if (ctxFat && ctxBol) return null
  if (ctxFat) return 'fattura'
  if (ctxBol) return 'bolla'

  return null
}
