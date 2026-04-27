import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00])

const bollaRow = {
  id: 'bolla-test-1',
  fornitore_id: 'for-1',
  sede_id: 'sede-1',
  data: '2024-03-10',
  file_url: 'https://x.supabase.co/storage/v1/object/public/inv/scan.jpg',
  importo: 100.5,
  numero_bolla: 'N-1',
  stato: 'in attesa',
}

const ocrBollaHeuristic = {
  ragione_sociale: null,
  p_iva: null,
  indirizzo: null,
  data_fattura: '2024-03-10',
  numero_fattura: 'INV-99',
  tipo_documento: 'bolla' as const,
  totale_iva_inclusa: 100.5,
  note_corpo_mail: null,
  nome: null,
  piva: null,
  data: '2024-03-10',
}

const { ocrSpy, getProfile, createServiceClient } = vi.hoisted(() => {
  const ocrSpy = vi.fn()
  return {
    ocrSpy,
    getProfile: vi.fn(),
    createServiceClient: vi.fn(),
  }
})

vi.mock('@/utils/supabase/server', () => ({
  getProfile,
  createServiceClient,
}))

vi.mock('@/lib/ocr-invoice', () => ({
  ocrInvoice: ocrSpy,
  OcrInvoiceConfigurationError: class OcrInvoiceConfigurationError extends Error {
    name = 'OcrInvoiceConfigurationError' as const
  },
}))

vi.mock('@/lib/documenti-storage-url', () => ({
  downloadStorageObjectByFileUrl: vi.fn().mockResolvedValue({
    data: jpegBuf,
    contentType: 'image/jpeg',
  }),
}))

function serviceMockBollaToFattura() {
  return {
    from(table: string) {
      if (table === 'bolle') {
        return {
          select: () => ({
            eq: (col: string) => {
              if (col === 'id') {
                return {
                  single: () => Promise.resolve({ data: bollaRow, error: null }),
                }
              }
              return {
                single: () => Promise.resolve({ data: null, error: { message: 'unexpected' } }),
              }
            },
          }),
          delete: () => ({
            eq: (col: string) => {
              if (col === 'id' && bollaRow.id) {
                return Promise.resolve({ error: null })
              }
              return Promise.resolve({ error: { message: 'delete fail' } })
            },
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }
      }
      if (table === 'fatture') {
        return {
          select: (cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: () => Promise.resolve({ count: 0, error: null }),
              }
            }
            return {
              eq: () => ({
                in: () => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: { message: 'n/a' } }),
              }),
            }
          },
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'fattura-new-1' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'fattura_bolle') {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: () => Promise.resolve({ count: 0, error: null }),
              }
            }
            return {
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: { message: 'n/a' } }),
              }),
            }
          },
        }
      }
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'n/a' } }) }) }),
      }
    },
  }
}

beforeEach(() => {
  vi.resetModules()
  getProfile.mockResolvedValue({ id: 'user-1', role: 'admin', sede_id: null })
  createServiceClient.mockReturnValue(serviceMockBollaToFattura() as never)
  ocrSpy.mockResolvedValue(ocrBollaHeuristic)
})

describe('POST /api/admin/fix-ocr-dates (bolla_id + allow_tipo_migrate)', () => {
  it('migra bolla → fattura quando l’OCR resta bolla ma numero+importo coerenti', async () => {
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/admin/fix-ocr-dates', {
      method: 'POST',
      body: JSON.stringify({
        bolla_id: bollaRow.id,
        allow_tipo_migrate: true,
      }),
    })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.tipoMigratedToFattura).toBe(1)
    expect(json.corrected).toBe(1)
    const migrated = (json.details as { action: string; id: string }[]).find(
      (d) => d.action === 'migrated_to_fattura',
    )
    expect(migrated).toBeDefined()
    expect(migrated?.id).toBe('fattura-new-1')
  })

  it('risponde 401 senza profilo', async () => {
    getProfile.mockResolvedValueOnce(null)
    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/admin/fix-ocr-dates', {
      method: 'POST',
      body: JSON.stringify({ bolla_id: bollaRow.id, allow_tipo_migrate: true }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
