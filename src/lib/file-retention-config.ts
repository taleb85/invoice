/** Soglia fissa (giorni dalla data documento) per purge allegati in storage; usata da UI e job futuri. */
export const FILE_ATTACHMENT_RETENTION_DAYS = 45 as const

/** Se true, wizard Sedi e pannello elenco sedi espongono la conservazione allegati e inviano i campi in PATCH. */
export const FILE_ATTACHMENT_RETENTION_UI_ENABLED = false as const
