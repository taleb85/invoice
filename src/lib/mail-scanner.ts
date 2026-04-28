import { simpleParser } from 'mailparser'
import { withImapSession, type ImapCredentials } from '@/lib/imap-session'
import { isFiscalDocumentAttachment } from '@/lib/fiscal-document-attachments'

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
  extension: string
}

/** Corpo mail minimo per scansione senza allegati (estrazione da testo). */
export const MIN_EMAIL_BODY_CHARS_FOR_SCAN = 40

export interface ScannedEmail {
  uid: number
  from: string
  subject: string | null
  /** Testo email (plain o da HTML) per parsing Rekki / altre integrazioni */
  bodyText?: string | null
  attachments: EmailAttachment[]
}

export function emailHasScannableBody(e: ScannedEmail): boolean {
  return (e.bodyText?.trim().length ?? 0) >= MIN_EMAIL_BODY_CHARS_FOR_SCAN
}

function imapMessageDate(
  internalDate: Date | string | undefined,
  envelopeDate: Date | undefined,
  parsedDate: Date | undefined
): Date | null {
  if (internalDate != null) {
    const d = internalDate instanceof Date ? internalDate : new Date(internalDate)
    if (!Number.isNaN(d.getTime())) return d
  }
  if (envelopeDate && !Number.isNaN(envelopeDate.getTime())) return envelopeDate
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) return parsedDate
  return null
}

function emailBodyPlain(parsed: { text?: string; html?: string | false }): string | null {
  const t = parsed.text?.trim()
  if (t) return t
  const h = typeof parsed.html === 'string' ? parsed.html : ''
  if (!h) return null
  const plain = h
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain || null
}

function globalImapCreds(): ImapCredentials {
  const port = Number(process.env.IMAP_PORT ?? 993)
  return {
    host: process.env.IMAP_HOST!,
    port,
    user: process.env.IMAP_USER!,
    password: process.env.IMAP_PASSWORD!,
    secure: port !== 143,
    tls: { rejectUnauthorized: false },
  }
}

/**
 * Restituisce le email nella finestra IMAP scelta (lette e non lette) che contengono
 * almeno un allegato PDF (fattura / bolla / estratto) oppure corpo testo sufficiente per l’estrazione.
 */
export type FetchUnseenImapHooks = {
  onRetry?: (info: { attempt: number; maxAttempts: number; error: unknown }) => void | Promise<void>
  beforeReconnect?: (info: { attempt: number; maxAttempts: number }) => void | Promise<void>
  beforeConnect?: () => void | Promise<void>
  afterConnect?: () => void | Promise<void>
  afterInboxOpen?: () => void | Promise<void>
}

export async function fetchUnseenEmails(
  hooks?: FetchUnseenImapHooks,
  fiscalRange?: { start: Date; endExclusive: Date } | null,
  /** Solo senza fiscalRange: limita la ricerca IMAP `SINCE` (lette e non lette). Ha priorità se entrambi valorizzati. */
  lookbackDays?: number | null,
  /** Alternativa ai giorni: finestra più stretta per sync cron (es. ultime 3 ore). */
  lookbackHours?: number | null
): Promise<ScannedEmail[]> {
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER) {
    throw new Error('Variabili IMAP_HOST e IMAP_USER non configurate.')
  }

  return withImapSession(
    globalImapCreds(),
    async (client) => {
    const results: ScannedEmail[] = []
    const lock = await client.getMailboxLock('INBOX')

    try {
      await hooks?.afterInboxOpen?.()
      const sinceLookback =
        !fiscalRange && lookbackHours != null && lookbackHours > 0
          ? new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
          : !fiscalRange && lookbackDays && lookbackDays > 0
            ? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
            : undefined
      const searchResult = await client.search(
        fiscalRange
          ? { since: fiscalRange.start, before: fiscalRange.endExclusive }
          : sinceLookback
            ? { since: sinceLookback }
            : { all: true },
        { uid: true }
      )
      const uids = Array.isArray(searchResult) ? searchResult : []
      if (uids.length === 0) return results

      for await (const msg of client.fetch(
        uids,
        { source: true, internalDate: true, envelope: true },
        { uid: true }
      )) {
        if (!msg.source) continue
        let parsed
        try {
          parsed = await simpleParser(msg.source)
        } catch {
          continue
        }

        const msgDate = imapMessageDate(
          msg.internalDate as Date | string | undefined,
          msg.envelope?.date,
          parsed.date ?? undefined
        )
        if (fiscalRange) {
          if (!msgDate || msgDate < fiscalRange.start || msgDate >= fiscalRange.endExclusive) {
            continue
          }
        }

        const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase().trim() ?? ''
        if (!fromAddr) continue

        const validAttachments: EmailAttachment[] = (parsed.attachments ?? [])
          .filter((att) => isFiscalDocumentAttachment(att.contentType, att.filename))
          .map((att) => {
            const ext = (att.filename ?? '').split('.').pop()?.toLowerCase() ?? 'bin'
            return {
              filename: att.filename ?? `allegato.${ext}`,
              content: att.content,
              contentType: att.contentType ?? 'application/octet-stream',
              extension: ext,
            }
          })

        const bodyText = emailBodyPlain(parsed)
        if (validAttachments.length === 0) {
          if ((bodyText?.trim().length ?? 0) < MIN_EMAIL_BODY_CHARS_FOR_SCAN) continue
          results.push({
            uid: msg.uid,
            from: fromAddr,
            subject: parsed.subject ?? null,
            bodyText,
            attachments: [],
          })
          continue
        }

        results.push({
          uid: msg.uid,
          from: fromAddr,
          subject: parsed.subject ?? null,
          bodyText,
          attachments: validAttachments,
        })
      }
    } finally {
      lock.release()
    }

    return results
    },
    {
      onRetry: hooks?.onRetry,
      beforeReconnect: hooks?.beforeReconnect,
      beforeConnect: hooks?.beforeConnect,
      afterConnect: hooks?.afterConnect,
    }
  )
}

/**
 * Segna i messaggi indicati come letti sul server IMAP.
 */
export async function markEmailsAsRead(
  uids: number[],
  hooks?: Pick<FetchUnseenImapHooks, 'onRetry' | 'beforeReconnect'>
): Promise<void> {
  if (uids.length === 0) return

  await withImapSession(
    globalImapCreds(),
    async (client) => {
      const lock = await client.getMailboxLock('INBOX')
      try {
        await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true })
      } finally {
        lock.release()
      }
    },
    hooks ? { onRetry: hooks.onRetry, beforeReconnect: hooks.beforeReconnect } : undefined
  )
}
