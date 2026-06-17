import { describe, expect, it } from 'vitest'
import {
  confermaOrdineImportoTotale,
  confermaOrdineImportoTotaleDisplay,
  extractOrderTotalFromLabelledText,
  importoTotaleFromOcrResult,
  sumConfermaOrdineRigheImporto,
  totaleFromDocMetadata,
} from '@/lib/conferme-ordine-importo'

describe('confermaOrdineImportoTotale', () => {
  it('preferisce la somma righe Rekki', () => {
    expect(
      confermaOrdineImportoTotale({
        righe: [{ importo_linea: 10 }, { importo_linea: 5 }],
        importo_totale: 99,
      }),
    ).toBe(15)
  })

  it('usa totale OCR se non ci sono righe', () => {
    expect(
      confermaOrdineImportoTotale({
        righe: null,
        importo_totale: 1234.5,
      }),
    ).toBe(1234.5)
  })

  it('legge totale da metadata documento', () => {
    expect(totaleFromDocMetadata({ totale_iva_inclusa: '1.234,56' })).toBe(1234.56)
    expect(sumConfermaOrdineRigheImporto([{ quantita: 2, prezzo_unitario: 50 }])).toBe(100)
  })

  it('estrae Grand Total da testo PDF', () => {
    expect(
      extractOrderTotalFromLabelledText('Line items\nGrand Total £1,234.56\nThank you'),
    ).toBe(1234.56)
    expect(
      importoTotaleFromOcrResult(
        { totale_iva_inclusa: null, importo_raw: null },
        'Order Total: 2.500,00',
      ),
    ).toBe(2500)
  })

  it('estrae Balance Due da fattura QuickBooks', () => {
    expect(
      extractOrderTotalFromLabelledText('Items\nBalance Due\n£1,234.56\nThank you'),
    ).toBe(1234.56)
    expect(
      importoTotaleFromOcrResult(
        { totale_iva_inclusa: null, importo_raw: null },
        'Invoice 43284\nBalance Due £99.00',
      ),
    ).toBe(99)
  })
})

describe('confermaOrdineImportoTotaleDisplay', () => {
  it('applica IVA UK sulle righe Rekki (netto → lordo)', () => {
    expect(
      confermaOrdineImportoTotaleDisplay(
        {
          righe: [{ prodotto: 'Prosecco Argeo NV', importo_linea: 100 }],
          importo_totale: 120,
        },
        'UK',
      ),
    ).toBe(120)
  })

  it('non raddoppia IVA su totale OCR senza righe', () => {
    expect(
      confermaOrdineImportoTotaleDisplay({
        righe: null,
        importo_totale: 544.87,
      }, 'UK'),
    ).toBe(544.87)
  })

  it('mantiene zero-rated su carne a peso UK', () => {
    expect(
      confermaOrdineImportoTotaleDisplay(
        {
          righe: [{ prodotto: 'Prosciutto crudo 1/2 kg', importo_linea: 50, quantita: 1 }],
          importo_totale: null,
        },
        'UK',
      ),
    ).toBe(50)
  })
})
