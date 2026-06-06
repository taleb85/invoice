/**
 * Allinea oggetto mail «Statement from …» al fornitore della scheda.
 * Utile quando `statements.fornitore_id` è errato ma l'oggetto indica il mittente reale.
 */
function normalizeSupplierNameKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function canonicalSupplierNameKey(raw: string): string {
  let s = normalizeSupplierNameKey(raw)
  if (!s) return s
  s = s.replace(/\b(limited|ltd)\b/g, 'ltd')
  s = s.replace(/\b(incorporated|inc)\b/g, 'inc')
  s = s.replace(/\b(s\.r\.l\.|srl|s r l)\b/g, 'srl')
  s = s.replace(/\b(plc|plc\.)\b/g, 'plc')
  return s.replace(/\s+/g, ' ').trim()
}

function namesLikelySame(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

/** Estrae il nome dopo «Statement from» (oggetto tipico estratti UK). */
export function extractStatementFromSupplierName(subject: string | null | undefined): string | null {
  const s = (subject ?? '').trim()
  if (!s) return null
  const m = s.match(/\bstatement\s+from\s+(.+)$/i)
  if (!m?.[1]) return null
  let tail = m[1].trim()
  // «Statement from ACME Ltd for Client Name» → solo il fornitore emittente
  tail = tail.replace(/\s+for\s+.+$/i, '').trim()
  const cut = tail.split(/\s*[-–|]\s*/)[0]?.trim()
  return cut || tail || null
}

export function statementEmailSubjectMatchesFornitore(
  subject: string | null | undefined,
  fornitoreNome: string,
  fornitoreDisplayName?: string | null,
  /** Nome anagrafica dal record statement (se diverso da alias in scheda). */
  statementFornitoreNome?: string | null,
): boolean {
  const fromName = extractStatementFromSupplierName(subject)
  if (!fromName) return true

  const fromKey = canonicalSupplierNameKey(fromName)
  if (!fromKey) return true

  const candidates = [fornitoreNome, fornitoreDisplayName, statementFornitoreNome]
    .map((n) => (n ?? '').trim())
    .filter(Boolean)

  for (const c of candidates) {
    const key = canonicalSupplierNameKey(c)
    if (namesLikelySame(fromKey, key)) return true
  }

  return false
}
