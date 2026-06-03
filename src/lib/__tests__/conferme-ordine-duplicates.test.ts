import { describe, expect, it } from 'vitest'
import {
  analyzeOrdineDuplicatesForDeletion,
  ordineExcessIdsForAutoDeletion,
  type OrdineDupListRow,
} from '@/lib/check-duplicates'

function row(partial: Partial<OrdineDupListRow> & { id: string }): OrdineDupListRow {
  const { id, ...rest } = partial
  return {
    fornitore_id: 'f1',
    data_ordine: null,
    numero_ordine: null,
    titolo: null,
    created_at: '2026-06-01T10:00:00Z',
    ...rest,
    id,
  }
}

describe('analyzeOrdineDuplicatesForDeletion (conferme)', () => {
  it('marks same file_url copies as excess when stesso numero e data ordine', () => {
    const url = 'https://x/doc.pdf'
    const a = analyzeOrdineDuplicatesForDeletion([
      row({
        id: 'old',
        created_at: '2026-05-01T00:00:00Z',
        data_ordine: '2026-04-01',
        numero_ordine: '533422',
        file_url: url,
        file_name: 'Sales Order Confirmation-533422.pdf',
      }),
      row({
        id: 'new',
        created_at: '2026-06-01T00:00:00Z',
        data_ordine: '2026-04-01',
        numero_ordine: '533422',
        file_url: url,
        file_name: 'Sales Order Confirmation-533422.pdf',
      }),
    ])
    expect(a.excessIds.has('new')).toBe(true)
    expect(a.excessIds.has('old')).toBe(false)
  })

  it('non segna duplicato stesso file senza data ordine (solo nome file)', () => {
    const url = 'https://x/doc.pdf'
    const a = analyzeOrdineDuplicatesForDeletion([
      row({ id: 'a', file_url: url, file_name: 'Sales Order Confirmation-533422.pdf' }),
      row({ id: 'b', file_url: url, file_name: 'Sales Order Confirmation-533422.pdf' }),
    ])
    expect(a.excessIds.size).toBe(0)
  })

  it('marks same numeric order number without date as excess (badge / elimina manuale)', () => {
    const a = analyzeOrdineDuplicatesForDeletion([
      row({ id: 'a', numero_ordine: '533422', file_name: 'Sales Order Confirmation-533422.pdf' }),
      row({ id: 'b', numero_ordine: '533422', data_ordine: '2026-04-01' }),
    ])
    expect(a.excessIds.size).toBe(1)
    expect([...a.excessIds][0]).toBe('a')
  })

  it('non segna duplicato stesso PDF con date ordine diverse (multi-documento)', () => {
    const url = 'https://x/multi.pdf'
    const a = analyzeOrdineDuplicatesForDeletion([
      row({
        id: 'a',
        data_ordine: '2025-06-02',
        numero_ordine: '533422',
        file_url: url,
        file_name: 'Orders.pdf',
      }),
      row({
        id: 'b',
        data_ordine: '2025-07-08',
        numero_ordine: '533422',
        file_url: url,
        file_name: 'Orders.pdf',
      }),
    ])
    expect(a.excessIds.size).toBe(0)
  })

  it('auto-delete solo per file_url o numero+data (non solo numero)', () => {
    const url = 'https://x/dup.pdf'
    const rows = [
      row({ id: 'a', numero_ordine: '533422', file_name: 'Sales Order Confirmation-533422.pdf' }),
      row({ id: 'b', numero_ordine: '999001', data_ordine: '2026-04-01' }),
      row({
        id: 'old',
        created_at: '2026-05-01T00:00:00Z',
        data_ordine: '2026-04-01',
        numero_ordine: '533422',
        file_url: url,
      }),
      row({
        id: 'new',
        created_at: '2026-06-01T00:00:00Z',
        data_ordine: '2026-04-01',
        numero_ordine: '533422',
        file_url: url,
      }),
    ]
    expect(ordineExcessIdsForAutoDeletion(rows).sort()).toEqual(['new'])
    expect(ordineExcessIdsForAutoDeletion(rows)).not.toContain('b')
  })
})
