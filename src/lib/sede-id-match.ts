/** Confronto ID sede da URL/query/DB senza falsi negativi per spazi/case. */
export function sameSedeId(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a ?? '').trim().toLowerCase()
  const y = String(b ?? '').trim().toLowerCase()
  return x.length > 0 && x === y
}
