import { qualityValidateDate, type SignalStrength } from '@/lib/document-quality-chain'
import {
  isPlausibleStoredDocumentDate,
  isStaleRelativeToReceipt,
  isSuspiciousDocumentDate,
} from '@/lib/fix-ocr-dates-helpers'
import { documentContextText, processingDocumentDateYmdFromOcr } from '@/lib/safe-date'

export { isPlausibleStoredDocumentDate, isStaleRelativeToReceipt } from '@/lib/fix-ocr-dates-helpers'

export type DocumentDateRejectReason =
  | 'no_ocr_date'
  | 'suspicious'
  | 'stale_vs_receipt'
  | 'low_confidence'
  | 'unchanged'

export type ResolveDocumentDateFromOcrResult = {
  proposedDate: string | null
  confidence: SignalStrength
  skipReason?: DocumentDateRejectReason
  ocrDate: string | null
}

/**
 * Decide se applicare la data letta dall'OCR (con catena qualità e guardrail).
 * Usato da «Rileggi documento» e riallineabile al batch fix-ocr-dates.
 */
export function resolveDocumentDateFromOcrContext(opts: {
  ocr: {
    data_fattura?: string | null
    data?: string | null
    data_ordine?: string | null
    tipo_documento?: string | null
    pending_kind?: string | null
  }
  currentDate?: string | null
  fileName?: string | null
  emailSubject?: string | null
  receivedAt?: string | null
}): ResolveDocumentDateFromOcrResult {
  const ocrDate = processingDocumentDateYmdFromOcr(
    opts.ocr,
    documentContextText(opts.fileName, opts.emailSubject),
  )
  const quality = qualityValidateDate(
    ocrDate,
    opts.receivedAt,
    opts.fileName,
    opts.emailSubject,
  )
  const proposed = quality.value ?? null
  const confidence = quality.value
    ? quality.confidence
    : ocrDate && !isStaleRelativeToReceipt(ocrDate, opts.receivedAt)
      ? (2 as SignalStrength)
      : quality.confidence

  const current = opts.currentDate?.trim() || null

  if (!proposed) {
    if (ocrDate && isStaleRelativeToReceipt(ocrDate, opts.receivedAt)) {
      return { proposedDate: null, confidence, skipReason: 'stale_vs_receipt', ocrDate }
    }
    return { proposedDate: null, confidence, skipReason: 'no_ocr_date', ocrDate }
  }
  if (isStaleRelativeToReceipt(proposed, opts.receivedAt)) {
    return { proposedDate: null, confidence, skipReason: 'stale_vs_receipt', ocrDate }
  }
  if (isSuspiciousDocumentDate(proposed)) {
    return { proposedDate: null, confidence, skipReason: 'suspicious', ocrDate }
  }
  if (current && proposed === current) {
    return { proposedDate: null, confidence, skipReason: 'unchanged', ocrDate }
  }
  if (
    current
    && isPlausibleStoredDocumentDate(current, opts.receivedAt)
    && proposed !== current
    && confidence < 2
  ) {
    return { proposedDate: null, confidence, skipReason: 'low_confidence', ocrDate }
  }

  return { proposedDate: proposed, confidence, ocrDate }
}

export function documentDateRejectMessage(reason: DocumentDateRejectReason, locale: string): string {
  const it = {
    no_ocr_date: 'Impossibile leggere una data dal documento.',
    suspicious: 'La data letta dall\'OCR non è plausibile (futura o fuori range).',
    stale_vs_receipt: 'La data letta sembra troppo vecchia rispetto alla ricezione del documento (es. periodo di fatturazione, non data fattura).',
    low_confidence: 'Data OCR non confermata da altri segnali: la data in archivio è stata mantenuta.',
    unchanged: 'La data è già allineata a quella letta dal documento.',
  }
  const en = {
    no_ocr_date: 'Could not read a date from the document.',
    suspicious: 'The OCR date is not plausible (future or out of range).',
    stale_vs_receipt: 'The read date looks too old compared to when the document was received (e.g. billing period, not invoice date).',
    low_confidence: 'OCR date not confirmed by other signals: kept the stored date.',
    unchanged: 'The date already matches the document.',
  }
  const map = locale.startsWith('it') ? it : en
  return map[reason]
}
