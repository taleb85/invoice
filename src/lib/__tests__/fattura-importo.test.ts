import { describe, expect, it } from 'vitest'
import {
  formatSignedFatturaImporto,
  signedFatturaImporto,
  storedFatturaImportoFromEdit,
} from '@/lib/fattura-importo'

describe('signedFatturaImporto', () => {
  it('negates credit note amounts stored as positive', () => {
    expect(signedFatturaImporto(6.12, true)).toBe(-6.12)
    expect(signedFatturaImporto(-6.12, true)).toBe(-6.12)
  })

  it('leaves invoice amounts unchanged', () => {
    expect(signedFatturaImporto(6.12, false)).toBe(6.12)
  })
})

describe('formatSignedFatturaImporto', () => {
  it('formats credit notes with minus sign', () => {
    const label = formatSignedFatturaImporto(6.12, true, 'GBP', 'en')
    expect(label).toMatch(/-/)
    expect(label).toMatch(/6\.12/)
  })
})

describe('storedFatturaImportoFromEdit', () => {
  it('stores absolute value for credit notes', () => {
    expect(storedFatturaImportoFromEdit(-6.12, true)).toBe(6.12)
    expect(storedFatturaImportoFromEdit(6.12, true)).toBe(6.12)
  })
})
