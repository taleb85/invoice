/**
 * Cookie di sessione Supabase corrotti o revocati (es. account rimosso, token ruotato,
 * storage locale non allineato) → getSession/getUser falliscono con AuthApiError.
 */
export function isInvalidRefreshTokenError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false
  const o = err as { message?: string; code?: string }
  const code = String(o.code ?? '')
  if (code === 'refresh_token_not_found' || code === 'invalid_refresh_token') return true
  const m = (o.message ?? '').toLowerCase()
  return m.includes('invalid refresh token') || m.includes('refresh token not found')
}
