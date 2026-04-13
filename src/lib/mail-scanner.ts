import { simpleParser } from 'mailparser'
import { withImapSession, type ImapCredentials } from '@/lib/imap-session'

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

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']

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
 * Restituisce tutte le email non lette che contengono almeno un allegato
 * con tipo PDF, JPG o PNG.
 */
export type FetchUnseenImapHooks = {
  onRetry?: (info: { attempt: number; maxAttempts: number; error: unknown }) => void | Promise<void>
  beforeReconnect?: (info: { attempt: number; maxAttempts: number }) => void | Promise<void>
  afterInboxOpen?: () => void | Promise<void>
}

export async function fetchUnseenEmails(
  hooks?: FetchUnseenImapHooks,
  fiscalRange?: { start: Date; endExclusive: Date } | null
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
      const searchResult = await client.search(
        fiscalRange
          ? { seen: false, since: fiscalRange.start, before: fiscalRange.endExclusive }
          : { seen: false },
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
          .filter((att) => {
            const type = att.contentType?.toLowerCase() ?? ''
            const ext = (att.filename ?? '').split('.').pop()?.toLowerCase() ?? ''
            return ALLOWED_TYPES.includes(type) || ALLOWED_EXTENSIONS.includes(ext)
          })
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
