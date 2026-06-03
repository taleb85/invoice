import { describe, expect, it } from 'vitest'
import {
  bollaDuplicateGroupKey,
  rowsLookLikeMultiDocInSamePdf,
} from '@/lib/duplicate-group-keys'

describe('duplicate-group-keys', () => {
  it('bollaDuplicateGroupKey include la data documento', () => {
    const base = {
      fornitore_id: 'f1',
      numero_bolla: '50221659',
    }
    const k1 = bollaDuplicateGroupKey({ ...base, data: '2025-06-02' })
    const k2 = bollaDuplicateGroupKey({ ...base, data: '2025-07-08' })
    expect(k1).toBeTruthy()
    expect(k2).toBeTruthy()
    expect(k1).not.toBe(k2)
  })

  it('rowsLookLikeMultiDocInSamePdf con stesso PDF e date diverse', () => {
    const url = 'https://x/multi.pdf'
    expect(
      rowsLookLikeMultiDocInSamePdf([
        { file_url: url, documentDate: '2025-06-02', documentNumero: 'A' },
        { file_url: url, documentDate: '2025-07-08', documentNumero: 'A' },
      ]),
    ).toBe(true)
  })

  it('rowsLookLikeMultiDocInSamePdf con stesso PDF stessa data e numero → non multi-doc', () => {
    const url = 'https://x/dup.pdf'
    expect(
      rowsLookLikeMultiDocInSamePdf([
        { file_url: url, documentDate: '2025-06-02', documentNumero: 'A' },
        { file_url: url, documentDate: '2025-06-02', documentNumero: 'A' },
      ]),
    ).toBe(false)
  })
})
