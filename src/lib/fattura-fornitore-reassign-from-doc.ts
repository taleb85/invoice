import type { SupabaseClient } from '@supabase/supabase-js'
import { extractSupplierHintFromDocContext } from '@/lib/extract-supplier-from-filename'
import { auditSupplierNamesMismatch } from '@/lib/inbox-audit-fornitore-suggest'
import { fornitoreNomeMatchesOcr, tokenOverlapRatio } from '@/lib/fornitore-cross-check'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'
import { resolveFornitoreByPartialNameEnhanced } from '@/lib/fornitore-infer-from-document'

export type FatturaFornitoreCorrectionInput = {
  currentFornitoreId: string
  currentFornitoreNome: string
  sedeId: string
  fileName: string | null
  emailSubject: string | null
  metadata: unknown
  ocrRagioneSociale: string | null | undefined
  mittente?: string | null
}

export type FatturaFornitoreCorrectionResult = {
  nuovoFornitoreId: string
  nuovoFornitoreNome: string
}

function ocrContradictsCurrentFornitore(
  currentNome: string,
  ocrRs: string | null | undefined,
  opts?: { mittente?: string | null },
): boolean {
  const rs = ocrRs?.trim()
  if (!rs) return false
  if (fornitoreNomeMatchesOcr(currentNome, rs)) return false
  if (isSharedBillingPlatformSenderEmail(opts?.mittente ?? '')) return true
  return tokenOverlapRatio(currentNome, rs) < 0.2
}

/** Nome fornitore candidato quando l’assegnazione attuale non coincide con file/OCR. */
export function pickFornitoreCorrectionCandidateName(
  currentNome: string,
  opts: {
    fileName?: string | null
    emailSubject?: string | null
    metadata?: unknown
    ocrRagioneSociale?: string | null
    mittente?: string | null
  },
): string | null {
  const trimmedCurrent = currentNome.trim()
  if (!trimmedCurrent) return null

  const hint = extractSupplierHintFromDocContext(
    opts.fileName ?? null,
    opts.emailSubject ?? null,
    opts.metadata,
  )
  if (hint && auditSupplierNamesMismatch(trimmedCurrent, hint)) {
    return hint
  }

  if (
    ocrContradictsCurrentFornitore(trimmedCurrent, opts.ocrRagioneSociale, {
      mittente: opts.mittente,
    })
  ) {
    return opts.ocrRagioneSociale?.trim() ?? null
  }

  return null
}

/**
 * Se file/OCR indicano un altro fornitore già in anagrafica, restituisce il target di riassegnazione.
 * Non crea nuovi fornitori (solo abbinamento a record esistenti nella stessa sede).
 */
export async function resolveFatturaFornitoreCorrection(
  supabase: SupabaseClient,
  input: FatturaFornitoreCorrectionInput,
): Promise<FatturaFornitoreCorrectionResult | null> {
  const currentNome = input.currentFornitoreNome.trim()
  const sedeId = input.sedeId.trim()
  if (!currentNome || !sedeId) return null

  const candidateName = pickFornitoreCorrectionCandidateName(currentNome, {
    fileName: input.fileName,
    emailSubject: input.emailSubject,
    metadata: input.metadata,
    ocrRagioneSociale: input.ocrRagioneSociale,
    mittente: input.mittente,
  })
  if (!candidateName) return null

  const found = await resolveFornitoreByPartialNameEnhanced(supabase, candidateName, sedeId)
  if (!found?.id || found.id === input.currentFornitoreId) return null
  if (!auditSupplierNamesMismatch(currentNome, found.nome)) return null

  return {
    nuovoFornitoreId: found.id,
    nuovoFornitoreNome: found.nome.trim(),
  }
}
