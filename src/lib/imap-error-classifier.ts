export type ImapErrorKind =
  | 'auth_failed'      // wrong credentials
  | 'unreachable'      // host not reachable / DNS failure
  | 'timeout'          // connection or operation timeout
  | 'mailbox_locked'   // another session has the mailbox
  | 'tls_error'        // certificate / TLS handshake failure
  | 'unknown'

export interface ClassifiedImapError {
  kind: ImapErrorKind
  message: string        // user-friendly Italian message
  retryable: boolean     // should the UI offer a retry button?
  actionHint: string     // what the admin should do
}

export function classifyImapError(err: unknown): ClassifiedImapError {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()

  if (msg.includes('auth') || msg.includes('login') ||
      msg.includes('credentials') || msg.includes('535') ||
      msg.includes('534') || msg.includes('invalid')) {
    return {
      kind: 'auth_failed',
      message: 'Credenziali email non valide',
      retryable: false,
      actionHint: 'Verifica utente e password IMAP nelle impostazioni sede.',
    }
  }
  if (msg.includes('timeout') || msg.includes('timed out') ||
      msg.includes('etimedout')) {
    return {
      kind: 'timeout',
      message: 'Connessione email scaduta',
      retryable: true,
      actionHint: 'Il server IMAP non risponde. Riprova tra qualche minuto.',
    }
  }
  if (msg.includes('enotfound') || msg.includes('econnrefused') ||
      msg.includes('econnreset') || msg.includes('unreachable') ||
      msg.includes('network')) {
    return {
      kind: 'unreachable',
      message: 'Server email non raggiungibile',
      retryable: true,
      actionHint: 'Controlla host e porta IMAP nelle impostazioni sede.',
    }
  }
  if (msg.includes('tls') || msg.includes('ssl') ||
      msg.includes('certificate') || msg.includes('self signed')) {
    return {
      kind: 'tls_error',
      message: 'Errore certificato TLS',
      retryable: false,
      actionHint: 'Il certificato SSL del server non è valido. Contatta il provider email.',
    }
  }
  if (msg.includes('lock') || msg.includes('in use') ||
      msg.includes('selected by another')) {
    return {
      kind: 'mailbox_locked',
      message: 'Casella email occupata da un\'altra sessione',
      retryable: true,
      actionHint: 'Riprova tra 30 secondi.',
    }
  }
  return {
    kind: 'unknown',
    message: 'Errore email sconosciuto',
    retryable: true,
    actionHint: `Dettaglio tecnico: ${err instanceof Error ? err.message : String(err)}`,
  }
}
