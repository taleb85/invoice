/** Etichetta da mostrare in UI compatte (barra mobile, card): alias o nome legale. */
export function fornitoreDisplayLabel(row: {
  nome: string | null | undefined
  display_name?: string | null
}): string {
  const alias = row.display_name?.trim()
  if (alias) return alias
  return row.nome?.trim() || ''
}

/**
 * Stessa logica di {@link fornitoreDisplayLabel} ma in maiuscolo (convenzione UI: ragioni sociali in block caps).
 */
export function fornitoreDisplayLabelUppercase(row: {
  nome: string | null | undefined
  display_name?: string | null
}): string {
  return fornitoreDisplayLabel(row).toLocaleUpperCase('it-IT')
}

/** Singola stringa nome (es. `fornitore.nome` annidato) in maiuscolo per titoli e celle. */
export function fornitoreNomeMaiuscolo(nome: string | null | undefined): string {
  if (nome == null || nome === '') return ''
  return nome.trim().toLocaleUpperCase('it-IT')
}

/**
 * Prima parola dell’etichetta fornitore in maiuscolo, per ricerche Rekki compatte.
 * Es. «Enotria Winecellars Ltd» → «ENOTRIA»; con alias «ENOTRIA WINE» → «ENOTRIA».
 */
export function supplierShortNameForRekkiSearch(displayOrNome: string | null | undefined): string {
  const t = (displayOrNome ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const first = t.split(/\s+/)[0] ?? ''
  return first.toLocaleUpperCase()
}
