import { describe, expect, it, vi } from 'vitest'
import {
  backfillFornitoreAnagraficaFromDocuments,
  mergeFornitoreContattiFromDocMetadata,
  mergeFornitoreMissingFromDocMetadata,
} from '@/lib/fornitore-merge-from-doc-metadata'
import { extractPhoneNumbersFromText } from '@/lib/fornitore-cross-check'

describe('mergeFornitoreMissingFromDocMetadata', () => {
  it('fills empty piva and indirizzo from metadata', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'fornitori') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'f1', nome: 'V & S Catering Supplies Ltd', piva: null, email: 'a@b.com', indirizzo: null },
                }),
              }),
            }),
            update,
          }
        }
        return {}
      }),
    }

    const r = await mergeFornitoreMissingFromDocMetadata(
      supabase as never,
      'f1',
      {
        p_iva: '234655754',
        indirizzo: '85 Castlehaven Road, London, NW1 8SJ',
        ragione_sociale: 'V & S Catering Supplies Ltd',
      },
      'messaging-service@post.xero.com',
    )

    expect(r.updated).toBe(true)
    expect(r.fields).toEqual(expect.arrayContaining(['piva', 'indirizzo']))
    expect(update).toHaveBeenCalledWith({
      piva: '234655754',
      indirizzo: '85 Castlehaven Road, London, NW1 8SJ',
    })
  })
})

describe('backfillFornitoreAnagraficaFromDocuments', () => {
  it('reads linked documents and merges first useful metadata', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'documenti_da_processare') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          metadata: { p_iva: '234655754', indirizzo: '85 Castlehaven Road' },
                          mittente: 'xero@post.com',
                        },
                      ],
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (table === 'fornitori') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'f1', nome: 'Acme', piva: null, email: null, indirizzo: null },
                }),
              }),
            }),
            update,
          }
        }
        return {}
      }),
    }

    const r = await backfillFornitoreAnagraficaFromDocuments(supabase as never, 'f1')
    expect(r.updated).toBe(true)
    expect(r.fields).toContain('piva')
  })
})

describe('extractPhoneNumbersFromText', () => {
  it('finds UK numbers on statement letterhead', () => {
    const text =
      'V & S Catering Supplies Ltd\n020-7485 2658 / 020-7916 4717\nvandscatering@yahoo.com'
    const phones = extractPhoneNumbersFromText(text)
    expect(phones.length).toBeGreaterThanOrEqual(2)
    expect(phones.join(' ')).toMatch(/020-7485 2658/)
  })
})

describe('mergeFornitoreContattiFromDocMetadata', () => {
  it('inserts contatto from metadata telefono', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'fornitore_contatti') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert,
          }
        }
        return {}
      }),
    }

    const r = await mergeFornitoreContattiFromDocMetadata(supabase as never, 'f1', {
      ragione_sociale: 'V & S Catering Supplies Ltd',
      telefono: '020-7485 2658',
      email_contatto: 'vandscatering@yahoo.com',
    })

    expect(r.inserted).toBe(true)
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        fornitore_id: 'f1',
        nome: 'V & S Catering Supplies Ltd',
        ruolo: 'Da documento',
        telefono: '020-7485 2658',
        email: 'vandscatering@yahoo.com',
      }),
    ])
  })
})
