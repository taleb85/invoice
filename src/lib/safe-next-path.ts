/** Percorso interno sicuro per redirect post-login (no open redirect). */
export function safeNextPath(raw: string | null | undefined): string {
  const p = (raw ?? '/').trim() || '/'
  if (!p.startsWith('/') || p.startsWith('//')) return '/'
  return p
}
