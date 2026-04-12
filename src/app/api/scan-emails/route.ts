import { NextResponse } from 'next/server'
import { fetchUnseenEmails, markEmailsAsRead, ScannedEmail } from '@/lib/mail-scanner'
import { createServiceClient } from '@/utils/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { ocrInvoice, OcrResult } from '@/lib/ocr-invoice'
import { ocrStatement } from '@/lib/ocr-statement'
import { runTripleCheck } from '@/lib/triple-check'
import { isLikelyRekkiEmail, parseRekkiFromEmailParts } from '@/lib/rekki-parser'
import { persistRekkiOrderStatement } from '@/lib/rekki-statement'

/** Nessun `console.log` in produzione (log Vercel / dati sensibili). */
const mailDebugLog =
  process.env.NODE_ENV !== 'production' ? (...args: unknown[]) => console.log(...args) : () => {}

/** Converte OcrResult in oggetto metadata da salvare in jsonb.
 *  Includes raw amount string and format hint for UI validation badge. */
function buildMetadata(ocr: OcrResult, matchedBy: 'email' | 'alias' | 'domain' | 'piva' | 'unknown') {
  return {
    ragione_sociale:    ocr.ragione_sociale,
    p_iva:              ocr.p_iva,
    data_fattura:       ocr.data_fattura,
    numero_fattura:     ocr.numero_fattura,
    // Stored as a pure float — no formatting at rest
    totale_iva_inclusa: ocr.totale_iva_inclusa,
    // Preserved for UI validation badge ("Parsed as UK format £1,234.56")
    importo_raw:        ocr.importo_raw ?? null,
    formato_importo:    ocr.formato_importo ?? null,
    matched_by:         matchedBy,
  }
}

/**
 * Normalizza qualsiasi stringa data in formato YYYY-MM-DD accettato da PostgreSQL.
 * GPT può restituire "8 Apr 2026", "08/04/2026", "2026-04-08", ecc.
 * Restituisce null se la data non è parsabile.
 */
function safeDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Già in formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // Prova a parsare con Date (gestisce "8 Apr 2026", "08/04/2026", ecc.)
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) {
    // Formato italiano DD/MM/YYYY o DD-MM-YYYY
    const itMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
    if (itMatch) {
      const [, dd, mm, yyyy] = itMatch
      const d2 = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`)
      if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10)
    }
    console.warn(`[DATE] Data non parsabile: "${raw}" — impostata a null`)
    return null
  }
  return d.toISOString().slice(0, 10)
}

/**
 * Esegue l'insert in documenti_da_processare con fallback automatico:
 * se la colonna 'metadata' non è ancora stata migrata (errore 42703),
 * riprova senza il campo metadata.
 * Ritorna l'errore finale (null = successo).
 */
async function insertDocumento(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from('documenti_da_processare').insert([payload])

  if (error) {
    // Fallback: colonna 'metadata' non ancora migrata
    if (error.code === '42703' || error.message?.includes('metadata') || error.message?.includes('is_statement')) {
      console.warn('[INSERT] Colonna extra non trovata — retry senza metadata/is_statement')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { metadata: _m, is_statement: _is, ...safePayload } = payload as Record<string, unknown>
      const { error: e2 } = await supabase.from('documenti_da_processare').insert([safePayload])
      if (e2) console.error('[INSERT] Fallback insert error:', e2.message)
      return e2
    }
    console.error('[INSERT] Errore inserimento documento:', error.message)
  }

  return error
}

type LogStato = 'successo' | 'fornitore_non_trovato' | 'bolla_non_trovata'

async function insertLog(
  supabase: SupabaseClient,
  email: ScannedEmail,
  stato: LogStato,
  opts: { fornitore_id?: string; file_url?: string; errore_dettaglio?: string } = {}
) {
  await supabase.from('log_sincronizzazione').insert([{
    mittente: email.from,
    oggetto_mail: email.subject ?? null,
    stato,
    fornitore_id: opts.fornitore_id ?? null,
    file_url: opts.file_url ?? null,
    errore_dettaglio: opts.errore_dettaglio ?? null,
  }])
}

/** Scansiona una casella IMAP e restituisce le email non lette con allegati. */
async function fetchFromImap(host: string, port: number, user: string, password: string, lookbackDays?: number | null): Promise<ScannedEmail[]> {
  mailDebugLog(`[IMAP] Tentativo di connessione: host=${host} porta=${port} utente=${user} lookback=${lookbackDays ?? 'illimitato'}gg`)
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass: password },
    logger: false,
  })

  await client.connect()
  mailDebugLog(`[IMAP] Connessione stabilita: ${host}`)
  const emails: ScannedEmail[] = []

  // Build search criteria: unseen + optional date filter
  const sinceDate = lookbackDays && lookbackDays > 0
    ? new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    : undefined
  const searchCriteria = sinceDate
    ? { seen: false, since: sinceDate }
    : { seen: false }

  try {
    await client.mailboxOpen('INBOX')
    let totalMsg = 0
    let withAttach = 0
    for await (const msg of client.fetch(searchCriteria, { envelope: true, source: true })) {
      totalMsg++
      if (!msg.source) continue
      const parsed = await simpleParser(msg.source)

      const attachments = (parsed.attachments ?? [])
        .filter(a => {
          const ct = a.contentType ?? ''
          return ct.startsWith('image/') || ct === 'application/pdf'
        })
        .map(a => {
          const ext = a.filename?.split('.').pop() ?? (a.contentType === 'application/pdf' ? 'pdf' : 'jpg')
          return {
            filename: a.filename ?? `allegato.${ext}`,
            content: a.content,
            contentType: a.contentType,
            extension: ext,
          }
        })

      if (!attachments.length) continue
      withAttach++

      const txt = parsed.text?.trim()
        ? parsed.text
        : typeof parsed.html === 'string'
          ? parsed.html
              .replace(/<script[\s\S]*?<\/script>/gi, ' ')
              .replace(/<style[\s\S]*?<\/style>/gi, ' ')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          : ''

      emails.push({
        uid: msg.uid,
        from: parsed.from?.value?.[0]?.address ?? '',
        subject: parsed.subject ?? null,
        bodyText: txt || null,
        attachments,
      })
    }
    mailDebugLog(`[IMAP] Messaggi non letti trovati: ${totalMsg} (con allegati validi: ${withAttach})`)
  } finally {
    await client.logout()
    mailDebugLog(`[IMAP] Logout da ${host}`)
  }

  return emails
}

async function markReadOnImap(host: string, port: number, user: string, password: string, uids: number[]) {
  if (!uids.length) return
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass: password },
    logger: false,
  })
  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    await client.messageFlagsAdd({ uid: uids as unknown as string }, ['\\Seen'], { uid: true })
  } finally {
    await client.logout()
  }
}

type Fornitore = { id: string; nome: string; sede_id: string | null; language?: string | null }

async function resolveFornitore(
  supabase: SupabaseClient,
  senderEmail: string,
  sedeFilter?: string
): Promise<Fornitore | null> {
  mailDebugLog(`[RLS] resolveFornitore: mittente="${senderEmail}" sedeFilter=${sedeFilter ?? 'nessuno'}`)

  // 1️⃣ Alias esatto
  const aliasQuery = supabase
    .from('fornitore_emails')
    .select('fornitore_id, fornitori!inner(id, nome, sede_id, language)')
    .ilike('email', senderEmail)
    .limit(1)
  if (sedeFilter) aliasQuery.eq('fornitori.sede_id', sedeFilter)
  const { data: aliasRows, error: aliasErr } = await aliasQuery
  mailDebugLog(`[RLS] alias query → righe=${aliasRows?.length ?? 0}${aliasErr ? ` errore="${aliasErr.message}"` : ''}`)
  if (aliasRows?.length) {
    const found = (aliasRows[0] as unknown as { fornitori: Fornitore }).fornitori
    mailDebugLog(`[RLS] trovato via alias: ${found.nome} (id=${found.id})`)
    return found
  }

  // 2️⃣ Email principale
  const fornitoriQuery = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language')
    .ilike('email', senderEmail)
    .limit(1)
  if (sedeFilter) fornitoriQuery.eq('sede_id', sedeFilter)
  const { data: fornitori, error: fornErr } = await fornitoriQuery
  mailDebugLog(`[RLS] email principale query → righe=${fornitori?.length ?? 0}${fornErr ? ` errore="${fornErr.message}"` : ''}`)
  if (fornitori?.length) {
    mailDebugLog(`[RLS] trovato via email principale: ${fornitori[0].nome}`)
    return fornitori[0]
  }

  // 3️⃣ Dominio (evita domini generici)
  const domain = senderEmail.split('@')[1]?.toLowerCase()
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'libero.it', 'pec.it', 'legalmail.it', 'aruba.it']
  if (domain && !genericDomains.includes(domain)) {
    const domainQuery = supabase
      .from('fornitori')
      .select('id, nome, sede_id, language')
      .ilike('email', `%@${domain}`)
      .limit(1)
    if (sedeFilter) domainQuery.eq('sede_id', sedeFilter)
    const { data: byDomain, error: domErr } = await domainQuery
    mailDebugLog(`[RLS] dominio "@${domain}" query → righe=${byDomain?.length ?? 0}${domErr ? ` errore="${domErr.message}"` : ''}`)
    if (byDomain?.length) {
      mailDebugLog(`[RLS] trovato via dominio: ${byDomain[0].nome}`)
      return byDomain[0]
    }
  } else {
    mailDebugLog(`[RLS] dominio "@${domain}" saltato (generico o mancante)`)
  }

  mailDebugLog(`[RLS] fornitore NON trovato per "${senderEmail}"`)
  return null
}

/**
 * Tentativo di matching per P.IVA (usato come fallback quando l'email è sconosciuta).
 * Normalizza la P.IVA rimuovendo prefisso paese e caratteri non numerici.
 */
async function resolveFornitoreByPIVA(
  supabase: SupabaseClient,
  piva: string,
  sedeFilter?: string
): Promise<{ fornitore: Fornitore; matchedBy: 'piva' } | null> {
  const pivaNorm = piva.replace(/\D/g, '')
  if (pivaNorm.length < 7) return null   // troppo corto per essere una P.IVA

  mailDebugLog(`[PIVA] Ricerca fornitore per P.IVA normalizzata: "${pivaNorm}"`)
  const q = supabase
    .from('fornitori')
    .select('id, nome, sede_id, language')
    .or(`piva.ilike.%${pivaNorm}%,piva.eq.${pivaNorm}`)
    .limit(1)
  if (sedeFilter) q.eq('sede_id', sedeFilter)
  const { data, error } = await q
  if (error) console.warn(`[PIVA] Errore query: ${error.message}`)
  if (data?.length) {
    mailDebugLog(`[PIVA] ✅ Trovato via P.IVA: ${data[0].nome} (${data[0].id})`)
    return { fornitore: data[0], matchedBy: 'piva' }
  }
  mailDebugLog(`[PIVA] Nessun fornitore per P.IVA "${pivaNorm}"`)
  return null
}

async function processEmails(
  supabase: SupabaseClient,
  emails: ScannedEmail[],
  sedeFilter?: string,
  fallbackSedeId?: string    // usato solo per global IMAP quando sedeFilter è undefined
): Promise<{ ricevuti: number; ignorate: number; bozzaCreate: number; toMarkRead: number[] }> {
  let ricevuti = 0
  let ignorate = 0
  const uidsToMarkRead: number[] = []
  const rekkiPersistedUids = new Set<number>()

  // La sede effettiva da usare: priorità sedeFilter (per-sede IMAP) → fallbackSedeId (global IMAP)
  const effectiveSede = sedeFilter ?? fallbackSedeId ?? null
  mailDebugLog(`[PROCESS] Inizio processEmails: ${emails.length} email, sedeFilter=${sedeFilter ?? 'nessuno'} fallback=${fallbackSedeId ?? 'nessuno'} effective=${effectiveSede ?? 'NULL'}`)

  // ── FASE 1: raggruppa tutti gli allegati per fornitore ─────────────────
  // Item include anche l'OCR pre-computato (per i documenti risolti via P.IVA)
  type Item = {
    email: ScannedEmail
    attachment: ScannedEmail['attachments'][number]
    ocr?: OcrResult   // pre-computato se risolto via P.IVA
  }
  type GroupEntry = { fornitore: Fornitore; items: Item[]; matchedBy: 'email' | 'alias' | 'domain' | 'piva' }
  const groups = new Map<string, GroupEntry>()
  const noFornitore: ScannedEmail[] = []

  for (const email of emails) {
    mailDebugLog(`[PROCESS] Analisi email da: ${email.from} | allegati: ${email.attachments.length}`)
    const fornitore = await resolveFornitore(supabase, email.from, sedeFilter)
    if (!fornitore) {
      mailDebugLog(`[PROCESS] ⚠️  Fornitore non trovato per "${email.from}" — OCR+P.IVA verrà tentato`)
      noFornitore.push(email)
      continue
    }
    mailDebugLog(`[PROCESS] ✅ Fornitore abbinato: ${fornitore.nome} (${fornitore.id})`)
    if (!groups.has(fornitore.id)) {
      groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'email' })
    }
    for (const attachment of email.attachments) {
      groups.get(fornitore.id)!.items.push({ email, attachment })
    }
  }

  mailDebugLog(`[PROCESS] Riepilogo fase 1: ${groups.size} fornitori abbinati via email, ${noFornitore.length} email senza fornitore`)

  // ── Mittenti sconosciuti: OCR → tenta P.IVA match → salva in coda ─────
  for (const email of noFornitore) {
    for (const attachment of email.attachments) {
      mailDebugLog(`[PROCESS] Mittente sconosciuto "${email.from}" — OCR in corso per tentare matching P.IVA`)

      // 1. OCR completo — no supplier language hint available for unknown senders
      const ocr = await ocrInvoice(attachment.content, attachment.contentType, undefined)
      mailDebugLog(`[PROCESS] OCR sconosciuto: ragione_sociale=${ocr.ragione_sociale ?? '—'} piva=${ocr.p_iva ?? '—'} totale=${ocr.totale_iva_inclusa ?? '—'}`)

      // 2. Prova a trovare il fornitore via P.IVA estratta dal documento
      let pivaMatchResult: Awaited<ReturnType<typeof resolveFornitoreByPIVA>> = null
      if (ocr.p_iva) {
        pivaMatchResult = await resolveFornitoreByPIVA(supabase, ocr.p_iva, sedeFilter)
        if (pivaMatchResult) {
          // Spostalo nel gruppo dei fornitori noti per evitare doppia elaborazione
          const { fornitore } = pivaMatchResult
          if (!groups.has(fornitore.id)) groups.set(fornitore.id, { fornitore, items: [], matchedBy: 'piva' })
          groups.get(fornitore.id)!.items.push({ email, attachment, ocr })
          mailDebugLog(`[PROCESS] ✅ Documento sconosciuto risolto via P.IVA → "${fornitore.nome}"`)
          if (!uidsToMarkRead.includes(email.uid)) uidsToMarkRead.push(email.uid)
          continue
        }
      }

      // 3. Nessun match → upload + salva come sconosciuto
      const uniqueName = `email_auto_${crypto.randomUUID()}.${attachment.extension}`
      const { error: uploadError } = await supabase.storage
        .from('documenti')
        .upload(uniqueName, attachment.content, { contentType: attachment.contentType, upsert: false })

      if (uploadError) {
        console.error(`[PROCESS] Upload fallito (sconosciuto): ${uploadError.message}`)
        await insertLog(supabase, email, 'fornitore_non_trovato', {
          errore_dettaglio: `Mittente sconosciuto. Errore upload: ${uploadError.message}`,
        })
        ignorate++
        continue
      }

      const { data: pub } = supabase.storage.from('documenti').getPublicUrl(uniqueName)
      // sede_id: usa sempre sedeFilter (scansione corrente) come priorità massima
      const unknownDocSedeId = sedeFilter ?? fallbackSedeId ?? effectiveSede ?? null

      const unknownPayload = {
        fornitore_id:   null,
        sede_id:        unknownDocSedeId,
        mittente:       email.from || 'sconosciuto',
        oggetto_mail:   email.subject ?? null,
        file_url:       pub.publicUrl,
        file_name:      attachment.filename ?? null,
        content_type:   attachment.contentType ?? null,
        data_documento: safeDate(ocr.data_fattura),
        stato:          'da_associare',
        metadata:       buildMetadata(ocr, 'unknown'),
      }

      const insErr = await insertDocumento(supabase, unknownPayload)

      if (insErr) {
        const detail = `[${insErr.code ?? 'ERR'}] ${insErr.message}${insErr.details ? ' | ' + insErr.details : ''}`
        console.error(`[PROCESS] ❌ Insert sconosciuto fallito: ${detail}`)
        await insertLog(supabase, email, 'fornitore_non_trovato', {
          errore_dettaglio: detail,
        })
        ignorate++
      } else {
        mailDebugLog(`[PROCESS] ✅ Documento sconosciuto salvato — mittente="${email.from}" sede=${unknownDocSedeId ?? 'NULL'} piva_ocr="${ocr.p_iva ?? '—'}"`)
        await insertLog(supabase, email, 'successo', { file_url: pub.publicUrl })
        ricevuti++
        if (!uidsToMarkRead.includes(email.uid)) uidsToMarkRead.push(email.uid)
      }
    }
  }

  // ── FASE 2: per ogni fornitore, OCR, salva in coda e crea Bolla/Fattura bozza ─
  let bozzaCreate = 0

  for (const { fornitore, items, matchedBy } of groups.values()) {
    // OCR in parallelo; se già pre-computato (da P.IVA match) lo riutilizza.
    // Pass supplier language as a parsing hint (conflict-prevention rule:
    // supplier language takes priority for parsing; sede currency used for display).
    const langHint = fornitore.language ?? undefined
    const ocrResults: OcrResult[] = await Promise.all(
      items.map(({ attachment, ocr }) =>
        ocr ? Promise.resolve(ocr) : ocrInvoice(attachment.content, attachment.contentType, langHint)
      )
    )
    mailDebugLog(`[PROCESS] OCR completato per "${fornitore.nome}" (matched_by=${matchedBy}): numeri fattura=[${ocrResults.map(r => r.numero_fattura ?? 'null').join(', ')}] totali=[${ocrResults.map(r => r.totale_iva_inclusa ?? 'null').join(', ')}]`)

    for (let i = 0; i < items.length; i++) {
      const { email, attachment } = items[i]
      const ocr = ocrResults[i]

      mailDebugLog(`[PROCESS] Upload allegato "${attachment.filename}" (${attachment.contentType}) per "${fornitore.nome}"`)
      const uniqueName = `email_auto_${crypto.randomUUID()}.${attachment.extension}`
      const { error: uploadError } = await supabase.storage
        .from('documenti')
        .upload(uniqueName, attachment.content, { contentType: attachment.contentType, upsert: false })

      if (uploadError) {
        console.error(`[PROCESS] ❌ Upload fallito: ${uploadError.message}`)
        await insertLog(supabase, email, 'fornitore_non_trovato', {
          fornitore_id: fornitore.id,
          errore_dettaglio: `Errore upload allegato: ${uploadError.message}`,
        })
        continue
      }

      const { data: publicUrlData } = supabase.storage.from('documenti').getPublicUrl(uniqueName)
      const file_url = publicUrlData.publicUrl
      mailDebugLog(`[PROCESS] Upload OK → ${file_url}`)

      // sede_id: priorità esplicita → sedeFilter (scansione corrente) > sede del fornitore > fallback
      const documentSedeId = sedeFilter ?? fornitore.sede_id ?? fallbackSedeId ?? effectiveSede ?? null

      // ── AUTO-CREAZIONE BOZZA ───────────────────────────────────────────────
      // Tenta di creare automaticamente una Bolla o Fattura in stato 'bozza'
      // basandosi sui dati OCR estratti. Il documento rimane in "Documenti da
      // Elaborare" per la conferma finale dell'utente.
      let bozzaId: string | null = null
      let bozzaTipo: 'bolla' | 'fattura' | null = null

      if (fornitore.id && documentSedeId) {
        const dataDoc = safeDate(ocr.data_fattura) ?? new Date().toISOString().slice(0, 10)
        const hasFattura = !!(ocr.numero_fattura && ocr.numero_fattura.trim())

        if (hasFattura) {
          // Ha numero fattura → creiamo una Fattura bozza
          const { data: newFattura, error: fatturaErr } = await supabase
            .from('fatture')
            .insert([{
              fornitore_id:             fornitore.id,
              sede_id:                  documentSedeId,
              data:                     dataDoc,
              numero_fattura:           ocr.numero_fattura,
              importo:                  ocr.totale_iva_inclusa ?? null,
              verificata_estratto_conto: false,
              file_url,
            }])
            .select('id')
            .single()

          if (fatturaErr) {
            console.warn(`[BOZZA] Fattura bozza non creata per "${fornitore.nome}": ${fatturaErr.message}`)
          } else if (newFattura) {
            bozzaId = newFattura.id
            bozzaTipo = 'fattura'
            bozzaCreate++
            mailDebugLog(`[BOZZA] ✅ Fattura bozza creata: id=${bozzaId} n.fattura=${ocr.numero_fattura}`)
          }
        } else {
          // Nessun numero fattura → creiamo una Bolla bozza
          const { data: newBolla, error: bollaErr } = await supabase
            .from('bolle')
            .insert([{
              fornitore_id:  fornitore.id,
              sede_id:       documentSedeId,
              data:          dataDoc,
              numero_bolla:  null,
              importo:       ocr.totale_iva_inclusa ?? null,
              stato:         'bozza',
              file_url,
            }])
            .select('id')
            .single()

          if (bollaErr) {
            console.warn(`[BOZZA] Bolla bozza non creata per "${fornitore.nome}": ${bollaErr.message}`)
          } else if (newBolla) {
            bozzaId = newBolla.id
            bozzaTipo = 'bolla'
            bozzaCreate++
            mailDebugLog(`[BOZZA] ✅ Bolla bozza creata: id=${bozzaId} importo=${ocr.totale_iva_inclusa ?? '—'}`)
          }
        }
      }

      const metadata = {
        ...buildMetadata(ocr, matchedBy),
        // Riferimento alla bozza creata automaticamente
        ...(bozzaId ? { bozza_id: bozzaId, bozza_tipo: bozzaTipo } : {}),
      }

      // Detect statement emails: mark with is_statement = true
      const subjectLower  = (email.subject ?? '').toLowerCase()
      const isStatementEmail = subjectLower.includes('statement') || subjectLower.includes('estratto conto') || subjectLower.includes('account statement')

      const knownPayload = {
        fornitore_id:   fornitore.id,
        sede_id:        documentSedeId,
        mittente:       email.from || 'sconosciuto',
        oggetto_mail:   email.subject ?? null,
        file_url,
        file_name:      attachment.filename ?? null,
        content_type:   attachment.contentType ?? null,
        data_documento: safeDate(ocr.data_fattura),
        stato:          isStatementEmail ? 'associato' : (bozzaId ? 'bozza_creata' : 'da_associare'),
        is_statement:   isStatementEmail,
        metadata,
      }

      const insertError = await insertDocumento(supabase, knownPayload)

      if (insertError) {
        const detail = `[${insertError.code ?? 'ERR'}] ${insertError.message}${insertError.details ? ' | ' + insertError.details : ''}`
        console.error(`[PROCESS] ❌ Insert FALLITO per "${fornitore.nome}": ${detail}`)
        await insertLog(supabase, email, 'fornitore_non_trovato', {
          fornitore_id: fornitore.id,
          file_url,
          errore_dettaglio: detail,
        })
        continue
      }

      // ── AUTO-PROCESS STATEMENT EMAILS ──────────────────────────────────
      if (isStatementEmail) {
        mailDebugLog(`[PROCESS] 📋 Statement email rilevata per "${fornitore.nome}" — avvio parsing automatico righe`)
        // Fire-and-forget in background (don't block the main loop)
        processStatementInBackground(supabase, {
          fornitoreId: fornitore.id,
          sedeId:      documentSedeId,
          fileUrl:     file_url,
          subject:     email.subject ?? null,
          buffer:      attachment.content,
          contentType: attachment.contentType,
        }).catch(err => console.error('[STMT] Errore background processing:', err))
      } else {
        mailDebugLog(`[PROCESS] ✅ Documento salvato per "${fornitore.nome}" | stato=${bozzaId ? 'bozza_creata' : 'da_associare'} | bozza_tipo=${bozzaTipo ?? 'nessuna'} | sede=${documentSedeId ?? 'NULL'}`)
      }

      await insertLog(supabase, email, 'successo', { fornitore_id: fornitore.id, file_url })

      ricevuti++
      if (!uidsToMarkRead.includes(email.uid)) uidsToMarkRead.push(email.uid)

      if (
        !rekkiPersistedUids.has(email.uid) &&
        email.bodyText &&
        isLikelyRekkiEmail(email.subject, email.from, email.bodyText)
      ) {
        const rkLines = parseRekkiFromEmailParts({ subject: email.subject, text: email.bodyText })
        if (rkLines.length) {
          rekkiPersistedUids.add(email.uid)
          persistRekkiOrderStatement(supabase, {
            fornitoreId: fornitore.id,
            sedeId: documentSedeId,
            rekkiLines: rkLines,
            emailSubject: email.subject ?? `Rekki — ${fornitore.nome}`,
            fileUrl: file_url,
          }).catch((err) => console.error('[REKKI] persist fallito:', err))
        }
      }
    }
  }

  mailDebugLog(`[PROCESS] Fine processEmails: ricevuti=${ricevuti} ignorate=${ignorate} bozzeCreate=${bozzaCreate}`)
  return { ricevuti, ignorate, bozzaCreate, toMarkRead: uidsToMarkRead }
}

/**
 * Parse a statement attachment, save rows to the `statements` + `statement_rows`
 * tables, then run a triple-check on each row.
 *
 * Called in a fire-and-forget manner so it doesn't block the email scan loop.
 */
async function processStatementInBackground(
  supabase: SupabaseClient,
  opts: {
    fornitoreId: string
    sedeId:      string | null
    fileUrl:     string
    subject:     string | null
    buffer:      Buffer | Uint8Array
    contentType: string
  }
) {
  const { fornitoreId, sedeId, fileUrl, subject, buffer, contentType } = opts

  // 1️⃣ Create the statement record (status = processing)
  const { data: stmtRow, error: stmtErr } = await supabase
    .from('statements')
    .insert([{
      sede_id:       sedeId,
      fornitore_id:  fornitoreId,
      email_subject: subject,
      file_url:      fileUrl,
      status:        'processing',
      total_rows:    0,
      missing_rows:  0,
    }])
    .select('id')
    .single()

  if (stmtErr || !stmtRow) {
    console.error('[STMT] Errore creazione statement record:', stmtErr?.message)
    // Table might not exist yet — silently skip
    return
  }

  const statementId = stmtRow.id
  mailDebugLog(`[STMT] Statement record creato: ${statementId}`)

  // 2️⃣ OCR — parse statement rows
  const rows = await ocrStatement(buffer, contentType)

  if (!rows.length) {
    console.warn(`[STMT] Nessuna riga estratta dal PDF per statement ${statementId}`)
    await supabase.from('statements').update({ status: 'error', total_rows: 0 }).eq('id', statementId)
    return
  }

  mailDebugLog(`[STMT] ${rows.length} righe estratte — avvio triple-check`)

  // 3️⃣ Run triple-check
  const { results } = await runTripleCheck(supabase, rows, sedeId, fornitoreId)

  // 4️⃣ Save statement_rows
  const rowInserts = results.map(r => ({
    statement_id:   statementId,
    numero_doc:     r.numero,
    importo:        r.importoStatement,
    data_doc:       rows.find(row => row.numero === r.numero)?.data ?? null,
    check_status:   r.status,
    delta_importo:  r.deltaImporto,
    fattura_id:     r.fattura?.id ?? null,
    fattura_numero: r.fattura?.numero_fattura ?? null,
    fornitore_id:   r.fornitore?.id ?? fornitoreId,
    bolle_json:     r.bolle.length ? r.bolle : null,
  }))

  const { error: rowsErr } = await supabase.from('statement_rows').insert(rowInserts)
  if (rowsErr) {
    console.error('[STMT] Errore insert statement_rows:', rowsErr.message)
    await supabase.from('statements').update({ status: 'error' }).eq('id', statementId)
    return
  }

  // 5️⃣ Update statement record with counts
  const missingRows = results.filter(r => r.status !== 'ok').length
  await supabase.from('statements').update({
    status:      'done',
    total_rows:  results.length,
    missing_rows: missingRows,
  }).eq('id', statementId)

  mailDebugLog(`[STMT] ✅ Statement ${statementId} completato: ${results.length} righe, ${missingRows} anomalie`)
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET non configurato' }, { status: 500 })

  // Vercel Cron invia automaticamente: Authorization: Bearer <CRON_SECRET>
  // Il trigger manuale può usare: ?secret=<CRON_SECRET>
  const authHeader = (req as Request & { headers: Headers }).headers.get('authorization')
  const bearerValid = authHeader === `Bearer ${secret}`
  const { searchParams } = new URL(req.url)
  const queryValid = searchParams.get('secret') === secret

  if (!bearerValid && !queryValid) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  return runScan()
}

function imapErrorMessage(err: unknown, nome: string): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return `Sede "${nome}": host IMAP non raggiungibile. Verifica le impostazioni IMAP in Sedi.`
  }
  if (msg.includes('ECONNREFUSED')) {
    return `Sede "${nome}": connessione IMAP rifiutata. Controlla host e porta.`
  }
  if (msg.includes('auth') || msg.includes('LOGIN') || msg.includes('AUTHENTICATE')) {
    return `Sede "${nome}": credenziali IMAP errate.`
  }
  return `Sede "${nome}": ${msg}`
}

export async function POST(req: Request) {
  let userSedeId: string | undefined
  let filterSedeId: string | undefined
  try {
    const body = await req.json() as { user_sede_id?: string; filter_sede_id?: string }
    userSedeId = body?.user_sede_id ?? undefined
    // filter_sede_id: restrict the IMAP scan to one specific branch only
    filterSedeId = body?.filter_sede_id ?? undefined
  } catch { /* no body or invalid JSON — ignore */ }
  return runScan(userSedeId, filterSedeId)
}

async function runScan(userSedeId?: string, filterSedeId?: string) {
  try {
    const supabase = createServiceClient()

    // ── Verifica variabili d'ambiente globali ──────────────────────────────
    const hasGlobalImap = !!(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD)
    if (!hasGlobalImap) {
      console.warn('[ENV] Casella IMAP globale non configurata (IMAP_HOST/IMAP_USER/IMAP_PASSWORD mancanti)')
    }

    let totalRicevuti = 0
    let totalIgnorate = 0
    let totalBozzeCreate = 0
    const avvisi: string[] = []

    // ── Sede di fallback (usata solo per global IMAP senza sedeFilter) ────────
    // Priorità: 1) sede dell'utente che ha avviato la sync  2) prima sede nel DB
    let systemFallbackSedeId: string | undefined = userSedeId
    if (!systemFallbackSedeId) {
      const { data: firstSede } = await supabase.from('sedi').select('id').limit(1).single()
      systemFallbackSedeId = firstSede?.id ?? undefined
    }
    mailDebugLog(`[POST] sede fallback: ${systemFallbackSedeId ?? 'NESSUNA'} (origine: ${userSedeId ? 'utente' : 'prima sede DB'})`)

    // ── Sedi con IMAP configurato ─────────────────────────────────────────
    let sediQuery = supabase
      .from('sedi')
      .select('id, nome, imap_host, imap_port, imap_user, imap_password, imap_lookback_days')
      .not('imap_host', 'is', null)
      .not('imap_user', 'is', null)
      .not('imap_password', 'is', null)

    // When a specific branch is requested, restrict to that branch only
    if (filterSedeId) {
      sediQuery = sediQuery.eq('id', filterSedeId) as typeof sediQuery
      mailDebugLog(`[POST] filter_sede_id=${filterSedeId} — scansione limitata a questa sede`)
    }

    const { data: sedi, error: sediErr } = await sediQuery

    mailDebugLog(`[DB] Sedi con IMAP: ${sedi?.length ?? 0}${sediErr ? ` errore="${sediErr.message}"` : ''}`)
    if (sedi) {
      sedi.forEach(s => mailDebugLog(`[DB]   → sede "${s.nome}" porta=${s.imap_port ?? 993}`))
    }

    if (sedi && sedi.length > 0) {
      for (const sede of sedi) {
        mailDebugLog(`\n[SEDE] ══ Inizio scansione sede "${sede.nome}" (${sede.id}) ══`)
        try {
          const emails = await fetchFromImap(sede.imap_host, sede.imap_port ?? 993, sede.imap_user, sede.imap_password, sede.imap_lookback_days)
          mailDebugLog(`[SEDE] "${sede.nome}": ${emails.length} email con allegati trovate`)
          if (emails.length === 0) { mailDebugLog(`[SEDE] Nessuna email — salto`); continue }
          const { ricevuti, ignorate, bozzaCreate, toMarkRead } = await processEmails(supabase, emails, sede.id)
          totalRicevuti += ricevuti
          totalIgnorate += ignorate
          totalBozzeCreate += bozzaCreate
          if (toMarkRead.length > 0) {
            mailDebugLog(`[SEDE] Segno come lette ${toMarkRead.length} email`)
            await markReadOnImap(sede.imap_host, sede.imap_port ?? 993, sede.imap_user, sede.imap_password, toMarkRead as number[])
          }
        } catch (err) {
          const avviso = imapErrorMessage(err, sede.nome)
          console.error(`[SEDE] ❌ Errore sede "${sede.nome}":`, err)
          avvisi.push(avviso)
        }
      }
    }

    // Skip global IMAP when scoped to a specific branch
    if (!filterSedeId && process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
      mailDebugLog('\n[GLOBALE] ══ Inizio scansione casella globale ══')
      try {
        const emails = await fetchUnseenEmails()
        mailDebugLog(`[GLOBALE] Email trovate: ${emails.length}`)
        if (emails.length > 0) {
          const { ricevuti, ignorate, bozzaCreate, toMarkRead } = await processEmails(supabase, emails, undefined, systemFallbackSedeId)
          totalRicevuti += ricevuti
          totalIgnorate += ignorate
          totalBozzeCreate += bozzaCreate
          await markEmailsAsRead(toMarkRead)
        }
      } catch (err) {
        console.error('[GLOBALE] ❌ Errore casella globale:', err)
        avvisi.push(imapErrorMessage(err, 'casella globale'))
      }
    } else {
      mailDebugLog('[GLOBALE] Casella globale non configurata — salto')
    }

    mailDebugLog(`\n[FINE] totale ricevuti=${totalRicevuti} ignorate=${totalIgnorate} bozzeCreate=${totalBozzeCreate} avvisi=${avvisi.length}`)

    if (avvisi.length > 0 && totalRicevuti === 0 && totalIgnorate === 0) {
      return NextResponse.json({ ricevuti: 0, ignorate: 0, bozzeCreate: 0, avvisi, messaggio: avvisi[0] })
    }

    let messaggio: string
    if (totalRicevuti === 0) {
      messaggio = 'Nessuna nuova email con allegati.'
    } else if (totalBozzeCreate > 0) {
      messaggio = `${totalRicevuti} ${totalRicevuti === 1 ? 'documento ricevuto' : 'documenti ricevuti'} — ${totalBozzeCreate} ${totalBozzeCreate === 1 ? 'bozza creata automaticamente' : 'bozze create automaticamente'}. Controlla in Statements → Documenti da Elaborare.`
    } else {
      messaggio = `${totalRicevuti} ${totalRicevuti === 1 ? 'documento ricevuto' : 'documenti ricevuti'} — salvati in Documenti da Elaborare per la revisione.`
    }

    return NextResponse.json({
      ricevuti: totalRicevuti,
      ignorate: totalIgnorate,
      bozzeCreate: totalBozzeCreate,
      messaggio,
      ...(avvisi.length > 0 && { avvisi }),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[FATAL] Errore inatteso in scan-emails:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
