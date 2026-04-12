/** Single dynamic segment from `useParams()` (string or string[] in catch-all routes). */
export function segmentParam(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}
