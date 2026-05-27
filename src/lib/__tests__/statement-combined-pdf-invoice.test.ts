import { describe, expect, it } from 'vitest'
import {
  buildCombinedInvoiceFields,
  pickInvoiceSegmentFromPdfSegments,
} from '@/lib/statement-combined-pdf-invoice'
import type { OcrPdfSegment } from '@/lib/ocr-pdf-multi'

describe('pickInvoiceSegmentFromPdfSegments', () => {
  it('returns fiscal segment beyond estratto_conto primary', () => {
    const segments: OcrPdfSegment[] = [
      {
        tipo_documento: 'estratto_conto',
        numero_fattura: '316074277',
        numero_e_account_no: true,
        pagina_inizio: 1,
        pagina_fine: 1,
        data_fattura: '2026-02-28',
        totale_iva_inclusa: 197.93,
        ragione_sociale: 'Eden Springs UK Ltd',
      },
      {
        tipo_documento: 'fattura',
        numero_fattura: 'SI120832',
        numero_e_account_no: false,
        pagina_inizio: 2,
        pagina_fine: 2,
        data_fattura: '2026-02-28',
        totale_iva_inclusa: 197.93,
        ragione_sociale: 'Eden Springs UK Ltd',
      },
    ]
    const picked = pickInvoiceSegmentFromPdfSegments(segments)
    expect(picked?.numero_fattura).toBe('SI120832')
  })

  it('ignores account-only invoice segments', () => {
    const segments: OcrPdfSegment[] = [
      {
        tipo_documento: 'estratto_conto',
        numero_fattura: null,
        numero_e_account_no: null,
        pagina_inizio: 1,
        pagina_fine: 2,
        data_fattura: null,
        totale_iva_inclusa: null,
        ragione_sociale: null,
      },
    ]
    expect(pickInvoiceSegmentFromPdfSegments(segments)).toBeNull()
  })
})

describe('buildCombinedInvoiceFields', () => {
  it('rejects UK account numbers as invoice number', () => {
    const fields = buildCombinedInvoiceFields(
      {
        tipo_documento: 'fattura',
        numero_fattura: '316074277',
        numero_e_account_no: false,
        pagina_inizio: 1,
        pagina_fine: 1,
        data_fattura: '2026-02-28',
        totale_iva_inclusa: 100,
        ragione_sociale: 'Eden Springs UK Ltd',
      },
      { documentDate: '2026-02-28', statementRowsSum: 100, fornitoreNome: 'Eden Springs UK Ltd' },
    )
    expect(fields).toBeNull()
  })
})
