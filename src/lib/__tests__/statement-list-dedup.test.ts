import { describe, expect, it } from 'vitest'
import {
  dedupeStatementsForList,
  normalizeStatementFileUrl,
  sortStatementsByDocumentDateDesc,
} from '@/lib/statement-list-dedup'

describe('normalizeStatementFileUrl', () => {
  it('rimuove newline nell’URL', () => {
    expect(normalizeStatementFileUrl('https://x.co\n/storage/a.pdf')).toBe('https://x.co/storage/a.pdf')
  })
})

describe('dedupeStatementsForList', () => {
  it('tiene un solo estratto per fornitore+data quando email_subject è null', () => {
    const rows = dedupeStatementsForList([
      {
        id: 'a',
        fornitore_id: 'f1',
        document_date: '2026-05-08',
        received_at: '2026-05-08T10:00:00Z',
        file_url: 'https://x/a.pdf',
      },
      {
        id: 'b',
        fornitore_id: 'f1',
        document_date: '2026-05-08',
        received_at: '2026-05-27T10:00:00Z',
        file_url: 'https://x/b.pdf',
      },
      {
        id: 'c',
        fornitore_id: 'f1',
        document_date: '2026-05-01',
        received_at: '2026-05-27T09:00:00Z',
        file_url: 'https://x/c.pdf',
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('deduplica per file_url normalizzato', () => {
    const rows = dedupeStatementsForList([
      {
        id: 'a',
        fornitore_id: 'f1',
        document_date: '2026-04-01',
        received_at: '2026-04-01',
        file_url: 'https://x.co/storage/s.pdf',
      },
      {
        id: 'b',
        fornitore_id: 'f1',
        document_date: '2026-04-02',
        received_at: '2026-04-02',
        file_url: 'https://x.co\n/storage/s.pdf',
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('b')
  })

  it('ordina per data documento decrescente', () => {
    const sorted = sortStatementsByDocumentDateDesc([
      { id: 'a', document_date: '2026-04-01', received_at: '2026-05-27' },
      { id: 'b', document_date: '2026-05-08', received_at: '2026-05-01' },
      { id: 'c', document_date: '2026-03-15', received_at: '2026-05-27' },
    ])
    expect(sorted.map((s) => s.id)).toEqual(['b', 'a', 'c'])
  })
})
