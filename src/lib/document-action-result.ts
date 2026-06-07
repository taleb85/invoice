export type DocumentActionResult = {
  ok: boolean
  error?: string
  /** Messaggio informativo (non errore) — es. azione solo da Centro controllo. */
  informational?: boolean
}
