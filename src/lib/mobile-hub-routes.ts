/** Normalized pathname (no query, no trailing slash except root). */
export function normalizeAppPath(path: string): string {
  const pathOnly = path.split('?')[0] ?? ''
  if (pathOnly.length > 1 && pathOnly.endsWith('/')) return pathOnly.slice(0, -1)
  return pathOnly || '/'
}

/** `/fornitori/:id` scheda fornitore (esclude `new` e `import`). */
export function isFornitoreProfileRoute(normalized: string): boolean {
  const one = /^\/fornitori\/([^/]+)$/.exec(normalized)
  return !!(one && one[1] !== 'new' && one[1] !== 'import')
}

export function fornitoreIdFromProfilePath(normalized: string): string | null {
  const one = /^\/fornitori\/([^/]+)$/.exec(normalized)
  if (!one || one[1] === 'new' || one[1] === 'import') return null
  return one[1]
}

/**
 * Ogni schermata sotto AppShell mostra la bottom bar su viewport stretti (`< md`).
 * Prima era limitata a hub + scheda fornitore; ora include anche fattura/bolla dettaglio, archivio, ecc.
 */
export function showsMobileBottomBar(): boolean {
  return true
}

/** Main sede profile only: `/sedi/:sede_id`. Not list `/sedi`, not `/sedi/:id/fornitori` etc. */
export function isSedeProfileMobileContext(normalized: string): boolean {
  return /^\/sedi\/[^/]+$/.test(normalized)
}

/** First path segment after `/sedi/` (sede id), or null for `/sedi` list. */
export function sedeIdFromAppPath(normalized: string): string | null {
  const m = /^\/sedi\/([^/]+)/.exec(normalized)
  return m ? m[1] : null
}
