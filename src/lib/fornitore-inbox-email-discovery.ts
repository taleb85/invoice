import type { AddressObject } from 'mailparser'
import { simpleParser } from 'mailparser'
import type { SupabaseClient } from '@supabase/supabase-js'
import { withImapSession, type ImapCredentials } from '@/lib/imap-session'
import { decryptImapPassword } from '@/lib/imap-encryption'
import { extractEmailFromSenderHeader } from '@/lib/sender-email'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'
import {
  extractSupplierFieldsFromEmailBody,
  fornitoreNomeMatchesOcr,
} from '@/lib/fornitore-cross-check'
import { extractStatementFromSupplierName } from '@/lib/statement-supplier-subject'

export type InboxDiscoveredEmailSource = 'inbox_from' | 'inbox_reply_to' | 'inbox_body'

export type InboxDiscoveredEmail = {
  email: string
  source: InboxDiscoveredEmailSource
  count: number
  last_seen: string | null
}

const DEFAULT_LOOKBACK_DAYS = 90
const MAX_UIDS_TO_FETCH = 80
const MAX_BODY_PARSE = 30

const NOREPLY_LOCAL = /^(no-?reply|donotreply|noreply|mailer-daemon|postmaster|bounce)/i

/** Termini IMAP SUBJECT/BODY derivati dal nome fornitore (es. «Cici Cibo Limited» → «Cici Cibo»). */
export function buildSupplierInboxSearchTerms(
  nome: string,
  displayName?: string | null,
): string[] {
  const terms = new Set<string>()
  for (const raw of [nome, displayName]) {
    const n = raw?.trim()
    if (!n || n.length < 4) continue
    terms.add(n)
    const short = n
      .replace(/\s+(limited|ltd\.?|plc|inc\.?|incorporated|s\.?r\.?l\.?|srl|snc|spa)\.?\s*$/i, '')
      .trim()
    if (short.length >= 4) terms.add(short)
    const tokens = n
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !/^(ltd|limited|plc|inc|srl|spa)$/i.test(t))
    if (tokens.length >= 2) terms.add(tokens.slice(0, 2).join(' '))
  }
  return [...terms]
    .filter((t) => t.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 4)
}

function isUsableSupplierCandidate(
  email: string,
  opts: { exclude: Set<string> },
): boolean {
  const key = email.trim().toLowerCase()
  if (!key.includes('@') || key.length < 6) return false
  if (opts.exclude.has(key)) return false
  if (isSharedBillingPlatformSenderEmail(key)) return false
  const local = key.split('@')[0] ?? ''
  if (NOREPLY_LOCAL.test(local)) return false
  return true
}

function addressListEmails(addrs: AddressObject | AddressObject[] | undefined): string[] {
  if (!addrs) return []
  const list = Array.isArray(addrs) ? addrs : [addrs]
  return list
    .map((a) => (a.address ?? '').trim().toLowerCase())
    .filter((e) => e.includes('@'))
}

export function messageMatchesFornitore(
  subject: string | null | undefined,
  fromDisplayName: string | null | undefined,
  fornitoreNome: string,
  displayName?: string | null,
): boolean {
  const stmtSupplier = extractStatementFromSupplierName(subject)
  if (stmtSupplier && fornitoreNomeMatchesOcr(fornitoreNome, stmtSupplier)) return true

  for (const candidate of [fornitoreNome, displayName]) {
    if (!candidate?.trim()) continue
    if (fromDisplayName && fornitoreNomeMatchesOcr(candidate, fromDisplayName)) return true
    if (subject && fornitoreNomeMatchesOcr(candidate, subject)) return true
  }
  return false
}

function mergeInboxEmail(
  map: Map<string, { count: number; last_seen: string | null; source: InboxDiscoveredEmailSource }>,
  email: string,
  date: string | null | undefined,
  source: InboxDiscoveredEmailSource,
  exclude: Set<string>,
) {
  const key = email.trim().toLowerCase()
  if (!isUsableSupplierCandidate(key, { exclude })) return
  const existing = map.get(key)
  if (existing) {
    existing.count += 1
    if (date && (!existing.last_seen || date > existing.last_seen)) {
      existing.last_seen = date
    }
    if (source === 'inbox_from' || (source === 'inbox_reply_to' && existing.source === 'inbox_body')) {
      existing.source = source
    }
  } else {
    map.set(key, { count: 1, last_seen: date ?? null, source })
  }
}

