/** Logica IMAP condivisa tra GET `/api/scan-emails` e cron Vercel `/api/cron/sync-emails` (default `imapSyncMode`: `auto`). */
export { runEmailSyncForAllSedi } from '@/app/api/scan-emails/route'
