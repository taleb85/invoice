import { describe, expect, it } from 'vitest'
import {
  buildStatementRowSignatureSet,
  hideStatementsSupersededByContent,
  isStatementSignatureSubset,
} from '@/lib/statement-content-dedup'

describe('statement-content-dedup', () => {
  it('rileva sottoinsieme righe', () => {
    const a = buildStatementRowSignatureSet([
      { numero_doc: '53101', importo: 100 },
      { numero_doc: '53128', importo: 50 },
    ])
    const b = buildStatementRowSignatureSet([
      { numero_doc: '0053101', importo: 100 },
      { numero_doc: '53128', importo: 50 },
      { numero_doc: '53194', importo: 20 },
    ])
    expect(isStatementSignatureSubset(a, b)).toBe(true)
    expect(isStatementSignatureSubset(b, a)).toBe(false)
  })

  it('nasconde estratto vecchio cumulativo', () => {
    const older = {
      id: 'old',
      fornitore_id: 'f1',
      document_date: '2026-05-01',
      received_at: '2026-05-01',
    }
    const newer = {
      id: 'new',
      fornitore_id: 'f1',
      document_date: '2026-05-08',
      received_at: '2026-05-08',
    }
    const sigs = new Map([
      ['old', buildStatementRowSignatureSet([{ numero_doc: '1', importo: 10 }])],
      [
        'new',
        buildStatementRowSignatureSet([
          { numero_doc: '1', importo: 10 },
          { numero_doc: '2', importo: 20 },
        ]),
      ],
    ])
    const kept = hideStatementsSupersededByContent([older, newer], sigs)
    expect(kept.map((s) => s.id)).toEqual(['new'])
  })
})
