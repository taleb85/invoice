import type { ReadonlyURLSearchParams } from 'next/navigation'

export function fornitoreSupplierClearDocParams(q: URLSearchParams) {
  q.delete('bolla')
  q.delete('fattura')
}

/** Cambio tab sulla scheda fornitore: rimuove dettaglio bolla/fattura incastonato nell’URL. */
export function fornitorePageTabHref(pathname: string, sp: ReadonlyURLSearchParams, tab: string): string {
  const q = new URLSearchParams(sp.toString())
  fornitoreSupplierClearDocParams(q)
  if (tab === 'dashboard') q.delete('tab')
  else q.set('tab', tab)
  const qs = q.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export function fornitoreBollaDeepLink(pathname: string, sp: ReadonlyURLSearchParams, bollaId: string): string {
  const q = new URLSearchParams(sp.toString())
  q.set('tab', 'bolle')
  q.set('bolla', bollaId)
  q.delete('fattura')
  return `${pathname}?${q.toString()}`
}

export function fornitoreFatturaDeepLink(pathname: string, sp: ReadonlyURLSearchParams, fatturaId: string): string {
  const q = new URLSearchParams(sp.toString())
  q.set('tab', 'fatture')
  q.set('fattura', fatturaId)
  q.delete('bolla')
  return `${pathname}?${q.toString()}`
}

export function fornitoreSupplierCloseDocHref(pathname: string, sp: ReadonlyURLSearchParams): string {
  const q = new URLSearchParams(sp.toString())
  fornitoreSupplierClearDocParams(q)
  const qs = q.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
