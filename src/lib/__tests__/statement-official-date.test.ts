import { describe, expect, it } from 'vitest'
import { resolveStatementDocumentDate, statementOfficialDateIso } from '@/lib/statement-official-date'

describe('statementOfficialDateIso', () => {
  it('preferisce issued_date del PDF', () => {
    expect(
      statementOfficialDateIso({
        document_date: '2026-05-17',
        extracted_pdf_dates: { issued_date: '2026-04-30' },
      }),
    ).toBe('2026-04-30')
  })

  it('resolveStatementDocumentDate preferisce issued_date rispetto a data_documento coda', () => {
    expect(resolveStatementDocumentDate({ issued_date: '2026-03-31' }, '2026-05-17')).toBe('2026-03-31')
  })
})
