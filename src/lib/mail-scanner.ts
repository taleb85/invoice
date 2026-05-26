import { simpleParser } from 'mailparser'
import { withImapSession, type ImapCredentials } from '@/lib/imap-session'
import { isFiscalDocumentAttachment } from '@/lib/fiscal-document-attachments'
import { imapTlsOptions } from '@/lib/imap-tls'

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
    tls: imapTlsOptions(),
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
  /**
   * Chiamato dopo che `client.search()` ritorna il primo set di UID. Permette al chiamante
   * di emettere un evento UI "trovate N email" PRIMA che inizi il lungo loop FETCH —
   * fondamentale per evitare il "buco visivo" durante il download.
   */
  afterSearch?: (info: { totalUids: number }) => void | Promise<void>
  /**
   * Chiamato PRIMA di ciascuna IMAP `search` quando si usa lo scope mittente.
   * Permette alla UI di scrivere log "cerco da {term}…" — utile su provider lenti.
   */
  beforeEachSearchTerm?: (info: { term: string; index: number; total: number }) => void | Promise<void>
  /**
   * Riepiloga l'esito del tentativo "by-subject" (modalità chirurgica per
   * statement): quando `subjectAnyOf` è valorizzato, eseguiamo prima N×M
   * `search({from, subject})` e logghiamo il totale UID trovato. Se zero, il
   * chiamante può decidere se attivare il fallback "by-sender" (vedi
   * `useSenderFallback` in `SenderSearchScope`).
   */
  afterSubjectScopedSearch?: (info: { totalUids: number; subjectCount: number; senderCount: number }) => void | Promise<void>
  /**
   * Chiamato ogni `fetchProgressEvery` messaggi durante il loop FETCH (default 5).
   * Lo scan-emails route usa questo per emettere progressi NDJSON anche durante un FETCH
   * lungo, così la UI non sembra bloccata.
   */
  onFetchProgress?: (info: { fetched: number; total: number }) => void | Promise<void>
  /** Frequenza chiamata onFetchProgress: ogni N messaggi (default 5). */
  fetchProgressEvery?: number
}

/**
 * Restringe la IMAP SEARCH lato server al mittente — usato quando la pipeline
 * è mirata a un singolo fornitore. Si traduce in N `client.search({ from, since })`
 * paralleli (uno per ogni email + uno per ogni dominio non-generico) le cui UID
 * vengono unite. Senza questa opzione, la ricerca è solo per data e l'intero
 * batch della finestra viene scaricato + filtrato in memoria — operazione molto
 * più costosa quando interessa un solo fornitore.
 */
export type SenderSearchScope = {
  /** Indirizzi email completi (es. "ordini@acmespa.it"). Match esatto via IMAP `FROM`. */
  emails: string[]
  /** Domini non generici (es. "acmespa.it"). Match come substring `FROM @dominio`. */
  domains: string[]
  /**
   * Quando valorizzato (>=1 entry), la SEARCH IMAP combina ciascun `FROM` con
   * ciascun `SUBJECT/BODY` come query congiunta: ricerca chirurgica scoped al
   * singolo statement, drasticamente meno costosa. Tipicamente sono numeri
   * fattura/DDT (es. ["INV1153076", "INV1154087"]).
   *
   * Senza `useSenderFallback`, se la search by-subject torna 0 UID l'output è
   * vuoto (rispettoso dell'intento dell'utente). Con `useSenderFallback: true`
   * la pipeline riprova con la sola search by-sender (comportamento storico).
   */
  subjectAnyOf?: string[]
  /**
   * Solo rilevante quando `subjectAnyOf` ha entries. Se `true`, in caso di 0
   * risultati by-subject riprova con la sola search by-sender (più ampia).
   * Default `false`: rispetta la scelta dell'utente "mirato per statement".
   */
  useSenderFallback?: boolean
}

