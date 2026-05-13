import type { ConnectionOptions } from 'tls'

export function imapTlsOptions(): ConnectionOptions {
  const env = process.env.IMAP_TLS_REJECT_UNAUTHORIZED
  const rejectUnauthorized = env === 'false' || env === '0' ? false : true
  return { rejectUnauthorized }
}
