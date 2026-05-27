import { describe, expect, it } from 'vitest'
import {
  fiscalSegmentsBeyondPrimary,
  mergePrimaryOcrWithPdfSegments,
  numeroLooksLikeUkAccountReference,
  type OcrPdfSegment,
} from '@/lib/ocr-pdf-multi'

describe('numeroLooksLikeUkAccountReference', () => {
  it('matches Eden Springs style account numbers', () => {
    expect(numeroLooksLikeUkAccountReference('316074277')).toBe(true)
    expect(numeroLooksLikeUkAccountReference('316103267')).toBe(true)
  })

  it('does not match prefixed invoice refs', () => {
    expect(numeroLooksLikeUkAccountReference('INV-316074277')).toBe(false)
    expect(numeroLooksLikeUkAccountReference('SI120832')).toBe(false)
  })
})

describe('mergePrimaryOcrWithPdfSegments', () => {
  const stmtOnly: OcrPdfSegment = {
    pagina_inizio: 1,
    pagina_fine: 2,
    tipo_documento: 'estratto_conto',
    ragione_sociale: 'Eden Springs UK Ltd',
    numero_fattura: null,
    data_fattura: '2026-03-31',
    totale_iva_inclusa: null,
    numero_e_account_no: true,
  }
  const invSeg: OcrPdfSegment = {
    pagina_inizio: 3,
    pagina_fine: 3,
    tipo_documento: 'fattura',
    ragione_sociale: 'Eden Springs UK Ltd',
    numero_fattura: 'SI120832',
    data_fattura: '2026-03-31',
    totale_iva_inclusa: 274.1,
    numero_e_account_no: false,
  }

  it('replaces account number with real invoice when only invoice segment (no stmt)', () => {
    const merged = mergePrimaryOcrWithPdfSegments(
      {
        tipo_documento: 'fattura',
        numero_fattura: '316074277',
        data_fattura: '2026-03-31',
        totale_iva_inclusa: null,
        ragione_sociale: 'Eden Springs UK Ltd',
      },
      { pdf_multiplo: true, segmenti: [invSeg] },
    )
    expect(merged.numero_fattura).toBe('SI120832')
  })

  it('uses estratto as primary when statement and invoice segments both present', () => {
    const merged = mergePrimaryOcrWithPdfSegments(
      {
        tipo_documento: 'fattura',
        numero_fattura: '316074277',
        data_fattura: '2026-03-31',
        totale_iva_inclusa: null,
        ragione_sociale: 'Eden Springs UK Ltd',
      },
      { pdf_multiplo: true, segmenti: [stmtOnly, invSeg] },
    )
    expect(merged.tipo_documento).toBe('estratto_conto')
    expect(merged.numero_fattura).toBeNull()
    expect(merged.segmenti_pdf).toHaveLength(2)
  })

  it('returns single statement segment without changing primary fattura fields', () => {
    const merged = mergePrimaryOcrWithPdfSegments(
      {
        tipo_documento: 'fattura',
        numero_fattura: '316074277',
        data_fattura: '2026-03-31',
        totale_iva_inclusa: null,
        ragione_sociale: 'Eden Springs UK Ltd',
      },
      { pdf_multiplo: true, segmenti: [stmtOnly] },
    )
    expect(merged.tipo_documento).toBe('fattura')
    expect(merged.numero_fattura).toBe('316074277')
    expect(merged.segmenti_pdf).toHaveLength(1)
  })
})

describe('fiscalSegmentsBeyondPrimary', () => {
  it('returns invoice segment when primary is statement', () => {
    const segs: OcrPdfSegment[] = [
      {
        pagina_inizio: 1,
        pagina_fine: 2,
        tipo_documento: 'estratto_conto',
        ragione_sociale: null,
        numero_fattura: null,
        data_fattura: '2026-03-31',
        totale_iva_inclusa: null,
        numero_e_account_no: true,
      },
      {
        pagina_inizio: 3,
        pagina_fine: 3,
        tipo_documento: 'fattura',
        ragione_sociale: null,
        numero_fattura: 'SI120832',
        data_fattura: '2026-03-31',
        totale_iva_inclusa: 100,
        numero_e_account_no: false,
      },
    ]
    const extra = fiscalSegmentsBeyondPrimary(segs, 'estratto_conto', null)
    expect(extra).toHaveLength(1)
    expect(extra[0]?.numero_fattura).toBe('SI120832')
  })
})
