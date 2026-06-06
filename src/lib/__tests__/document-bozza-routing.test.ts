import { describe, it, expect } from 'vitest'
import {
  inferPendingDocumentKindForQueueRow,
  scanContextSuggestsFattura,
  scanContextSuggestsBolla,
  subjectLooksLikeInvoice,
  inferAutoPendingKindFromEmailScan,
} from '@/lib/document-bozza-routing'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

// ─── normalizeTipoDocumento ────────────────────────────────────────────────

describe('normalizeTipoDocumento', () => {
  it('riconosce fattura in italiano e inglese', () => {
    expect(normalizeTipoDocumento('fattura')).toBe('fattura')
    expect(normalizeTipoDocumento('invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('Tax Invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('VAT invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('tax_invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('e-invoice')).toBe('fattura')
    expect(normalizeTipoDocumento('credit_note')).toBe('nota_credito')
  })

  it('riconosce bolla/DDT in vari formati → bolla_ddt', () => {
    expect(normalizeTipoDocumento('bolla')).toBe('bolla_ddt')
    expect(normalizeTipoDocumento('bolla_ddt')).toBe('bolla_ddt')
    expect(normalizeTipoDocumento('ddt')).toBe('bolla_ddt')
    expect(normalizeTipoDocumento('delivery_note')).toBe('bolla_ddt')
    expect(normalizeTipoDocumento('delivery note')).toBe('bolla_ddt')
    expect(normalizeTipoDocumento('Lieferschein')).toBe('bolla_ddt')
  })

  it('mappa ordine come tipo distinto, estratto conto come estratto_conto', () => {
    expect(normalizeTipoDocumento('ordine')).toBe('ordine')
    expect(normalizeTipoDocumento('estratto_conto')).toBe('estratto_conto')
    expect(normalizeTipoDocumento('purchase_order')).toBe('ordine')
    expect(normalizeTipoDocumento('statement')).toBe('estratto_conto')
  })

  it('normalizza comunicazione_cliente e alias → comunicazione', () => {
    expect(normalizeTipoDocumento('comunicazione')).toBe('comunicazione')
    expect(normalizeTipoDocumento('comunicazione_cliente')).toBe('comunicazione')
    expect(normalizeTipoDocumento('customer_communication')).toBe('comunicazione')
  })

  it('normalizza curriculum / CV / résumé → comunicazione', () => {
    expect(normalizeTipoDocumento('curriculum vitae')).toBe('comunicazione')
    expect(normalizeTipoDocumento('Resume')).toBe('comunicazione')
    expect(normalizeTipoDocumento('lebenslauf')).toBe('comunicazione')
  })

  it('restituisce null per valori assenti o non riconosciuti', () => {
    expect(normalizeTipoDocumento(null)).toBeNull()
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
  it('classifica come comunicazione un doc con solo numero e totale (DDT senza tipo OCR)', () => {
    // Questo era il bug: numero + totale → 'fattura'. Ora → comunicazione.
    const result = inferPendingDocumentKindForQueueRow({
      oggetto_mail: 'Allegati',
      file_name: 'documento_50229873.pdf',
      metadata: {
        tipo_documento: null,
        numero_fattura: '50229873',
        totale_iva_inclusa: 1234.56,
      },
    })
    expect(result).toBe('comunicazione')
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

  it('classifica come bolla quando OCR dice "bolla_ddt" (o legacy "bolla")', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: { tipo_documento: 'bolla_ddt', numero_fattura: '50229873', totale_iva_inclusa: 500 },
      }),
    ).toBe('bolla')
    // Retrocompatibilità: il valore legacy 'bolla' viene normalizzato a 'bolla_ddt'
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

  it('classifica come comunicazione quando OCR indica curriculum/CV (normalizzato a comunicazione)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: 'invoice_resume.pdf',
        metadata: { tipo_documento: 'curriculum' },
      }),
    ).toBe('comunicazione')
  })

  it('classifica come comunicazione quando OCR dice "comunicazione" o legacy "comunicazione_cliente"', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: { tipo_documento: 'comunicazione' },
      }),
    ).toBe('comunicazione')
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: { tipo_documento: 'comunicazione_cliente' },
      }),
    ).toBe('comunicazione')
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

  it('classifica come comunicazione se sia "invoice" che "ddt" compaiono nel blob (ambiguo)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: 'invoice DDT',
        file_name: null,
        metadata: { tipo_documento: null },
      }),
    ).toBe('comunicazione')
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

  it('NON classifica come statement "Statement of Account" (è comunicazione)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: 'C Carnevale Ltd Statement of Account - JOB000 - 31/03/2026',
        file_name: null,
        metadata: null,
      }),
    ).toBe('comunicazione')
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
  it('classifica come comunicazione con metadata completamente assente', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: null,
      }),
    ).toBe('comunicazione')
  })

  it('classifica come comunicazione con solo il totale (senza numero né tipo)', () => {
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: null,
        file_name: null,
        metadata: { tipo_documento: null, totale_iva_inclusa: 999 },
      }),
    ).toBe('comunicazione')
  })
})

