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

function looksLikeOrderReferenceTitle(labelKey: string): boolean {
  if (!labelKey) return true
  if (looksLikeSupplierCompanyName(labelKey)) return false
  return (
    /\b(order|ordine|confirmation|conferma|rekki|purchase)\b/.test(labelKey) ||
    /\b[a-z]{0,8}\d{3,}\b/.test(labelKey)
  )
}

export function confermeOrdineVendorLabel(row: {
  titolo?: string | null
  file_name?: string | null
  ragione_sociale?: string | null
}): string {
  const titolo = row.titolo?.trim() ?? ''
  const rs = row.ragione_sociale?.trim() ?? ''
  const file = row.file_name?.trim() ?? ''
  const titoloKey = normalizeCompanyKey(titolo)
  if (rs && looksLikeOrderReferenceTitle(titoloKey)) return rs
  return titolo || rs || file
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

/** Esclude titoli tipo «Order confirmation #123» (non ragione sociale). */
function looksLikeSupplierCompanyName(labelKey: string): boolean {
  if (!labelKey || labelKey.length < 8) return false
  if (
    /\b(order|ordine|confirmation|conferma|rekki|delivery|invoice|fattura|purchase)\b/i.test(
      labelKey,
    ) &&
    !/\b(ltd|limited|company|srl|spa|gmbh|inc|llc|plc)\b/i.test(labelKey)
  ) {
    return false
  }
  const words = labelKey.split(' ').filter((w) => w.length > 1 && !/^\d+$/.test(w))
  return words.length >= 2
}

function matchesAnyFornitoreKey(labelKey: string, keys: string[]): boolean {
  return keys.some((fk) => labelMatchesCompanyKey(labelKey, fk))
}

/** Mostra la conferma in scheda fornitore solo se il nome documento coincide con questo fornitore. */
export function confermeOrdineBelongsToFornitore(
  row: {
    titolo?: string | null
    file_name?: string | null
    ragione_sociale?: string | null
    fornitore_id: string
  },
  fornitoreId: string,
  fornitori: FornitoreNameRow[],
): boolean {
  if (row.fornitore_id !== fornitoreId) return false

  const labelKey = normalizeCompanyKey(confermeOrdineVendorLabel(row))
  if (!labelKey || labelKey.length < 3) return true

  const current = fornitori.find((f) => f.id === fornitoreId)
  const currentKeys = current ? companyKeysForFornitore(current) : []
  const matchesCurrent = matchesAnyFornitoreKey(labelKey, currentKeys)

  for (const f of fornitori) {
    if (f.id === fornitoreId) continue
    const peerKeys = companyKeysForFornitore(f)
    if (matchesAnyFornitoreKey(labelKey, peerKeys)) return false
  }

  if (!matchesCurrent && looksLikeSupplierCompanyName(labelKey)) return false

  return true
}