export async function fetchUnseenEmails(
  hooks?: FetchUnseenImapHooks,
  fiscalRange?: { start: Date; endExclusive: Date } | null,
  /** Solo senza fiscalRange: limita la ricerca IMAP `SINCE` (lette e non lette). Ha priorità se entrambi valorizzati. */
  lookbackDays?: number | null,
  /** Alternativa ai giorni: finestra più stretta per sync cron (es. ultime 3 ore). */
  lookbackHours?: number | null,
  /**
   * Scope mittente per restringere la search lato server. Se valorizzato e contiene
   * almeno una entry, eseguiamo `search({from, since})` per ciascun termine e
   * uniamo le UID risultanti, riducendo drasticamente il volume scaricato.
   */
  senderScope?: SenderSearchScope | null
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

      /**
       * Costruisce i vincoli di data condivisi da ogni search.
       * Combinati con `from`, restringono ulteriormente il set restituito.
       */
      const dateCriteria: { since?: Date; before?: Date } = fiscalRange
        ? { since: fiscalRange.start, before: fiscalRange.endExclusive }
        : sinceLookback
          ? { since: sinceLookback }
          : {}

      /**
       * Quando lo `senderScope` è valorizzato facciamo N IMAP `search` (una per
       * indirizzo + una per dominio) con `from` come substring di RFC822 From.
       * Le UID risultanti vengono unite (dedup). Questo elimina la necessità di
       * scaricare TUTTA la finestra temporale solo per filtrare il mittente.
       *
       * Falliscono individualmente è tollerato: una search rotta sull'IMAP del
       * provider non deve uccidere l'intera fetch — logghiamo e proseguiamo.
       */
      const senderTerms = senderScope
        ? [
            ...senderScope.emails.map(e => e.trim()).filter(Boolean),
            ...senderScope.domains
              .map(d => d.trim().replace(/^@?/, '@'))
              .filter(Boolean),
          ]
        : []
      const useSenderSearch = senderTerms.length > 0
      // Termini opzionali per la ricerca chirurgica per oggetto/corpo
      // (es. numeri fattura dello statement aperto). Quando presenti, si
      // combinano con `senderTerms` come query congiunta SUBJECT/BODY ∧ FROM.
      const subjectTerms = (senderScope?.subjectAnyOf ?? [])
        .map(s => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean)
      const useSubjectScopedSearch = useSenderSearch && subjectTerms.length > 0

      let uids: number[] = []
      if (useSubjectScopedSearch) {
        // Modalità "mirato per statement": cerchiamo SOLO mail il cui oggetto
        // o corpo contiene uno dei numeri fattura/DDT noti, vincolate al
        // mittente del fornitore e alla finestra di date. ImapFlow non supporta
        // OR-list nativa per N>2 termini, quindi facciamo prodotto cartesiano
        // di N×M search e uniamo gli UID. Tipicamente N≤4 (alias mittente) e
        // M≤10 (righe statement) → ~40 search rapide.
        const seen = new Set<number>()
        let pairIndex = 0
        const totalPairs = senderTerms.length * subjectTerms.length * 2
        for (const fromTerm of senderTerms) {
          for (const needle of subjectTerms) {
            for (const field of ['subject', 'body'] as const) {
              pairIndex++
              try {
                await hooks?.beforeEachSearchTerm?.({
                  term: `FROM "${fromTerm}" ${field.toUpperCase()} "${needle}"`,
                  index: pairIndex - 1,
                  total: totalPairs,
                })
              } catch { /* hook best-effort */ }
              try {
                const partial = await client.search(
                  { ...dateCriteria, from: fromTerm, [field]: needle } as Parameters<typeof client.search>[0],
                  { uid: true }
                )
                if (Array.isArray(partial)) {
                  for (const u of partial) {
                    if (typeof u === 'number' && !seen.has(u)) {
                      seen.add(u)
                      uids.push(u)
                    }
                  }
                }
              } catch {
                // Search singola fallita: continuiamo con il prossimo pair.
              }
            }
          }
        }
        await hooks?.afterSubjectScopedSearch?.({
          totalUids: uids.length,
          subjectCount: subjectTerms.length,
          senderCount: senderTerms.length,
        })

        // Fallback opzionale: se 0 UID e l'utente l'ha richiesto, riproviamo
        // con la sola search by-sender (più ampia). Senza fallback, "0 UID
        // by-subject" significa output vuoto.
        if (uids.length === 0 && senderScope?.useSenderFallback === true) {
          const seenFb = new Set<number>()
          for (let i = 0; i < senderTerms.length; i++) {
            const term = senderTerms[i]
            try {
              await hooks?.beforeEachSearchTerm?.({ term, index: i, total: senderTerms.length })
            } catch { /* hook best-effort */ }
            try {
              const partial = await client.search(
                { ...dateCriteria, from: term },
                { uid: true }
              )
              if (Array.isArray(partial)) {
                for (const u of partial) {
                  if (typeof u === 'number' && !seenFb.has(u)) {
                    seenFb.add(u)
                    uids.push(u)
                  }
                }
              }
            } catch { /* tolleranza search fallite */ }
          }
        }
      } else if (useSenderSearch) {
        const seen = new Set<number>()
        for (let i = 0; i < senderTerms.length; i++) {
          const term = senderTerms[i]
          await hooks?.beforeEachSearchTerm?.({ term, index: i, total: senderTerms.length })
          try {
            const partial = await client.search(
              { ...dateCriteria, from: term },
              { uid: true }
            )
            if (Array.isArray(partial)) {
              for (const u of partial) {
                if (typeof u === 'number' && !seen.has(u)) {
                  seen.add(u)
                  uids.push(u)
                }
              }
            }
          } catch {
            // Una search by-sender fallita: continuiamo con le altre.
            // Non c'è fallback by-date: l'utente preferisce non scaricare tutto.
          }
        }
      } else {
        const searchResult = await client.search(
          fiscalRange
            ? { since: fiscalRange.start, before: fiscalRange.endExclusive }
            : sinceLookback
              ? { since: sinceLookback }
              : { all: true },
          { uid: true }
        )
        uids = Array.isArray(searchResult) ? searchResult.filter((u): u is number => typeof u === 'number') : []
      }

      await hooks?.afterSearch?.({ totalUids: uids.length })
      if (uids.length === 0) return results

      const fetchProgressEvery = Math.max(1, hooks?.fetchProgressEvery ?? 5)
      let fetched = 0
      for await (const msg of client.fetch(
        uids,
        { source: true, internalDate: true, envelope: true },
        { uid: true }
      )) {
        fetched++
        // Heartbeat ogni N messaggi: il chiamante può emettere stream events
        // per evitare che la UI sembri bloccata durante FETCH lunghi (es. 200+ email).
        if (hooks?.onFetchProgress && (fetched === 1 || fetched % fetchProgressEvery === 0 || fetched === uids.length)) {
          try {
            await hooks.onFetchProgress({ fetched, total: uids.length })
          } catch { /* hook deve essere best-effort: errori del consumer non bloccano il fetch */ }
        }
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
