import { describe, expect, it } from 'vitest'
import { analyzeBolleDuplicatesForDeletion } from '@/lib/check-duplicates'

describe('analyzeBolleDuplicatesForDeletion', () => {
  it('segna come excess la bolla orfana quando stesso fornitore/data/numero', () => {
    const analysis = analyzeBolleDuplicatesForDeletion([
      {
        id: 'orphan',
        fornitore_id: 'f1',
        sede_id: 's1',
        data: '2025-10-29',
        numero_bolla: null,
        file_url: 'https://x/a.pdf',
      },
      {
        id: 'numbered',
        fornitore_id: 'f1',
        sede_id: 's1',
        data: '2025-10-29',
        numero_bolla: '50221659',
        file_url: 'https://x/b.pdf',
        email_sync_auto_saved_at: '2025-10-30T10:00:00Z',
      },
    ])
    expect(analysis.excessIds.has('orphan')).toBe(true)
    expect(analysis.excessIds.has('numbered')).toBe(false)
  })

  it('non segna excess per stesso file_url se date o numeri diversi (PDF multi-documento)', () => {
    const url = 'https://x/same.pdf'
    const analysis = analyzeBolleDuplicatesForDeletion([
      {
        id: 'a',
        fornitore_id: 'f1',
        data: '2025-10-29',
        numero_bolla: '1',
        file_url: url,
      },
      {
        id: 'b',
        fornitore_id: 'f1',
        data: '2025-10-30',
        numero_bolla: '2',
        file_url: url,
      },
    ])
    expect(analysis.excessIds.size).toBe(0)
  })

  it('segna excess per stesso file_url, stessa data e stesso numero', () => {
    const url = 'https://x/dup.pdf'
    const analysis = analyzeBolleDuplicatesForDeletion([
      {
        id: 'a',
        fornitore_id: 'f1',
        data: '2025-10-29',
        numero_bolla: '50221659',
        file_url: url,
      },
      {
        id: 'b',
        fornitore_id: 'f1',
        data: '2025-10-29',
        numero_bolla: '50221659',
        file_url: url,
      },
    ])
    expect(analysis.excessIds.size).toBe(1)
    expect(analysis.excessIds.has('b')).toBe(true)
  })
})
