/** Etichetta da mostrare in UI compatte (barra mobile, card): alias o nome legale. */
export function fornitoreDisplayLabel(row: {
  nome: string | null | undefined
  display_name?: string | null
}): string {
  const alias = row.display_name?.trim()
  if (alias) return alias
  return row.nome?.trim() || ''
}
