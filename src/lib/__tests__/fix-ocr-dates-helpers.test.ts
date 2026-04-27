import { describe, expect, it } from 'vitest'
import {
  shouldMigrateBollaRowToFattura,
  inferContentTypeFromBuffer,
} from '@/lib/fix-ocr-dates-helpers'

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

  it('migrates when OCR says altro but row has numero+importo (no OCR pair)', () => {
    expect(
      shouldMigrateBollaRowToFattura({
        ocr: {
          tipo_documento: 'altro',
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

  it('migrates on Rianalizza when filename looks like delivery note (storage path is unreliable)', () => {
    expect(
      shouldMigrateBollaRowToFattura({
        ocr: {
          tipo_documento: 'bolla',
          numero_fattura: null,
          totale_iva_inclusa: null,
        },
        fileUrl: 'https://x.supabase.co/storage/.../delivery-note-ocr.jpg',
        bollaIdForce: true,
        allowTipoMigrate: true,
        existingNumeroBolla: '206338',
        existingImporto: 305.39,
      }),
    ).toBe(true)
  })

  it('migrates when filename mixes invoice+delivery words but row is complete (Rianalizza)', () => {
    expect(
      shouldMigrateBollaRowToFattura({
        ocr: {
          tipo_documento: 'bolla',
          numero_fattura: null,
          totale_iva_inclusa: null,
        },
        fileUrl: 'https://x.supabase.co/storage/.../invoice-delivery-note-scan.pdf',
        bollaIdForce: true,
        allowTipoMigrate: true,
        existingNumeroBolla: '1',
        existingImporto: 100,
      }),
    ).toBe(true)
  })

  it('migrates when OCR returns only importo and row has only numero (cross pair)', () => {
    expect(
      shouldMigrateBollaRowToFattura({
        ocr: {
          tipo_documento: 'bolla',
          numero_fattura: null,
          totale_iva_inclusa: 120.5,
        },
        fileUrl: baseUrl,
        bollaIdForce: true,
        allowTipoMigrate: true,
        existingNumeroBolla: 'INV-9001',
        existingImporto: null,
      }),
    ).toBe(true)
  })
})

describe('inferContentTypeFromBuffer', () => {
  it('detects JPEG', () => {
    const b = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(inferContentTypeFromBuffer(b)).toBe('image/jpeg')
  })
  it('detects PNG', () => {
    const b = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xd, 0xa, 0x1a, 0xa, 0, 0, 0, 0])
    expect(inferContentTypeFromBuffer(b)).toBe('image/png')
  })
  it('detects PDF', () => {
    const b = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0, 0, 0, 0, 0, 0])
    expect(inferContentTypeFromBuffer(b)).toBe('application/pdf')
  })
  it('returns null for empty buffer', () => {
    expect(inferContentTypeFromBuffer(Buffer.alloc(0))).toBeNull()
  })
})
