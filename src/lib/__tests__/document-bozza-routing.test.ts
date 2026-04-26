import { describe, it, expect } from 'vitest'
import {
  inferPendingDocumentKindForQueueRow,
  scanContextSuggestsFattura,
  scanContextSuggestsBolla,
} from '@/lib/document-bozza-routing'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

// ─── normalizeTipoDocumento ────────────────────────────────────────────────

describe('normalizeTipoDocumento', () => {
  it('riconosce fattura in italiano e inglese', () => {
    expect(normalizeTipoDocumento('fattura')).toBe('fattura')
    expect(normalizeTipoDocumento('invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('Tax Invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('VAT invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('credit_note')).toBe('fattura')
  })

  it('riconosce bolla/DDT in vari formati', () => {
    expect(normalizeTipoDocumento('bolla')).toBe('bolla')
    expect(normalizeTipoDocumento('ddt')).toBe('bolla')
    expect(normalizeTipoDocumento('delivery_note')).toBe('bolla')
    expect(normalizeTipoDocumento('delivery note')).toBe('bolla')
    expect(normalizeTipoDocumento('Lieferschein')).toBe('bolla')
  })

  it('mappa ordine e estratto conto a altro', () => {
    expect(normalizeTipoDocumento('ordine')).toBe('altro')
    expect(normalizeTipoDocumento('estratto_conto')).toBe('altro')
    expect(normalizeTipoDocumento('purchase_order')).toBe('altro')
    expect(normalizeTipoDocumento('statement')).toBe('altro')
  })

  it('restituisce null per valori assenti o non riconosciuti', () => {
    expect(normalizeTipoDocumento(null)).toBeNull()
    expect(normalizeTipoDocumento(undefined)).toBeNull()
    expect(normalizeTipoDocumento('')).toBeNull()
    expect(normalizeTipoDocumento('documento generico')).toBeNull()
  })
})

// ─── scanContextSuggestsFattura / scanContextSuggestsBolla ────────────────

describe('scanContextSuggestsFattura', () => {
  it('rileva "invoice" nel nome file', () => {
    expect(scanContextSuggestsFattura(null, 'invoice_50229873.pdf')).toBe(true)
  })
  it('rileva "fatttura" nell\'oggetto email', () => {
    expect(scanContextSuggestsFattura('Fattura fornitore XYZ', null)).toBe(true)
  })
  it('non si attiva su nomi file neutri', () => {
    expect(scanContextSuggestsFattura(null, 'documento_50229873.pdf')).toBe(false)
    expect(scanContextSuggestsFattura('Allegati', null)).toBe(false)
  })
})

describe('scanContextSuggestsBolla', () => {
  it('rileva "delivery note" nel nome file', () => {
    expect(scanContextSuggestsBolla(null, 'delivery_note_50229873.pdf')).toBe(true)
  })
  it('rileva "DDT" nell\'oggetto email', () => {
    expect(scanContextSuggestsBolla('DDT fornitore XYZ', null)).toBe(true)
  })
  it('non si attiva su nomi file neutri', () => {
    expect(scanContextSuggestsBolla(null, 'documento_50229873.pdf')).toBe(false)
    expect(scanContextSuggestsBolla('Allegati', null)).toBe(false)
  })
})

// ─── inferPendingDocumentKindForQueueRow ──────────────────────────────────

describe('inferPendingDocumentKindForQueueRow', () => {
  // ── caso del bug segnalato ──────────────────────────────────────────────
  it('NON classifica come fattura un doc con solo numero e totale (DDT senza tipo OCR)', () => {
    // Questo era il bug: numero + totale → 'fattura'. Ora → null.
    const result = inferPendingDocumentKindForQueueRow({
      oggetto_mail: 'Allegati',
      file_name: 'documento_50229873.pdf',
      metadata: {
        tipo_documento: null,
        numero_fattura: '50229873',
        totale_iva_inclusa: 1234.56,
      },
    })
    expect(result).toBeNull()
  })

  // ── classificazione tramite OCR tipo_documento ──────────────────────────
  it('classifica come fattura quando OCR dice "fattura"', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: { tipo_documento: 'fattura', numero_fattura: '50229873', totale_iva_inclusa: 500 },
      }),
    ).toBe('fattura')
  })

  it('classifica come bolla quando OCR dice "bolla"', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: { tipo_documento: 'bolla', numero_fattura: '50229873', totale_iva_inclusa: 500 },
      }),
    ).toBe('bolla')
  })

  it('classifica come bolla quando OCR dice "delivery_note"', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: 'delivery_note_50229873.pdf',
        metadata: { tipo_documento: 'delivery_note', numero_fattura: '50229873' },
      }),
    ).toBe('bolla')
  })

  // ── classificazione tramite contesto email / nome file ──────────────────
  it('classifica come fattura se il nome file contiene "invoice" (OCR tipo null)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: 'invoice_50229873.pdf',
        metadata: { tipo_documento: null, numero_fattura: '50229873', totale_iva_inclusa: 500 },
      }),
    ).toBe('fattura')
  })

  it('classifica come bolla se il nome file contiene "delivery-note" (OCR tipo null)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: 'delivery-note-50229873.pdf',
        metadata: { tipo_documento: null, numero_fattura: '50229873', totale_iva_inclusa: 500 },
      }),
    ).toBe('bolla')
  })

  it('restituisce null se sia "invoice" che "ddt" compaiono nel blob (ambiguo)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: 'invoice DDT',
        file_name: null,
        metadata: { tipo_documento: null },
      }),
    ).toBeNull()
  })

  // ── statement e ordine ──────────────────────────────────────────────────
  it('classifica come statement se l\'oggetto mail contiene "statement"', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: 'Account statement March 2026',
        file_name: null,
        metadata: null,
      }),
    ).toBe('statement')
  })

  it('classifica come ordine se l\'oggetto mail contiene "order confirmation"', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: 'Order confirmation #12345',
        file_name: null,
        metadata: null,
      }),
    ).toBe('ordine')
  })

  // ── valori edge ─────────────────────────────────────────────────────────
  it('restituisce null con metadata completamente assente', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: null,
      }),
    ).toBeNull()
  })

  it('restituisce null con solo il totale (senza numero né tipo)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: { tipo_documento: null, totale_iva_inclusa: 999 },
      }),
    ).toBeNull()
  })
})
