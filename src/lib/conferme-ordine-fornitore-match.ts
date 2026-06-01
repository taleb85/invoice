/**
 * Conferme ordine: il titolo/file spesso riporta il fornitore reale (es. Rekki),
 * mentre `fornitore_id` può essere quello della casella email in scansione.
 */

export type FornitoreNameRow = {
  id: string
  nome: string | null
  display_name?: string | null
}

export function normalizeCompanyKey(s: string | null | undefined): string {
  const t = s?.trim()
  if (!t) return ''
  return t
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function confermeOrdineVendorLabel(row: {
  titolo?: string | null
  file_name?: string | null
}): string {
  return row.titolo?.trim() || row.file_name?.trim() || ''
}

function companyKeysForFornitore(f: FornitoreNameRow): string[] {
  const keys = new Set<string>()
  for (const raw of [f.nome, f.display_name]) {
    const k = normalizeCompanyKey(raw)
    if (k) keys.add(k)
  }
  return [...keys]
}

function labelMatchesCompanyKey(labelKey: string, companyKey: string): boolean {
  if (!labelKey || !companyKey) return false
  if (labelKey === companyKey) return true
  if (labelKey.length >= 4 && companyKey.length >= 4) {
    return labelKey.includes(companyKey) || companyKey.includes(labelKey)
  }
  return false
}

/** Fornitore univoco il cui nome compare nel titolo/file; `null` se ambiguo o assente. */
export function resolveFornitoreIdFromCompanyLabel(
  label: string,
  fornitori: FornitoreNameRow[],
): string | null {
  const labelKey = normalizeCompanyKey(label)
  if (!labelKey || labelKey.length < 3) return null
  const matched = new Set<string>()
  for (const f of fornitori) {
    for (const fk of companyKeysForFornitore(f)) {
      if (labelMatchesCompanyKey(labelKey, fk)) {
        matched.add(f.id)
        break
      }
    }
  }
  if (matched.size === 1) return [...matched][0]!
  return null
}

/** Mostra la conferma in scheda fornitore solo se il nome documento coincide (o non è riconoscibile). */
export function confermeOrdineBelongsToFornitore(
  row: { titolo?: string | null; file_name?: string | null; fornitore_id: string },
  fornitoreId: string,
  fornitori: FornitoreNameRow[],
): boolean {
  if (row.fornitore_id !== fornitoreId) return false
  const resolved = resolveFornitoreIdFromCompanyLabel(confermeOrdineVendorLabel(row), fornitori)
  if (!resolved) return true
  return resolved === fornitoreId
}