function extractBodyContactEmails(bodyText: string | null | undefined): string[] {
  if (!bodyText?.trim()) return []
  const fields = extractSupplierFieldsFromEmailBody(bodyText)
  const found = new Set<string>()
  if (fields.email_contatto) found.add(fields.email_contatto.toLowerCase())
  for (const m of bodyText.matchAll(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g)) {
    found.add(m[0].toLowerCase())
  }
  return [...found]
}

type EnvelopeCandidate = {
  uid: number
  subject: string | null
  fromDisplayName: string | null
  fromEmail: string | null
  replyToEmails: string[]
  dateIso: string | null
}

export async function discoverFornitoreEmailsFromInbox(
  supabase: SupabaseClient,
  fornitore: {
    id: string
    nome: string
    display_name?: string | null
    sede_id: string | null
    email?: string | null
  },
  opts?: {
    lookbackDays?: number
    knownEmails?: Set<string>
  },
): Promise<{
  suggestions: InboxDiscoveredEmail[]
  billing_platform_only: boolean
  scanned: boolean
  search_terms: string[]
  mails_matched: number
  lookback_days: number
  inbox_confirmed_known: string[]
  error?: string
}> {
  if (!fornitore.sede_id) {
    return {
      suggestions: [],
      billing_platform_only: false,
      scanned: false,
      search_terms: [],
      mails_matched: 0,
      lookback_days: 0,
      inbox_confirmed_known: [],
      error: 'sede_missing',
    }
  }

  const { data: sede } = await supabase
    .from('sedi')
    .select('id, nome, imap_host, imap_port, imap_user, imap_password, imap_lookback_days')
    .eq('id', fornitore.sede_id)
    .maybeSingle()

  if (!sede?.imap_host || !sede.imap_user || !sede.imap_password) {
    return {
      suggestions: [],
      billing_platform_only: false,
      scanned: false,
      search_terms: [],
      mails_matched: 0,
      lookback_days: 0,
      inbox_confirmed_known: [],
      error: 'imap_not_configured',
    }
  }

  const password = await decryptImapPassword(supabase, sede.imap_password)
  if (!password) {
    return {
      suggestions: [],
      billing_platform_only: false,
      scanned: false,
      search_terms: [],
      mails_matched: 0,
      lookback_days: 0,
      inbox_confirmed_known: [],
      error: 'imap_decrypt_failed',
    }
  }

  const lookbackDays = Math.min(
    365,
    Math.max(7, opts?.lookbackDays ?? sede.imap_lookback_days ?? DEFAULT_LOOKBACK_DAYS),
  )
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  const searchTerms = buildSupplierInboxSearchTerms(fornitore.nome, fornitore.display_name)
  if (searchTerms.length === 0) {
    return {
      suggestions: [],
      billing_platform_only: false,
      scanned: false,
      search_terms: [],
      mails_matched: 0,
      lookback_days: 0,
      inbox_confirmed_known: [],
      error: 'name_too_short',
    }
  }

  const exclude = new Set<string>(opts?.knownEmails ?? [])
  if (fornitore.email?.trim()) exclude.add(fornitore.email.trim().toLowerCase())
  if (sede.imap_user?.trim()) exclude.add(sede.imap_user.trim().toLowerCase())

  const creds: ImapCredentials = {
    host: sede.imap_host,
    port: sede.imap_port ?? 993,
    user: sede.imap_user,
    password,
    secure: (sede.imap_port ?? 993) !== 143,
  }

  const map = new Map<
    string,
    { count: number; last_seen: string | null; source: InboxDiscoveredEmailSource }
  >()
  const skippedKnownEmails = new Set<string>()
  let billingPlatformHits = 0
  let mailsMatched = 0

  function mergeInboxEmailTracked(
    email: string,
    date: string | null | undefined,
    source: InboxDiscoveredEmailSource,
  ) {
    const key = email.trim().toLowerCase()
    if (!key.includes('@') || key.length < 6) return
    if (exclude.has(key)) {
      skippedKnownEmails.add(key)
      return
    }
    if (isSharedBillingPlatformSenderEmail(key)) return
    mergeInboxEmail(map, email, date, source, exclude)
  }

  try {
    await withImapSession(creds, async (client) => {
      const lock = await client.getMailboxLock('INBOX')
      try {
        const uidSet = new Set<number>()
        for (const term of searchTerms) {
          for (const field of ['subject', 'body'] as const) {
            try {
              const partial = await client.search({ since, [field]: term }, { uid: true })
              if (Array.isArray(partial)) {
                for (const u of partial) {
                  if (typeof u === 'number') uidSet.add(u)
                }
              }
            } catch {
              /* search singola fallita: prosegui */
            }
          }
        }

        const uids = [...uidSet].slice(0, MAX_UIDS_TO_FETCH)
        if (uids.length === 0) return

        const candidates: EnvelopeCandidate[] = []
        for await (const msg of client.fetch(
          uids,
          { envelope: true, internalDate: true },
          { uid: true },
        )) {
          const env = msg.envelope
          const subject = env?.subject ?? null
          const fromAddr = env?.from?.[0]
          const fromEmail = fromAddr?.address?.trim().toLowerCase() ?? null
          const fromDisplayName = fromAddr?.name?.trim() ?? null
          const dateIso =
            (msg.internalDate instanceof Date
              ? msg.internalDate
              : msg.internalDate
                ? new Date(msg.internalDate)
                : env?.date ?? null)?.toISOString?.() ?? null

          if (
            !messageMatchesFornitore(subject, fromDisplayName, fornitore.nome, fornitore.display_name)
          ) {
            continue
          }

          if (fromEmail && isSharedBillingPlatformSenderEmail(fromEmail)) {
            billingPlatformHits += 1
          }

          candidates.push({
            uid: msg.uid,
            subject,
            fromDisplayName,
            fromEmail,
            replyToEmails: addressListEmails(env?.replyTo as AddressObject | AddressObject[] | undefined),
            dateIso,
          })
        }

        mailsMatched = candidates.length

        let bodyParsed = 0
        for (const c of candidates) {
          if (c.fromEmail && isSharedBillingPlatformSenderEmail(c.fromEmail)) {
            for (const rt of c.replyToEmails) {
              mergeInboxEmailTracked(rt, c.dateIso, 'inbox_reply_to')
            }
          } else if (c.fromEmail) {
            mergeInboxEmailTracked(c.fromEmail, c.dateIso, 'inbox_from')
          }

          const needsBody =
            bodyParsed < MAX_BODY_PARSE &&
            (!c.fromEmail ||
              isSharedBillingPlatformSenderEmail(c.fromEmail) ||
              c.replyToEmails.length === 0)

          if (!needsBody) continue
          bodyParsed += 1

          try {
            for await (const msg of client.fetch([c.uid], { source: true }, { uid: true })) {
              if (!msg.source) break
              const parsed = await simpleParser(msg.source)
              for (const rt of addressListEmails(parsed.replyTo)) {
                mergeInboxEmailTracked(rt, c.dateIso, 'inbox_reply_to')
              }
              const fromHeader = extractEmailFromSenderHeader(parsed.from?.text ?? '')
              if (fromHeader && !isSharedBillingPlatformSenderEmail(fromHeader)) {
                mergeInboxEmailTracked(fromHeader, c.dateIso, 'inbox_from')
              }
              for (const em of extractBodyContactEmails(parsed.text ?? null)) {
                mergeInboxEmailTracked(em, c.dateIso, 'inbox_body')
              }
              break
            }
          } catch {
            /* body singolo: ignora */
          }
        }
      } finally {
        lock.release()
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      suggestions: [],
      billing_platform_only: false,
      scanned: true,
      search_terms: searchTerms,
      mails_matched: 0,
      lookback_days: lookbackDays,
      inbox_confirmed_known: [],
      error: message,
    }
  }

  const suggestions: InboxDiscoveredEmail[] = [...map.entries()]
    .map(([email, v]) => ({ email, ...v }))
    .sort((a, b) => b.count - a.count || (b.last_seen ?? '').localeCompare(a.last_seen ?? ''))

  const confirmedKnown = [...skippedKnownEmails]
  const billing_platform_only =
    suggestions.length === 0 && billingPlatformHits > 0 && confirmedKnown.length === 0

  return {
    suggestions,
    billing_platform_only,
    scanned: true,
    search_terms: searchTerms,
    mails_matched: mailsMatched,
    lookback_days: lookbackDays,
    inbox_confirmed_known: confirmedKnown,
  }
}