// ─── subjectLooksLikeInvoice (sollecito/notifica pagamento + INV/SI/RTN) ──
//
// Regressione: storicamente email tipo "Payment of £X is outstanding for INV-NNNN"
// o "MONDIAL WINE LTD - SI120832" finivano in `statements` (is_statement=true)
// perché il subject NON conteneva la parola "invoice/fattura". L'estensione
// dell'euristica deve riconoscere il riferimento puntuale a una fattura
// (INV-NNNN, SI<NNNN>, "outstanding for INV-…", "sollecito di pagamento")
// e bloccare la classificazione come statement.
describe('subjectLooksLikeInvoice — riferimenti a singola fattura / solleciti', () => {
  it('riconosce "INV-NNNN" / "INV NNNN" come riferimento a fattura', () => {
    expect(subjectLooksLikeInvoice('INV-2882 from Tacco')).toBe(true)
    expect(subjectLooksLikeInvoice('Re: INV 12345 outstanding')).toBe(true)
  })

  it('riconosce "SI<NNNN>" (Sales Invoice numerata) come riferimento a fattura', () => {
    expect(subjectLooksLikeInvoice('MONDIAL WINE LTD - SI120832 18.05.26')).toBe(true)
    expect(subjectLooksLikeInvoice('BWT UK Ltd Invoice - SI000010552')).toBe(true)
  })

  it('riconosce "RTN<NNNN>" (Return Note / credit note) come riferimento a fattura', () => {
    expect(subjectLooksLikeInvoice('RTN108331 Mondial Wine')).toBe(true)
  })

  it('riconosce notifiche/solleciti "Payment of … outstanding for INV-…"', () => {
    expect(
      subjectLooksLikeInvoice('Payment of £274.10 is outstanding for INV-2606 - Sent Using Zoho Books'),
    ).toBe(true)
    expect(subjectLooksLikeInvoice('Outstanding for invoice 12345')).toBe(true)
  })

  it('riconosce solleciti generici in italiano e inglese', () => {
    expect(subjectLooksLikeInvoice('Sollecito di pagamento fattura 123')).toBe(true)
    expect(subjectLooksLikeInvoice('Payment reminder')).toBe(true)
    expect(subjectLooksLikeInvoice('Overdue payment notice')).toBe(true)
  })

  it('non si attiva su "Statement of Account" puro né su statement mensile', () => {
    expect(subjectLooksLikeInvoice('Statement of Account - Berkmann Wine Cellars Limited')).toBe(false)
    expect(subjectLooksLikeInvoice('Account statement March 2026')).toBe(false)
    expect(subjectLooksLikeInvoice('Estratto conto mensile')).toBe(false)
  })
})

describe('inferAutoPendingKindFromEmailScan — niente statement per solleciti/INV/SI', () => {
  it('"Payment of … outstanding for INV-…" NON è statement', () => {
    expect(
      inferAutoPendingKindFromEmailScan(
        'Payment of £706.39 is outstanding for INV-2800 - Sent Using Zoho Books',
        null,
        // body contiene anche "statement" ma il subject è chiaramente fattura/sollecito
        'Hello, your statement update: please pay the outstanding amount.',
        null,
      ),
    ).toBeNull()
  })

  it('"MONDIAL WINE LTD - SI120832" NON è statement', () => {
    expect(
      inferAutoPendingKindFromEmailScan('MONDIAL WINE LTD - SI120832 18.05.26', null, null, null),
    ).toBeNull()
  })

  it('"Invoice - INV-2882 from Tacco" NON è statement', () => {
    expect(
      inferAutoPendingKindFromEmailScan(
        'Invoice - INV-2882 from Tacco - Sent Using Zoho Books',
        null,
        null,
        null,
      ),
    ).toBeNull()
  })

  it('"Account statement March 2026" rimane statement', () => {
    expect(
      inferAutoPendingKindFromEmailScan('Account statement March 2026', null, null, null),
    ).toBe('statement')
  })

  it('"Payment Receipt from …" NON è statement (ricevuta pagamento)', () => {
    expect(
      inferAutoPendingKindFromEmailScan(
        'Payment Receipt from True Terroir Ltd',
        null,
        null,
        null,
      ),
    ).toBeNull()
    expect(
      inferPendingDocumentKindForQueueRow({
        oggetto_mail: 'Payment Receipt from True Terroir Ltd',
        file_name: null,
        metadata: null,
      }),
    ).toBe('comunicazione')
  })
})
