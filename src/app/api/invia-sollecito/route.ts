/**
 * POST /api/invia-sollecito
 *
 * Sends a solicitation email to a supplier for a missing document identified
 * during the triple-check of a statement.
 *
 * Language is auto-detected from the sede's country_code:
 *   UK/GB → English · IT → Italian · FR → French · DE → German · ES → Spanish
 *
 * Body:
 *   fornitore_id   — supplier UUID
 *   numero_doc     — document number from the statement
 *   importo        — expected amount
 *   tipo           — 'fattura' | 'bolle'
 *   data_doc       — optional: transaction date from the statement
 *   sede_id        — optional: branch UUID (used to detect language + reply-to)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { Resend } from 'resend'
import { localeFromCountryCode, type Locale } from '@/lib/translations'

type Lang = Locale

function fmtDate(d: string | undefined | null, locale: string) {
  if (!d) return null
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d))
  } catch { return d }
}

const LOCALE_MAP: Record<Lang, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

function buildEmail(opts: {
  tipo:     'fattura' | 'bolle'
  fornNome: string
  numeroDot: string
  importo:  number
  currency: string
  dataDoc:  string | null
  sedeName: string
  lang:     Lang
}) {
  const { tipo, fornNome, numeroDot, importo, currency, dataDoc, sedeName, lang } = opts
  const intlLocale = LOCALE_MAP[lang] ?? 'en-GB'
  // Format amount with proper locale separators and currency symbol
  let amountStr: string
  try {
    amountStr = new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).format(importo)
  } catch {
    amountStr = `${currency} ${importo.toFixed(2)}`
  }
  const dateFmt    = dataDoc ? fmtDate(dataDoc, intlLocale) : null

  if (lang === 'en') {
    const dateClause = dateFmt ? ` on <strong>${dateFmt}</strong>` : ''
    if (tipo === 'fattura') return {
      subject: `Missing Invoice – ${numeroDot} (${amountStr})`,
      html: `<p>Dear ${fornNome},</p><p>While reviewing our monthly account statement, we noticed that the following invoice is not yet recorded in our system:</p><ul><li><strong>Document reference:</strong> ${numeroDot}</li><li><strong>Amount:</strong> ${amountStr}</li>${dateFmt ? `<li><strong>Transaction date:</strong> ${dateFmt}</li>` : ''}</ul><p>Could you please send us a copy of this invoice at your earliest convenience so we can complete our reconciliation?</p><p>Thank you for your cooperation.</p><br><p>Kind regards,<br>${sedeName}</p>`,
      text:  `Dear ${fornNome},\n\nWe noticed invoice ${numeroDot} (${amountStr}${dateFmt ? ' on ' + dateFmt : ''}) is missing from our records.\n\nPlease send us a copy.\n\nThank you.\n\n${sedeName}`,
    }
    return {
      subject: `Missing Delivery Notes – ${numeroDot} (${amountStr})`,
      html: `<p>Dear ${fornNome},</p><p>We have invoice <strong>${numeroDot}</strong> (${amountStr}${dateClause}) but are missing the associated delivery notes (DDT/GRN).</p><p>Could you please provide the delivery documentation at your earliest convenience?</p><p>Thank you.</p><br><p>Kind regards,<br>${sedeName}</p>`,
      text:  `Dear ${fornNome},\n\nInvoice ${numeroDot} (${amountStr}) is present but delivery notes are missing. Please send documentation.\n\n${sedeName}`,
    }
  }

  if (lang === 'fr') {
    const dateClause = dateFmt ? ` du <strong>${dateFmt}</strong>` : ''
    if (tipo === 'fattura') return {
      subject: `Facture manquante – ${numeroDot} (${amountStr})`,
      html: `<p>Madame, Monsieur ${fornNome},</p><p>Lors de la vérification de notre relevé de compte mensuel, nous avons constaté que la facture suivante n'est pas encore enregistrée dans notre système :</p><ul><li><strong>Référence :</strong> ${numeroDot}</li><li><strong>Montant :</strong> ${amountStr}</li>${dateFmt ? `<li><strong>Date :</strong> ${dateFmt}</li>` : ''}</ul><p>Pourriez-vous nous envoyer une copie de cette facture dès que possible afin de clôturer notre rapprochement comptable ?</p><p>Nous vous remercions de votre coopération.</p><br><p>Cordialement,<br>${sedeName}</p>`,
      text:  `Madame, Monsieur ${fornNome},\n\nNous n'avons pas encore reçu la facture ${numeroDot} (${amountStr}${dateFmt ? ', datée du ' + dateFmt : ''}).\n\nMerci de nous en envoyer une copie.\n\nCordialement,\n${sedeName}`,
    }
    return {
      subject: `Bons de livraison manquants – ${numeroDot} (${amountStr})`,
      html: `<p>Madame, Monsieur ${fornNome},</p><p>La facture <strong>${numeroDot}</strong> (${amountStr}${dateClause}) est bien enregistrée dans notre système, mais les bons de livraison associés sont manquants.</p><p>Pourriez-vous nous faire parvenir la documentation de livraison ?</p><p>Merci.</p><br><p>Cordialement,<br>${sedeName}</p>`,
      text:  `Madame, Monsieur ${fornNome},\n\nLa facture ${numeroDot} (${amountStr}) est présente mais les BL associés manquent. Merci de nous les envoyer.\n\n${sedeName}`,
    }
  }

  if (lang === 'de') {
    const dateClause = dateFmt ? ` vom <strong>${dateFmt}</strong>` : ''
    if (tipo === 'fattura') return {
      subject: `Fehlende Rechnung – ${numeroDot} (${amountStr})`,
      html: `<p>Sehr geehrte Damen und Herren,</p><p>im Rahmen der Kontenabstimmung mit <strong>${fornNome}</strong> fehlt uns noch die nachstehende Rechnung in unserem System:</p><ul><li><strong>Referenz:</strong> ${numeroDot}</li><li><strong>Betrag:</strong> ${amountStr}</li>${dateFmt ? `<li><strong>Datum:</strong> ${dateFmt}</li>` : ''}</ul><p>Bitte übersenden Sie uns eine Kopie dieser Rechnung zeitnah, damit wir unsere Buchhaltung abschließen können.</p><p>Vielen Dank für Ihre Unterstützung.</p><br><p>Mit freundlichen Grüßen,<br>${sedeName}</p>`,
      text:  `Sehr geehrte Damen und Herren,\n\nim Geschäftsverkehr mit ${fornNome} fehlt uns die Rechnung ${numeroDot} (${amountStr}${dateFmt ? ', Datum ' + dateFmt : ''}). Bitte senden Sie uns eine Kopie.\n\nMit freundlichen Grüßen,\n${sedeName}`,
    }
    return {
      subject: `Fehlende Lieferscheine – ${numeroDot} (${amountStr})`,
      html: `<p>Sehr geehrte Damen und Herren,</p><p>zu der von <strong>${fornNome}</strong> ausgestellten Rechnung <strong>${numeroDot}</strong> (${amountStr}${dateClause}) liegen uns die zugehörigen Lieferscheine noch nicht vor.</p><p>Bitte übersenden Sie uns die fehlenden Lieferbelege zeitnah.</p><p>Vielen Dank.</p><br><p>Mit freundlichen Grüßen,<br>${sedeName}</p>`,
      text:  `Sehr geehrte Damen und Herren,\n\nRechnung ${numeroDot} (${amountStr}) ist vorhanden, aber Lieferscheine fehlen. Bitte zusenden.\n\n${sedeName}`,
    }
  }

  if (lang === 'es') {
    const dateClause = dateFmt ? ` del <strong>${dateFmt}</strong>` : ''
    if (tipo === 'fattura') return {
      subject: `Factura faltante – ${numeroDot} (${amountStr})`,
      html: `<p>Estimado/a ${fornNome},</p><p>Al revisar nuestro extracto de cuenta mensual, hemos detectado que la siguiente factura no está registrada en nuestro sistema:</p><ul><li><strong>Referencia:</strong> ${numeroDot}</li><li><strong>Importe:</strong> ${amountStr}</li>${dateFmt ? `<li><strong>Fecha:</strong> ${dateFmt}</li>` : ''}</ul><p>¿Podría enviarnos una copia de esta factura a la mayor brevedad posible para completar nuestra conciliación?</p><p>Gracias por su colaboración.</p><br><p>Atentamente,<br>${sedeName}</p>`,
      text:  `Estimado/a ${fornNome},\n\nNo hemos recibido la factura ${numeroDot} (${amountStr}${dateFmt ? ' del ' + dateFmt : ''}). Agradecemos nos la envíen.\n\nAtentamente,\n${sedeName}`,
    }
    return {
      subject: `Albaranes faltantes – ${numeroDot} (${amountStr})`,
      html: `<p>Estimado/a ${fornNome},</p><p>La factura <strong>${numeroDot}</strong> (${amountStr}${dateClause}) está registrada en nuestro sistema, pero faltan los albaranes de entrega asociados.</p><p>¿Podría enviarnos la documentación correspondiente?</p><p>Gracias.</p><br><p>Atentamente,<br>${sedeName}</p>`,
      text:  `Estimado/a ${fornNome},\n\nLa factura ${numeroDot} (${amountStr}) está presente pero faltan albaranes. Por favor envíelos.\n\n${sedeName}`,
    }
  }

  // Italian fallback
  const dateClause = dateFmt ? ` del <strong>${dateFmt}</strong>` : ''
  if (tipo === 'fattura') return {
    subject: `Richiesta documento: Fattura ${numeroDot} (${amountStr})`,
    html: `<p>Gentile ${fornNome},</p><p>Durante la verifica del nostro estratto conto mensile abbiamo rilevato che nel nostro sistema non risulta registrata la seguente fattura:</p><ul><li><strong>Riferimento documento:</strong> ${numeroDot}</li><li><strong>Importo atteso:</strong> ${amountStr}</li>${dateFmt ? `<li><strong>Data transazione:</strong> ${dateFmt}</li>` : ''}</ul><p>Vi chiediamo gentilmente di inviarci copia della fattura al più presto per completare la riconciliazione del periodo.</p><p>Grazie per la collaborazione.</p><br><p>Cordiali saluti,<br>${sedeName}</p>`,
    text:  `Gentile ${fornNome},\n\nNon abbiamo trovato la fattura ${numeroDot} (${amountStr}${dateFmt ? ' del ' + dateFmt : ''}). Siete pregati di inviarci copia.\n\nGrazie.\n\n${sedeName}`,
  }
  return {
    subject: `Richiesta documenti di consegna: ${numeroDot} (${amountStr})`,
    html: `<p>Gentile ${fornNome},</p><p>La fattura <strong>${numeroDot}</strong> (${amountStr}${dateClause}) è presente nel nostro sistema, tuttavia non risultano ancora registrate le relative bolle di consegna (DDT).</p><p>Vi chiediamo gentilmente di fornirci la documentazione di consegna associata al più presto.</p><p>Grazie per la collaborazione.</p><br><p>Cordiali saluti,<br>${sedeName}</p>`,
    text:  `Gentile ${fornNome},\n\nLa fattura ${numeroDot} (${amountStr}) è presente, ma mancano le bolle di consegna associate.\n\nGrazie.\n\n${sedeName}`,
  }
}

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json() as {
    fornitore_id:  string
    numero_doc:    string
    importo:       number
    tipo:          'fattura' | 'bolle'
    data_doc?:     string | null
    sede_id?:      string | null
    currency?:     string
  }

  const { fornitore_id, numero_doc, importo, tipo, data_doc, sede_id, currency: currencyParam } = body
  if (!fornitore_id || !numero_doc) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: fornitore, error: fErr } = await supabase
    .from('fornitori')
    .select('id, nome, email, language')
    .eq('id', fornitore_id)
    .single()

  if (fErr || !fornitore) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  if (!fornitore.email)   return NextResponse.json({
    error: `Supplier "${fornitore.nome}" has no email configured. Add one on the supplier page.`,
  }, { status: 422 })

  // ── Detect language + currency ────────────────────────────────────────
  // Priority: 1) supplier's own language, 2) sede country_code, 3) 'en'
  let sedeNome    = 'FLUXO'
  let sedeReplyTo = 'noreply@resend.dev'
  let sedeLang: Lang = 'en'
  let currency    = currencyParam ?? 'EUR'

  if (sede_id) {
    const { data: sede } = await supabase
      .from('sedi')
      .select('nome, imap_user, country_code, currency')
      .eq('id', sede_id)
      .single()

    if (sede) {
      sedeNome    = sede.nome
      sedeLang    = localeFromCountryCode(sede.country_code)
      // Use DB currency field if available, otherwise fall back to passed param or 'EUR'
      currency    = sede.currency ?? currencyParam ?? 'EUR'
      if (sede.imap_user) sedeReplyTo = sede.imap_user
    }
  }

  // Supplier language takes priority over sede language
  const lang: Lang = (fornitore.language as Lang | null) ?? sedeLang

  const { subject, html, text } = buildEmail({
    tipo, fornNome: fornitore.nome, numeroDot: numero_doc,
    importo, currency, dataDoc: data_doc ?? null,
    sedeName: sedeNome, lang,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailErr } = await resend.emails.send({
    from:    'FLUXO <onboarding@resend.dev>',
    replyTo: sedeReplyTo !== 'noreply@resend.dev' ? sedeReplyTo : undefined,
    to:      [fornitore.email],
    subject,
    html,
    text,
  })

  if (emailErr) {
    console.error('[invia-sollecito] Resend error:', emailErr)
    return NextResponse.json({ error: `Send error: ${(emailErr as { message?: string }).message ?? 'unknown'}` }, { status: 500 })
  }

  const sentAt = new Date().toISOString()

  try {
    await supabase.from('log_sincronizzazione').insert([{
      mittente:         sedeReplyTo,
      oggetto_mail:     `[SOLLECITO] ${subject}`,
      stato:            'successo',
      fornitore_id,
      file_url:         null,
      errore_dettaglio: null,
    }])
  } catch (logErr) {
    console.warn('[invia-sollecito] Log insert failed (non-critical):', logErr)
  }

  return NextResponse.json({
    ok:           true,
    destinatario: fornitore.email,
    reply_to:     sedeReplyTo,
    language:     lang,
    sent_at:      sentAt,
  })
}

/** GET /api/invia-sollecito?fornitore_id=xxx — returns recent solleciti for a supplier */
export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fornitoreId = searchParams.get('fornitore_id')

  const supabase = createServiceClient()
  let q = supabase
    .from('log_sincronizzazione')
    .select('id, data, oggetto_mail, fornitore_id')
    .ilike('oggetto_mail', '[SOLLECITO]%')
    .order('data', { ascending: false })
    .limit(100)

  if (fornitoreId) q = q.eq('fornitore_id', fornitoreId) as typeof q

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const logs = (data ?? []).map(l => {
    const match = l.oggetto_mail?.match(/\[SOLLECITO\].*?[–-]\s+([^\s(]+)/)
    return {
      id:           l.id,
      fornitore_id: l.fornitore_id,
      sent_at:      l.data,
      numero_doc:   match?.[1] ?? null,
      oggetto:      l.oggetto_mail,
    }
  })

  return NextResponse.json(logs)
}
