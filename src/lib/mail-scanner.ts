import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
  extension: string
}

export interface ScannedEmail {
  uid: number
  from: string
  subject: string | null
  attachments: EmailAttachment[]
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']

function buildClient(): ImapFlow {
  return new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: Number(process.env.IMAP_PORT ?? 993) !== 143,
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASSWORD!,
    },
    logger: false,
    tls: { rejectUnauthorized: false },
  })
}

/**
 * Restituisce tutte le email non lette che contengono almeno un allegato
 * con tipo PDF, JPG o PNG.
 */
export async function fetchUnseenEmails(): Promise<ScannedEmail[]> {
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER) {
    throw new Error('Variabili IMAP_HOST e IMAP_USER non configurate.')
  }

  const client = buildClient()
  const results: ScannedEmail[] = []

  await client.connect()
  const lock = await client.getMailboxLock('INBOX')

  try {
    const searchResult = await client.search({ seen: false }, { uid: true })
    const uids = Array.isArray(searchResult) ? searchResult : []
    if (uids.length === 0) return results

    for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
      if (!msg.source) continue
      let parsed
      try {
        parsed = await simpleParser(msg.source)
      } catch {
        continue
      }

      // Estrai indirizzo mittente
      const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase().trim() ?? ''
      if (!fromAddr) continue

      // Filtra allegati validi per tipo e/o estensione
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

      if (validAttachments.length === 0) continue

      results.push({
        uid: msg.uid,
        from: fromAddr,
        subject: parsed.subject ?? null,
        attachments: validAttachments,
      })
    }
  } finally {
    lock.release()
  }

  await client.logout()
  return results
}

/**
 * Segna i messaggi indicati come letti sul server IMAP.
 */
export async function markEmailsAsRead(uids: number[]): Promise<void> {
  if (uids.length === 0) return

  const client = buildClient()
  await client.connect()
  const lock = await client.getMailboxLock('INBOX')

  try {
    await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true })
  } finally {
    lock.release()
  }

  await client.logout()
}
