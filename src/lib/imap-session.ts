import type { ConnectionOptions } from 'tls'
import { ImapFlow, type ImapFlowOptions } from 'imapflow'

/** imapflow definisce questa classe in `lib/tools.js` ma non la re-esporta dal `main` → spesso `undefined` in bundle. */
function isImapAuthenticationFailure(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { authenticationFailed?: boolean }).authenticationFailed === true
  )
}

function imapTimeoutFromEnv(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 3_000 ? n : fallback
}

/**
 * Timeout TCP/handshake verso l’host IMAP.
 * Default più basso dei 60s precedenti: host irraggiungibili (ETIMEDOUT) non bloccano
 * `scan-emails` e la coda dev per minuti. Override: `IMAP_CONNECTION_TIMEOUT_MS`.
 */
export const IMAP_CONNECTION_TIMEOUT_MS = imapTimeoutFromEnv('IMAP_CONNECTION_TIMEOUT_MS', 22_000)
/** Saluto server IMAP. Override: `IMAP_GREETING_TIMEOUT_MS`. */
export const IMAP_GREETING_TIMEOUT_MS = imapTimeoutFromEnv('IMAP_GREETING_TIMEOUT_MS', 14_000)
/** Inattività socket durante FETCH lunghi (server sede spesso lenti). */
export const IMAP_SOCKET_TIMEOUT_MS = 180_000

export const IMAP_CONNECT_MAX_ATTEMPTS = 3

const RETRY_BASE_DELAY_MS = 1_200

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function isRetryableImapError(err: unknown): boolean {
  if (isImapAuthenticationFailure(err)) return false
  const msg = err instanceof Error ? err.message : String(err)
  if (/authentication failed|invalid credentials|login failed|AUTHENTICATIONFAILED/i.test(msg)) return false
  return /unexpected close|connection closed|ECONNRESET|ECONNABORTED|ETIMEDOUT|timeout|socket|ENOTFOUND|EAI_AGAIN/i.test(
    msg
  )
}

export async function safeImapLogout(client: ImapFlow): Promise<void> {
  try {
    await client.logout()
  } catch {
    try {
      client.close()
    } catch {
      /* ignore */
    }
  }
}

export type ImapCredentials = {
  host: string
  port: number
  user: string
  password: string
  /** Default true (port 993). Usare false solo per STARTTLS su 143. */
  secure?: boolean
  tls?: ConnectionOptions
}

export function imapFlowOptionsFromCredentials(c: ImapCredentials): ImapFlowOptions {
  const port = c.port
  const secure = c.secure ?? port !== 143
  return {
    host: c.host,
    port,
    secure,
    auth: { user: c.user, pass: c.password },
    logger: false,
    connectionTimeout: IMAP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: IMAP_GREETING_TIMEOUT_MS,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
    tls: c.tls ?? { rejectUnauthorized: false },
  }
}

/**
 * Una sessione IMAP per operazione: connect → work → logout sempre in finally-equivalente.
 * Riprova su errori transitori (es. "Unexpected close") fino a {@link IMAP_CONNECT_MAX_ATTEMPTS}.
 */
export type ImapSessionRetryInfo = {
  attempt: number
  maxAttempts: number
  error: unknown
}

export type ImapSessionReconnectInfo = {
  /** Tentativo corrente (2 = seconda connessione, …). */
  attempt: number
  maxAttempts: number
}

export async function withImapSession<T>(
  creds: ImapCredentials,
  work: (client: ImapFlow) => Promise<T>,
  opts?: {
    onRetry?: (info: ImapSessionRetryInfo) => void | Promise<void>
    /** Dopo il backoff e prima del nuovo connect: utile per inviare heartbeat allo stream NDJSON. */
    beforeReconnect?: (info: ImapSessionReconnectInfo) => void | Promise<void>
    /** Subito prima di `client.connect()` (TCP/TLS/autenticazione lato client). */
    beforeConnect?: () => void | Promise<void>
    /** Subito dopo `connect()` riuscito, prima del callback `work` (es. apertura casella). */
    afterConnect?: () => void | Promise<void>
  }
): Promise<T> {
  const max = IMAP_CONNECT_MAX_ATTEMPTS
  let lastErr: unknown
  for (let attempt = 1; attempt <= max; attempt++) {
    if (attempt > 1) {
      await opts?.beforeReconnect?.({ attempt, maxAttempts: max })
    }
    const client = new ImapFlow(imapFlowOptionsFromCredentials(creds))
    try {
      await opts?.beforeConnect?.()
      await client.connect()
      await opts?.afterConnect?.()
      const out = await work(client)
      await safeImapLogout(client)
      return out
    } catch (e) {
      lastErr = e
      await safeImapLogout(client)
      const retry = attempt < max && isRetryableImapError(e)
      if (retry) {
        await opts?.onRetry?.({ attempt, maxAttempts: max, error: e })
        await sleep(RETRY_BASE_DELAY_MS * attempt)
        continue
      }
      throw e
    }
  }
  throw lastErr
}
