/**
 * Login operatore: un solo nome (prima parola), confronto case-insensitive via maiuscole in UI/API.
 * Rimuove i diacritici così "JOSE" risolve José / JOSÉ (ILIKE in Postgres non lo farebbe).
 */
export function foldOperatorNameDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normalizeOperatorLoginName(raw: string): string {
  const w = raw.trim().split(/\s+/).filter(Boolean)[0] ?? ''
  return foldOperatorNameDiacritics(w).toUpperCase()
}

export function profileFirstTokenEquals(
  fullName: string | null | undefined,
  tokenUpper: string
): boolean {
  const first =
    foldOperatorNameDiacritics(
      (fullName ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0] ?? '',
    ).toUpperCase()
  return first === tokenUpper
}
