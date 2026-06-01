import { describe, expect, it } from 'vitest'
import {
  cleanConfermaOrdineTitleText,
  confermaOrdineDisplayLabel,
  extractConfermaOrdineTipoFromFileName,
  extractConfermaOrdineTipoLabel,
  extractOrderReferenceFromFileName,
  extractOrderReferenceFromText,
} from '@/lib/extract-doc-type'

describe('cleanConfermaOrdineTitleText', () => {
  it('strips do-not-reply boilerplate and duplicate type labels', () => {
    expect(
      cleanConfermaOrdineTitleText(
        '**DO NOT REPLY EMAIL** La Tua Pasta Order Confirmation Order Confirmation',
      ),
    ).toBe('La Tua Pasta Order Confirmation')
  })
})

describe('extractOrderReferenceFromFileName', () => {
  it('reads Sales Order Confirmation suffix from PDF name', () => {
    expect(extractOrderReferenceFromFileName('Sales Order Confirmation-543585.pdf')).toBe('543585')
  })
})

describe('extractConfermaOrdineTipoFromFileName', () => {
  it('returns Sales Order from Sales Order Confirmation PDF name', () => {
    expect(extractConfermaOrdineTipoFromFileName('Sales Order Confirmation-543585.pdf')).toBe(
      'Sales Order',
    )
  })
})

describe('extractOrderReferenceFromText', () => {
  it('extracts SO reference after colon', () => {
    expect(extractOrderReferenceFromText('Enotria Order Confirmation: SO1965613')).toBe('SO1965613')
  })

  it('prefers prefixed codes over bare digits', () => {
    expect(
      extractOrderReferenceFromText('14697598 Order Confirmation', 'Supplier OC-445566'),
    ).toBe('OC-445566')
  })
})

describe('confermaOrdineDisplayLabel', () => {
  it('prefers numero_ordine over messy titolo', () => {
    expect(
      confermaOrdineDisplayLabel({
        titolo: '**DO NOT REPLY EMAIL** La Tua Pasta Order Confirmation',
        numeroOrdine: 'SO1965613',
      }),
    ).toEqual({ primary: 'SO1965613', secondary: 'Order Confirmation' })
  })

  it('prefers filename over rekki message id in titolo/metadata', () => {
    expect(
      confermaOrdineDisplayLabel({
        titolo: '14697598',
        fileName: 'Sales Order Confirmation-543585.pdf',
        numeroFatturaMetadata: '14697598',
      }),
    ).toEqual({ primary: '543585', secondary: 'Sales Order' })
  })

  it('uses tipo from PDF filename not generic Order Confirmation', () => {
    expect(
      extractConfermaOrdineTipoLabel({
        fileName: 'Sales Order Confirmation-459253.pdf',
        oggettoMail: '**DO NOT REPLY EMAIL** La Tua Pasta Order Confirmation',
      }),
    ).toBe('Sales Order')
  })

  it('extracts reference from oggetto mail', () => {
    expect(
      confermaOrdineDisplayLabel({
        titolo: 'La Tua Pasta Order Confirmation',
        oggettoMail: 'Fwd: Order Confirmation: SO1234567',
      }),
    ).toEqual({ primary: 'SO1234567', secondary: 'Order Confirmation' })
  })
})
