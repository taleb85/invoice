import { qualityValidateDate, type SignalStrength } from '@/lib/document-quality-chain'
import { isSuspiciousDocumentDate } from '@/lib/fix-ocr-dates-helpers'
import { documentContextText, processingDocumentDateYmdFromOcr } from '@/lib/safe-date'

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

function daysBeforeReceipt(proposed: string, receivedAt: string): number {
  const recv = receivedAt.slice(0, 10)
  const diffMs = new Date(recv).getTime() - new Date(proposed).getTime()
  return diffMs / (1000 * 60 * 60 * 24)
}

/** Data troppo vecchia rispetto alla ricezione email/archiviazione (es. periodo estratto conto). */
export function isStaleRelativeToReceipt(
  proposed: string,
  receivedAt: string | null | undefined,
  maxDaysBefore = 180,
): boolean {
  const recv = receivedAt?.slice(0, 10)
  if (!recv || !/^\d{4}-\d{2}-\d{2}$/.test(proposed)) return false
  if (proposed > recv) return false
  return daysBeforeReceipt(proposed, recv) > maxDaysBefore
}

/** Data plausibile per un documento già in archivio (non sospetta e coerente con ricezione). */
export function isPlausibleStoredDocumentDate(
  data: string | null | undefined,
  receivedAt?: string | null,
): boolean {
  if (!data?.trim() || isSuspiciousDocumentDate(data)) return false
  if (receivedAt && isStaleRelativeToReceipt(data, receivedAt)) return false
  return true
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
  const proposed = quality.value ?? ocrDate
  const confidence = quality.value ? quality.confidence : ocrDate ? (2 as SignalStrength) : quality.confidence

  const current = opts.currentDate?.trim() || null

  if (!proposed) {
    return { proposedDate: null, confidence, skipReason: 'no_ocr_date', ocrDate }
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
