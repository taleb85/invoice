/** Fasi sincronizzazione email (allineate a messaggi UI / percentuali). */
export type EmailScanPhase = 'queued' | 'connect' | 'search' | 'process' | 'persist' | 'complete'

export type EmailScanStreamEvent =
  | {
      type: 'progress'
      phase: EmailScanPhase
      percent: number
      mailsFound?: number
      mailsProcessed?: number
      attachmentsTotal?: number
      attachmentsProcessed?: number
      /** Se valorizzato, la barra mostra stato errore (rosso) durante i retry IMAP. */
      connectionWarning?: string | null
    }
  | {
      type: 'done'
      ricevuti: number
      ignorate: number
      bozzeCreate: number
      messaggio: string
      avvisi?: string[]
      mailsFound?: number
      mailsProcessed?: number
      attachmentsTotal?: number
      attachmentsProcessed?: number
    }
  | { type: 'error'; error: string }
