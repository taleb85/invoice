import { describe, expect, it } from 'vitest'
import {
  documentOcrContextSuggestsOrdine,
  documentOcrContextSuggestsQuotation,
  inferPendingDocumentKindForQueueRow,
} from '@/lib/document-bozza-routing'

describe('quotation vs order routing', () => {
  it('detects quotation in OCR title', () => {
    expect(
      documentOcrContextSuggestsQuotation(
        { tipo_documento: 'Quotation', ragione_sociale: 'Donovan Bros Ltd' },
        { file_name: 'UntitledDocument.pdf' },
      ),
    ).toBe(true)
    expect(
      documentOcrContextSuggestsOrdine(
        { tipo_documento: 'Quotation', ragione_sociale: 'Donovan Bros Ltd' },
        { file_name: 'UntitledDocument.pdf' },
      ),
    ).toBe(false)
  })

  it('inferPendingDocumentKindForQueueRow returns comunicazione for quotation', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: 'UntitledDocument.pdf',
        metadata: {
          tipo_documento: 'Quotation',
          ragione_sociale: 'Donovan Bros Ltd',
        },
      }),
    ).toBe('comunicazione')
  })
})
