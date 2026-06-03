import { describe, expect, it } from 'vitest'
import {
  extractNumeroFromDocStrings,
  metadataNumeroFattura,
  resolvePendingDocNumeroFattura,
} from '@/lib/extract-numero-from-doc'

describe('extract-numero-from-doc', () => {
  it('preferisce metadata.numero_fattura', () => {
    expect(
      resolvePendingDocNumeroFattura({
        file_name: 'credit.pdf',
        metadata: { numero_fattura: 'CN-9912' },
      }),
    ).toBe('CN-9912')
  })

  it('estrae prefissi nota credito dal nome file', () => {
    expect(extractNumeroFromDocStrings('CN-2026-445.pdf', null)).toBe('2026-445')
    expect(extractNumeroFromDocStrings('NC_1289123.pdf', null)).toBe('1289123')
  })

  it('metadataNumeroFattura ignora stringhe vuote', () => {
    expect(metadataNumeroFattura({ numero_fattura: '  ' })).toBeNull()
  })
})
