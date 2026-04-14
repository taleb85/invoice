/** Fasi sincronizzazione email (allineate a messaggi UI / percentuali). */
export type EmailScanPhase = 'queued' | 'connect' | 'search' | 'process' | 'persist' | 'complete'

/** Sotto-fase durante `connect` (prima / dopo `client.connect()` IMAP). */
export type EmailScanConnectStep = 'to_server' | 'opening_mailbox'

/** Casella IMAP attiva nel run (per dettaglio UI nella barra di sync). */
export type EmailScanMailboxContext =
  | { mailboxKind: 'global'; supplierFilter?: string }
  | { mailboxKind: 'sede'; mailboxName: string; supplierFilter?: string }

export type EmailScanStreamEvent =
  | {
      type: 'progress'
      phase: EmailScanPhase
      percent: number
      mailsFound?: number
      mailsProcessed?: number
      /** Cumulativi durante il run (allineati a `done`). */
      ricevuti?: number
      ignorate?: number
      bozzeCreate?: number
      /** Unità già in log da sync precedente (nessun nuovo documento). */
      skippedAlreadyCompleted?: number
      attachmentsTotal?: number
      attachmentsProcessed?: number
      mailboxContext?: EmailScanMailboxContext
      /** Se valorizzato, la barra mostra stato errore (rosso) durante i retry IMAP. */
      connectionWarning?: string | null
      /** Tentativo di connessione IMAP corrente (1-based), max = tentativi totali. */
      imapRetry?: { attempt: number; maxAttempts: number } | null
      /** Dettaglio fase connessione (solo `phase === 'connect'`). */
      connectStep?: EmailScanConnectStep | null
    }
  | {
      type: 'done'
      ricevuti: number
      ignorate: number
      bozzeCreate: number
      skippedAlreadyCompleted?: number
      messaggio: string
      avvisi?: string[]
      mailsFound?: number
      mailsProcessed?: number
      attachmentsTotal?: number
      attachmentsProcessed?: number
    }
  | { type: 'error'; error: string }
