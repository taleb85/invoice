import { statementOfficialDateIso, type StatementExtractedPdfDates } from '@/lib/statement-official-date'

export type StatementListRow = {
  id: string
  fornitore_id?: string | null
  sede_id?: string | null
  email_subject?: string | null
  received_at?: string | null
  document_date?: string | null
  extracted_pdf_dates?: StatementExtractedPdfDates | null
  file_url?: string | null
}

/** Normalizza URL storage (rimuove newline/spazi che rompono il dedup per file). */
export function normalizeStatementFileUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return ''
  return fileUrl.replace(/\s+/g, '').trim()
}

function statementPeriodKey(s: StatementListRow): string {
  return (
    statementOfficialDateIso({
      document_date: s.document_date,
      extracted_pdf_dates: s.extracted_pdf_dates,
    }) ?? ''
  )
}

function pickNewer(a: StatementListRow, b: StatementListRow): StatementListRow {
  const at = String(a.received_at ?? '')
  const bt = String(b.received_at ?? '')
  return bt > at ? b : a
}

/**
 * Deduplica la lista estratti per la UI:
 * 1. stesso file_url normalizzato
 * 2. stesso fornitore + oggetto email + periodo
 * 3. stesso fornitore + periodo (quando oggetto email assente — tipico G Lawrence)
 */
export function dedupeStatementsForList<T extends StatementListRow>(statements: T[]): T[] {
  const byFile = new Map<string, T>()
  for (const s of statements) {
    const fileKey = normalizeStatementFileUrl(s.file_url)
    if (fileKey) {
      const prev = byFile.get(fileKey)
      byFile.set(fileKey, prev ? pickNewer(prev, s) : s)
      continue
    }
    byFile.set(`__no_file__:${s.id}`, s)
  }

  const afterFile = [...byFile.values()]

  const subjectBest = new Map<string, T>()
  const noSubject: T[] = []

  for (const s of afterFile) {
    const subject = (s.email_subject ?? '').trim().toLowerCase()
    const period = statementPeriodKey(s)
    if (!subject) {
      noSubject.push(s)
      continue
    }
    const key = `${String(s.sede_id ?? '')}:${String(s.fornitore_id ?? '')}:${subject}:${period}`
    const prev = subjectBest.get(key)
    subjectBest.set(key, prev ? pickNewer(prev, s) : s)
  }

  const periodBest = new Map<string, T>()
  const noPeriod: T[] = []
  for (const s of noSubject) {
    const period = statementPeriodKey(s)
    if (!period) {
      noPeriod.push(s)
      continue
    }
    const key = `${String(s.sede_id ?? '')}:${String(s.fornitore_id ?? '')}:${period}`
    const prev = periodBest.get(key)
    periodBest.set(key, prev ? pickNewer(prev, s) : s)
  }

  return [...subjectBest.values(), ...periodBest.values(), ...noPeriod].sort((a, b) =>
    String(b.received_at ?? '').localeCompare(String(a.received_at ?? '')),
  )
}
