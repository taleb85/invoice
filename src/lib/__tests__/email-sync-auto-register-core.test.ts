/**
 * Unit test per `insertEmailAutoBolla`: verifica che lo scan email non
 * registri due volte la stessa bolla né per file_url né per la chiave
 * fornitore+data+numero_bolla quando il PDF viene reinviato/ri-scaricato.
 *
 * (Per `insertEmailAutoFattura` il check duplicati esisteva già ed è coperto
 * dai test di `fattura-duplicate-check`.)
 */
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { insertEmailAutoBolla } from '@/lib/email-sync-auto-register-core'

type BollaRow = {
  id: string
  fornitore_id: string
  sede_id: string | null
  data: string
  file_url: string
  numero_bolla: string | null
}

/**
 * Mock Supabase con tabella `bolle` in-memory: replica le chiamate fluent usate
 * dal codice di produzione (select.eq.eq.limit.maybeSingle, select.eq.eq, insert.select.single).
 */
function mockSupabaseWithBolle(initial: BollaRow[]): {
  supabase: SupabaseClient
  rows: BollaRow[]
  inserts: BollaRow[]
} {
  const rows = [...initial]
  const inserts: BollaRow[] = []

  const buildSelectChain = (filters: Record<string, unknown> = {}) => {
    const filterRow = (row: BollaRow) =>
      Object.entries(filters).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v)
    const chain = {
      eq(column: string, value: unknown) {
        return buildSelectChain({ ...filters, [column]: value })
      },
      limit(_n: number) {
        return chain
      },
      maybeSingle() {
        const match = rows.find(filterRow) ?? null
        return Promise.resolve({ data: match, error: null })
      },
      then(resolve: (v: { data: BollaRow[]; error: null }) => unknown) {
        return Promise.resolve({ data: rows.filter(filterRow), error: null }).then(resolve)
      },
    }
    return chain
  }

  const from = vi.fn((table: string) => {
    if (table !== 'bolle') throw new Error(`Tabella non mockata: ${table}`)
    return {
      select() {
        return buildSelectChain()
      },
      insert(payloads: Array<Partial<BollaRow>>) {
        const inserted: BollaRow = {
          id: `inserted-${inserts.length + 1}`,
          fornitore_id: payloads[0].fornitore_id ?? '',
          sede_id: payloads[0].sede_id ?? null,
          data: payloads[0].data ?? '',
          file_url: payloads[0].file_url ?? '',
          numero_bolla: payloads[0].numero_bolla ?? null,
        }
        inserts.push(inserted)
        rows.push(inserted)
        return {
          select() {
            return {
              single() {
                return Promise.resolve({ data: { id: inserted.id }, error: null })
              },
            }
          },
        }
      },
    }
  })

  return {
    supabase: { from } as unknown as SupabaseClient,
    rows,
    inserts,
  }
}

describe('insertEmailAutoBolla — skip duplicati', () => {
  const fornitoreId = '111-fornitore'
  const sedeId = 'aaa-sede'

  it('ritorna duplicateId quando esiste una bolla con lo stesso file_url', async () => {
    const existing: BollaRow = {
      id: 'bolla-1',
      fornitore_id: fornitoreId,
      sede_id: sedeId,
      data: '2026-05-20',
      file_url: 'https://x/storage/file.pdf',
      numero_bolla: 'DDT-001',
    }
    const { supabase, inserts } = mockSupabaseWithBolle([existing])

    const res = await insertEmailAutoBolla(supabase, {
      fornitoreId,
      sedeId,
      dataDoc: '2026-05-20',
      fileUrl: 'https://x/storage/file.pdf',
      numeroBolla: 'DDT-001',
      importo: 100,
    })

    expect(res).toEqual({ duplicateId: 'bolla-1' })
    expect(inserts).toHaveLength(0)
  })

  it('ritorna duplicateId quando file_url cambia ma fornitore+data+numero coincidono', async () => {
    const existing: BollaRow = {
      id: 'bolla-2',
      fornitore_id: fornitoreId,
      sede_id: sedeId,
      data: '2026-05-20',
      file_url: 'https://x/storage/old.pdf',
      numero_bolla: 'DDT-002',
    }
    const { supabase, inserts } = mockSupabaseWithBolle([existing])

    const res = await insertEmailAutoBolla(supabase, {
      fornitoreId,
      sedeId,
      dataDoc: '2026-05-20',
      fileUrl: 'https://x/storage/new.pdf',
      numeroBolla: 'DDT-002',
      importo: 100,
    })

    expect(res).toEqual({ duplicateId: 'bolla-2' })
    expect(inserts).toHaveLength(0)
  })

  it('inserisce la bolla quando il numero differisce anche con stessa data', async () => {
    const existing: BollaRow = {
      id: 'bolla-3',
      fornitore_id: fornitoreId,
      sede_id: sedeId,
      data: '2026-05-20',
      file_url: 'https://x/storage/old.pdf',
      numero_bolla: 'DDT-001',
    }
    const { supabase, inserts } = mockSupabaseWithBolle([existing])

    const res = await insertEmailAutoBolla(supabase, {
      fornitoreId,
      sedeId,
      dataDoc: '2026-05-20',
      fileUrl: 'https://x/storage/new.pdf',
      numeroBolla: 'DDT-999',
      importo: 100,
    })

    expect(res).toMatchObject({ id: expect.any(String) })
    expect(inserts).toHaveLength(1)
    expect(inserts[0].numero_bolla).toBe('DDT-999')
  })

  it('non considera duplicato se la sede differisce (multi-sede su stesso fornitore)', async () => {
    const existing: BollaRow = {
      id: 'bolla-4',
      fornitore_id: fornitoreId,
      sede_id: 'altra-sede',
      data: '2026-05-20',
      file_url: 'https://x/storage/old.pdf',
      numero_bolla: 'DDT-005',
    }
    const { supabase, inserts } = mockSupabaseWithBolle([existing])

    const res = await insertEmailAutoBolla(supabase, {
      fornitoreId,
      sedeId,
      dataDoc: '2026-05-20',
      fileUrl: 'https://x/storage/new.pdf',
      numeroBolla: 'DDT-005',
      importo: 100,
    })

    expect(res).toMatchObject({ id: expect.any(String) })
    expect(inserts).toHaveLength(1)
  })

  it('non blocca senza numero bolla quando data o numero sono assenti', async () => {
    const { supabase, inserts } = mockSupabaseWithBolle([])

    const res = await insertEmailAutoBolla(supabase, {
      fornitoreId,
      sedeId,
      dataDoc: '2026-05-20',
      fileUrl: 'https://x/storage/file.pdf',
      numeroBolla: null,
      importo: 100,
    })

    expect(res).toMatchObject({ id: expect.any(String) })
    expect(inserts).toHaveLength(1)
  })
})
