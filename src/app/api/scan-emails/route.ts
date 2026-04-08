import { NextResponse } from 'next/server'
import { fetchUnseenEmails, markEmailsAsRead, ScannedEmail } from '@/lib/mail-scanner'
import { createClient } from '@/utils/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

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
async function fetchFromImap(host: string, port: number, user: string, password: string): Promise<ScannedEmail[]> {
  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass: password },
    logger: false,
  })

  await client.connect()
  const emails: ScannedEmail[] = []

  try {
    await client.mailboxOpen('INBOX')
    for await (const msg of client.fetch({ seen: false }, { envelope: true, source: true })) {
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

      emails.push({
        uid: msg.uid,
        from: parsed.from?.value?.[0]?.address ?? '',
        subject: parsed.subject ?? null,
        attachments,
      })
    }
  } finally {
    await client.logout()
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

async function processEmails(
  supabase: SupabaseClient,
  emails: ScannedEmail[],
  sedeFilter?: string
): Promise<{ associate: number; ignorate: number; toMarkRead: number[] }> {
  const uidsToMarkRead: number[] = []
  let associate = 0
  let ignorate = 0

  for (const email of emails) {
    const fornitoriQuery = supabase
      .from('fornitori')
      .select('id, nome, sede_id')
      .ilike('email', email.from)
      .limit(1)

    if (sedeFilter) fornitoriQuery.eq('sede_id', sedeFilter)

    const { data: fornitori } = await fornitoriQuery

    if (!fornitori || fornitori.length === 0) {
      await insertLog(supabase, email, 'fornitore_non_trovato', {
        errore_dettaglio: `Nessun fornitore trovato con email "${email.from}"`,
      })
      ignorate++
      continue
    }

    const fornitore = fornitori[0]
    let emailAssociated = false

    for (const attachment of email.attachments) {
      const uniqueName = `email_auto_${crypto.randomUUID()}.${attachment.extension}`

      const { error: uploadError } = await supabase.storage
        .from('documenti')
        .upload(uniqueName, attachment.content, { contentType: attachment.contentType, upsert: false })

      if (uploadError) {
        await insertLog(supabase, email, 'bolla_non_trovata', {
          fornitore_id: fornitore.id,
          errore_dettaglio: `Errore upload file: ${uploadError.message}`,
        })
        continue
      }

      const { data: publicUrlData } = supabase.storage.from('documenti').getPublicUrl(uniqueName)
      const file_url = publicUrlData.publicUrl

      const { data: bolle } = await supabase
        .from('bolle')
        .select('id')
        .eq('fornitore_id', fornitore.id)
        .eq('stato', 'in attesa')
        .order('data', { ascending: true })
        .limit(1)

      if (!bolle || bolle.length === 0) {
        await insertLog(supabase, email, 'bolla_non_trovata', {
          fornitore_id: fornitore.id,
          file_url,
          errore_dettaglio: `Nessuna bolla "in attesa" trovata per ${fornitore.nome}`,
        })
        emailAssociated = true
        continue
      }

      const bollaId = bolle[0].id
      const oggi = new Date().toISOString().split('T')[0]

      const { error: insertError } = await supabase.from('fatture').insert([{
        fornitore_id: fornitore.id,
        bolla_id: bollaId,
        sede_id: fornitore.sede_id ?? null,
        data: oggi,
        file_url,
      }])

      if (insertError) {
        await insertLog(supabase, email, 'bolla_non_trovata', {
          fornitore_id: fornitore.id,
          file_url,
          errore_dettaglio: `Errore inserimento fattura: ${insertError.message}`,
        })
        continue
      }

      await supabase.from('bolle').update({ stato: 'completato' }).eq('id', bollaId)
      await insertLog(supabase, email, 'successo', { fornitore_id: fornitore.id, file_url })

      associate++
      emailAssociated = true
    }

    if (emailAssociated) uidsToMarkRead.push(email.uid)
  }

  return { associate, ignorate, toMarkRead: uidsToMarkRead }
}

export async function POST() {
  try {
    const supabase = await createClient()
    let totalAssociate = 0
    let totalIgnorate = 0

    // ── Scansiona tutte le sedi con IMAP configurato ──────────────────────
    const { data: sedi } = await supabase
      .from('sedi')
      .select('id, nome, imap_host, imap_port, imap_user, imap_password')
      .not('imap_host', 'is', null)
      .not('imap_user', 'is', null)
      .not('imap_password', 'is', null)

    if (sedi && sedi.length > 0) {
      for (const sede of sedi) {
        try {
          const emails = await fetchFromImap(
            sede.imap_host,
            sede.imap_port ?? 993,
            sede.imap_user,
            sede.imap_password
          )
          if (emails.length === 0) continue

          const { associate, ignorate, toMarkRead } = await processEmails(supabase, emails, sede.id)
          totalAssociate += associate
          totalIgnorate += ignorate

          if (toMarkRead.length > 0) {
            await markReadOnImap(sede.imap_host, sede.imap_port ?? 993, sede.imap_user, sede.imap_password, toMarkRead)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Errore sconosciuto'
          console.error(`Errore IMAP sede "${sede.nome}":`, msg)
        }
      }
    }

    // ── Fallback: casella globale da env vars (se configurata) ────────────
    if (process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
      const emails = await fetchUnseenEmails()
      if (emails.length > 0) {
        const { associate, ignorate, toMarkRead } = await processEmails(supabase, emails)
        totalAssociate += associate
        totalIgnorate += ignorate
        await markEmailsAsRead(toMarkRead)
      }
    }

    if (totalAssociate === 0 && totalIgnorate === 0) {
      return NextResponse.json({ associate: 0, ignorate: 0, messaggio: 'Nessuna nuova email con allegati.' })
    }

    return NextResponse.json({
      associate: totalAssociate,
      ignorate: totalIgnorate,
      messaggio: totalAssociate > 0
        ? `Sincronizzazione completata: ${totalAssociate} ${totalAssociate === 1 ? 'fattura associata' : 'fatture associate'}.`
        : 'Nessuna fattura associata. Controlla i log per i dettagli.',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
