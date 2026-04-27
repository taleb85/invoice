import { describe, expect, it } from 'vitest'
import { shouldMigrateBollaRowToFattura } from '@/lib/fix-ocr-dates-helpers'

describe('shouldMigrateBollaRowToFattura', () => {
  const baseUrl = 'https://xxx.supabase.co/storage/v1/object/public/documenti/ab/cd/uuid.jpg'

  it('migrates when OCR says bolla but does not return numero/totale and row has both', () => {
    expect(
      shouldMigrateBollaRowToFattura({
        ocr: {
          tipo_documento: 'bolla',
          numero_fattura: null,
          totale_iva_inclusa: null,
        },
        fileUrl: baseUrl,
        bollaIdForce: true,
        allowTipoMigrate: true,
        existingNumeroBolla: '206338',
        existingImporto: 305.39,
      }),
    ).toBe(true)
  })

  it('does not use row fallback when OCR already returned numero+totale pair', () => {
    expect(
      shouldMigrateBollaRowToFattura({
        ocr: {
          tipo_documento: 'bolla',
          numero_fattura: '99',
          totale_iva_inclusa: 10,
        },
        fileUrl: baseUrl,
        bollaIdForce: true,
        allowTipoMigrate: true,
        existingNumeroBolla: '206338',
        existingImporto: 305.39,
      }),
    ).toBe(true)
  })

  it('does not migrate without row or OCR pair when tipo is bolla', () => {
    expect(
      shouldMigrateBollaRowToFattura({
        ocr: {
          tipo_documento: 'bolla',
          numero_fattura: null,
          totale_iva_inclusa: null,
        },
        fileUrl: baseUrl,
        bollaIdForce: true,
        allowTipoMigrate: true,
        existingNumeroBolla: null,
        existingImporto: null,
      }),
    ).toBe(false)
  })
})
