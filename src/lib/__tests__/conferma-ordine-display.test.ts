import { describe, expect, it } from 'vitest'
import {
  cleanConfermaOrdineTitleText,
  confermaOrdineDisplayLabel,
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

  it('uses metadata numero when column is empty', () => {
    expect(
      confermaOrdineDisplayLabel({
        titolo: '14697598 Order Confirmation',
        numeroFatturaMetadata: 'PO-778899',
      }),
    ).toEqual({ primary: 'PO-778899', secondary: 'Order Confirmation' })
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
