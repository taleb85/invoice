import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'
import {
  sortStatementsByDocumentDateDesc,
  statementListDocumentDateKey,
  type StatementListRow,
} from '@/lib/statement-list-dedup'

export type StatementRowSigInput = {
  numero_doc: string | null
  importo: number | null
}

/** Firma riga: numero normalizzato + importo (2 decimali). */
export function buildStatementRowSignatureSet(rows: StatementRowSigInput[]): Set<string> {
  const set = new Set<string>()
  for (const r of rows) {
    const raw = (r.numero_doc ?? '').trim()
    if (!raw) continue
    const num = normalizeNumeroFattura(raw) || raw
    const imp = Number(r.importo ?? 0)
    if (!Number.isFinite(imp)) continue
    set.add(`${num}|${imp.toFixed(2)}`)
  }
  return set
}

export function isStatementSignatureSubset(subset: Set<string>, superset: Set<string>): boolean {
  if (subset.size === 0) return false
  for (const sig of subset) {
    if (!superset.has(sig)) return false
  }
  return true
}

/**
 * Nasconde estratti il cui contenuto righe è interamente incluso in un estratto
 * più recente dello stesso fornitore (tipico statement cumulativi settimanali).
 */
export function hideStatementsSupersededByContent<T extends StatementListRow>(
  statements: T[],
  signaturesByStatementId: Map<string, Set<string>>,
): T[] {
  const passthrough: T[] = []
  const byFornitore = new Map<string, T[]>()

  for (const s of statements) {
    const fid = s.fornitore_id
    if (!fid) {
      passthrough.push(s)
      continue
    }
    const list = byFornitore.get(fid) ?? []
    list.push(s)
    byFornitore.set(fid, list)
  }

  const kept: T[] = [...passthrough]

  for (const group of byFornitore.values()) {
    const sorted = [...group].sort((a, b) =>
      statementListDocumentDateKey(b).localeCompare(statementListDocumentDateKey(a)),
    )
    const keptSigs: Set<string>[] = []

    for (const s of sorted) {
      const sig = signaturesByStatementId.get(s.id) ?? new Set<string>()
      const superseded = keptSigs.some((olderKept) => isStatementSignatureSubset(sig, olderKept))
      if (!superseded) {
        kept.push(s)
        if (sig.size > 0) keptSigs.push(sig)
      }
    }
  }

  return sortStatementsByDocumentDateDesc(kept)
}

export async function fetchStatementRowSignatures(
  supabase: SupabaseClient,
  statementIds: string[],
): Promise<Map<string, Set<string>>> {
  const ids = [...new Set(statementIds.filter(Boolean))].slice(0, 500)
  const out = new Map<string, Set<string>>()
  if (!ids.length) return out

  const { data: rows } = await supabase
    .from('statement_rows')
    .select('statement_id, numero_doc, importo')
    .in('statement_id', ids)

  const byStmt = new Map<string, StatementRowSigInput[]>()
  for (const row of rows ?? []) {
    const sid = row.statement_id as string
    const list = byStmt.get(sid) ?? []
    list.push({
      numero_doc: row.numero_doc as string | null,
      importo: row.importo as number | null,
    })
    byStmt.set(sid, list)
  }

  for (const id of ids) {
    out.set(id, buildStatementRowSignatureSet(byStmt.get(id) ?? []))
  }
  return out
}

export async function hideSupersededStatementsForList<T extends StatementListRow>(
  supabase: SupabaseClient,
  statements: T[],
): Promise<T[]> {
  if (statements.length <= 1) return statements
  const sigs = await fetchStatementRowSignatures(
    supabase,
    statements.map((s) => s.id),
  )
  return hideStatementsSupersededByContent(statements, sigs)
}
