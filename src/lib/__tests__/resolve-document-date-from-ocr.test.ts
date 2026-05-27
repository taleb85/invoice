import { describe, expect, it } from 'vitest'
import {
  isPlausibleStoredDocumentDate,
  isStaleRelativeToReceipt,
  resolveDocumentDateFromOcrContext,
} from '@/lib/resolve-document-date-from-ocr'

describe('resolveDocumentDateFromOcrContext', () => {
  it('rejects September 2025 when document received May 2026', () => {
    const result = resolveDocumentDateFromOcrContext({
      ocr: { data_fattura: '2025-09-15' },
      currentDate: '2026-04-20',
      receivedAt: '2026-05-10T10:00:00Z',
      fileName: 'invoice.pdf',
    })
    expect(result.skipReason).toBe('stale_vs_receipt')
    expect(result.proposedDate).toBeNull()
  })

  it('accepts April 2026 when replacing implausible stored date', () => {
    const result = resolveDocumentDateFromOcrContext({
      ocr: { data_fattura: '2026-04-20' },
      currentDate: '2025-09-15',
      receivedAt: '2026-05-10T10:00:00Z',
      fileName: 'INV-20260420.pdf',
    })
    expect(result.proposedDate).toBe('2026-04-20')
  })

  it('keeps plausible stored date when OCR has low confidence', () => {
    const result = resolveDocumentDateFromOcrContext({
      ocr: { data_fattura: '2026-01-15' },
      currentDate: '2026-04-20',
      receivedAt: '2026-05-10T10:00:00Z',
    })
    expect(result.skipReason).toBe('low_confidence')
    expect(result.proposedDate).toBeNull()
  })

  it('prefers date from filename when OCR reads a stale billing period', () => {
    const result = resolveDocumentDateFromOcrContext({
      ocr: { data_fattura: '2025-09-01' },
      currentDate: '2025-09-15',
      receivedAt: '2026-05-10T10:00:00Z',
      fileName: 'TaxInvoice_2026-04-28.pdf',
    })
    expect(result.proposedDate).toBe('2026-04-28')
  })
})

describe('isStaleRelativeToReceipt', () => {
  it('flags dates more than 180 days before receipt', () => {
    expect(isStaleRelativeToReceipt('2025-09-15', '2026-05-10')).toBe(true)
    expect(isStaleRelativeToReceipt('2026-04-15', '2026-05-10')).toBe(false)
  })
})

describe('isPlausibleStoredDocumentDate', () => {
  it('marks old September date as implausible vs May receipt', () => {
    expect(isPlausibleStoredDocumentDate('2025-09-15', '2026-05-10')).toBe(false)
    expect(isPlausibleStoredDocumentDate('2026-04-20', '2026-05-10')).toBe(true)
  })
})
