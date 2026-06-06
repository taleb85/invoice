import type { SupabaseClient } from '@supabase/supabase-js'
import { fornitoreNomeMatchesOcr, tokenOverlapRatio } from '@/lib/fornitore-cross-check'
import { extractSupplierHintFromDocContext } from '@/lib/extract-supplier-from-filename'
import { resolveFornitoreByPartialNameEnhanced } from '@/lib/fornitore-infer-from-document'

export type AuditFornitoreSuggestInput = {
  file_name: string | null
  oggetto_mail: string | null
  metadata: unknown
  fornitore_fattura: string | null
  fornitore_bolla: string | null
}

export type AuditFornitoreSuggestResult = {
  suggested_fornitore_id: string | null
  suggested_fornitore_nome: string | null
  suggested_from_hint: string | null
  supplier_mismatch: boolean
}

export function auditAssignedFornitoreNome(row: {
  fornitore_fattura: string | null
  fornitore_bolla: string | null
}): string | null {
  return row.fornitore_fattura?.trim() || row.fornitore_bolla?.trim() || null
}

export function auditSupplierNamesMismatch(
  assignedNome: string | null | undefined,
  suggestedNome: string | null | undefined,
): boolean {
  const assigned = assignedNome?.trim()
  const suggested = suggestedNome?.trim()
  if (!assigned || !suggested) return false
  if (fornitoreNomeMatchesOcr(assigned, suggested)) return false
  return tokenOverlapRatio(assigned, suggested) < 0.35
}

export async function suggestFornitoreForAuditRow(
  supabase: SupabaseClient,
  sedeId: string,
  row: AuditFornitoreSuggestInput,
): Promise<AuditFornitoreSuggestResult> {
  const hint = extractSupplierHintFromDocContext(row.file_name, row.oggetto_mail, row.metadata)
  if (!hint) {
    return {
      suggested_fornitore_id: null,
      suggested_fornitore_nome: null,
      suggested_from_hint: null,
      supplier_mismatch: false,
    }
  }

  const found = await resolveFornitoreByPartialNameEnhanced(supabase, hint, sedeId)
  const assignedNome = auditAssignedFornitoreNome(row)
  const suggestedNome = found?.nome?.trim() ?? hint
  const supplier_mismatch = auditSupplierNamesMismatch(assignedNome, suggestedNome)

  return {
    suggested_fornitore_id: found?.id ?? null,
    suggested_fornitore_nome: found?.nome?.trim() ?? hint,
    suggested_from_hint: hint,
    supplier_mismatch,
  }
}
