/** Estrae primo indirizzo email da mittente RFC (Nome <a@b.it>) per matching rubrica. */

export function extractEmailFromSenderHeader(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim().toLowerCase()
  const fromBrackets =
    /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/.exec(raw)?.[1]?.toLowerCase()?.trim()
  const bare = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/.exec(trimmed)?.[0]?.toLowerCase()
  return fromBrackets ?? bare ?? (trimmed.includes('@') ? trimmed : null)
}

export function normalizeSenderEmailCanonical(raw: string | null | undefined): string | null {
  return extractEmailFromSenderHeader(raw)?.trim().toLowerCase() ?? null
}
