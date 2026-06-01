import { describe, expect, it } from 'vitest'
import { qualityValidateDate } from '@/lib/document-quality-chain'
import {
  processingDocumentDateYmdFromMetadata,
  processingDocumentDateYmdFromOcr,
} from '@/lib/safe-date'

describe('qualityValidateDate', () => {
  it('non usa la data di ricezione email come data documento', () => {
    const q = qualityValidateDate(null, '2026-06-01', 'fattura.pdf', 'Fwd: invoice')
    expect(q.value).toBeNull()
    expect(q.confidence).toBe(0)
  })

  it('preferisce OCR rispetto a oggetto mail discordante', () => {
    const q = qualityValidateDate('2026-03-15', '2026-06-01', 'doc.pdf', 'Invoice 01/06/2026')
    expect(q.value).toBe('2026-03-15')
  })
})

describe('processingDocumentDateYmdFromMetadata', () => {
  it('legge data_ordine per conferme ordine', () => {
    expect(
      processingDocumentDateYmdFromMetadata(
        {
          pending_kind: 'ordine',
          data_ordine: '15/03/2026',
          data_fattura: '01/06/2026',
        },
        { fileName: 'Sales Order 533422.pdf' },
      ),
    ).toBe('2026-03-15')
  })

  it('usa Order Date dal contesto file per ordini', () => {
    expect(
      processingDocumentDateYmdFromOcr(
        { tipo_documento: 'ordine', data_fattura: '01/06/2026' },
        'Sales Order 533422\nOrder Date: 31/03/2026',
      ),
    ).toBe('2026-03-31')
  })
})
