import { extractEmailFromSenderHeader } from '@/lib/sender-email'
import {
  extractEmailDomainLower,
  isGenericSupplierEmailDomain,
} from '@/lib/fornitore-resolve-scan-email'

/** Stesso criterio dell’audit SQL: mittente già coperto da alias o dominio del fornitore. */
export function auditMittenteMatchesFornitoreScope(
  mittente: string | null | undefined,
  fornitoreId: string,
  assignedFornitoreId: string | null | undefined,
  referenceEmailNorm?: string | null,
): boolean {
  if (!assignedFornitoreId || assignedFornitoreId !== fornitoreId) return false

  const rowEmail = extractEmailFromSenderHeader(mittente)
  if (!rowEmail) return false

  if (referenceEmailNorm && rowEmail === referenceEmailNorm) return true

  const refDomain =
    extractEmailDomainLower(referenceEmailNorm ?? rowEmail) ??
    extractEmailDomainLower(rowEmail)
  const rowDomain = extractEmailDomainLower(rowEmail)
  if (
    refDomain &&
    rowDomain &&
    refDomain === rowDomain &&
    !isGenericSupplierEmailDomain(refDomain)
  ) {
    return true
  }

  return false
}
