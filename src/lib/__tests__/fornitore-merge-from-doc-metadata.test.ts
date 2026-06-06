import { describe, expect, it, vi } from 'vitest'
import {
  backfillFornitoreAnagraficaFromDocuments,
  mergeFornitoreMissingFromDocMetadata,
} from '@/lib/fornitore-merge-from-doc-metadata'

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
