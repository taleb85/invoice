/**
 * Login operatore: un solo nome (prima parola), confronto case-insensitive via maiuscole in UI/API.
 */
export function normalizeOperatorLoginName(raw: string): string {
  const w = raw.trim().split(/\s+/).filter(Boolean)[0] ?? ''
  return w.toUpperCase()
}

export function profileFirstTokenEquals(
  fullName: string | null | undefined,
  tokenUpper: string
): boolean {
  const first =
    (fullName ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0]
      ?.toUpperCase() ?? ''
  return first === tokenUpper
}
