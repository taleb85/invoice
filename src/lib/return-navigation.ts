/** Query param usato per tornare alla lista/provenienza dopo un'azione su un dettaglio. */
export const RETURN_TO_PARAM = 'returnTo' as const

/** Percorsi interni sicuri (no open redirect). */
export function isSafeAppReturnPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false
  if (path.includes('://')) return false
  return true
}

/** pathname + query corrente, es. `/fornitori/x?tab=fatture` */
export function buildListLocationPath(
  pathname: string,
  searchParams: { toString(): string } | null | undefined,
): string {
  const q = searchParams && typeof searchParams.toString === 'function' ? searchParams.toString() : ''
  return q ? `${pathname}?${q}` : pathname
}

export function hrefWithReturnTo(targetPath: string, returnPath: string): string {
  if (!isSafeAppReturnPath(returnPath)) return targetPath
  const encoded = encodeURIComponent(returnPath)
  const sep = targetPath.includes('?') ? '&' : '?'
  return `${targetPath}${sep}${RETURN_TO_PARAM}=${encoded}`
}

export function scrollStorageKeyForListPath(fullPath: string): string {
  return `scrollPos_${fullPath}`
}

export function readReturnToFromGetter(get: (key: string) => string | null | undefined): string | null {
  const raw = get(RETURN_TO_PARAM)?.trim() ?? ''
  if (!raw || !isSafeAppReturnPath(raw)) return null
  return raw
}
