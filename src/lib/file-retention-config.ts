/** Mesi calendario “hot”: mese corrente + precedente (file conservati in storage). */
export const FILE_ATTACHMENT_RETENTION_HOT_MONTHS = 2 as const

/** Giorno del mese (1–28) in cui il cron esegue la purge per le sedi senza override. */
export const FILE_ATTACHMENT_RETENTION_DEFAULT_RUN_DAY = 5 as const

/** @deprecated Usare FILE_ATTACHMENT_RETENTION_HOT_MONTHS (mesi calendario). */
export const FILE_ATTACHMENT_RETENTION_DAYS = 62 as const

/** Se true, wizard Sedi espone la conservazione allegati. */
export const FILE_ATTACHMENT_RETENTION_UI_ENABLED =
  process.env.NEXT_PUBLIC_FILE_RETENTION_UI_ENABLED === 'true'
