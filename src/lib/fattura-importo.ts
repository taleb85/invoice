import { formatCurrency } from '@/lib/locale-shared'
import type { Locale } from '@/lib/translations'

/** Importo con segno per UI: le note credito sono negative, importo assoluto in DB. */
export function signedFatturaImporto(
  importo: number | null | undefined,
  isCreditNote?: boolean | null,
): number | null {
  if (importo == null || !Number.isFinite(Number(importo))) return null
  const abs = Math.abs(Number(importo))
  return isCreditNote ? -abs : Number(importo)
}

export function formatSignedFatturaImporto(
  importo: number | null | undefined,
  isCreditNote: boolean | null | undefined,
  currency: string,
  locale: Locale | string,
): string | null {
  const signed = signedFatturaImporto(importo, isCreditNote)
  if (signed == null) return null
  return formatCurrency(signed, currency, locale as Locale)
}

/** Valore positivo da salvare in DB quando l'utente edita una nota credito. */
export function storedFatturaImportoFromEdit(
  parsed: number | null,
  isCreditNote?: boolean | null,
): number | null {
  if (parsed == null) return null
  return isCreditNote ? Math.abs(parsed) : parsed
}
