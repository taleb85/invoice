export type OperatorWorkspaceHeaderPayload = {
  operatorScoped: boolean
  fiscalYear: number
  sollecitiFornitori: number
  counts: {
    ordini: number
    bolle: number
    fatture: number
    statements: number
    listino: number
    documenti: number
  } | null
  /** Ultimo scan IMAP completato per la sede in scope (`sedi.last_imap_sync_at`). */
  lastImapSyncAt?: string | null
  /** Errore IMAP persistente sulla sede, se presente. */
  lastImapSyncError?: string | null
}
