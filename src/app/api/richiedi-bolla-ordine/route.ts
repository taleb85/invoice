/**
 * POST /api/richiedi-bolla-ordine
 * Dopo una consegna registrata senza DDT: email al fornitore per chiedere
 * copia dell’ordine e della bolla di consegna relativi ai beni descritti.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'
import { Resend } from 'resend'
import { localeFromCountryCode, type Locale } from '@/lib/translations'

type Lang = Locale

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function descrizioneHtmlBlock(text: string) {
  const safe = escapeHtml(text.trim())
  const withBr = safe.replace(/\r\n|\n|\r/g, '<br/>')
  return `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #06b6d4;background:#0f172a;color:#e2e8f0;font-size:14px">${withBr}</blockquote>`
}

function buildEmail(opts: {
  fornNome: string
  descrizione: string
  sedeName: string
  lang: Lang
}) {
  const { fornNome, descrizione, sedeName, lang } = opts
  const block = descrizioneHtmlBlock(descrizione)

  if (lang === 'en') {
    return {
      subject: `Request: purchase order and delivery note — ${sedeName}`,
      html: `<p>Dear ${escapeHtml(fornNome)},</p><p>We have recorded a delivery of the following goods in our system, but we did not receive a delivery note (GRN / DDT) with the shipment:</p>${block}<p>Could you please send us at your earliest convenience:</p><ol><li>A copy or confirmation of the <strong>purchase order</strong> for this supply;</li><li>The corresponding <strong>delivery note</strong> (DDT / transport document) for these products.</li></ol><p>Thank you for your help.</p><br><p>Kind regards,<br>${escapeHtml(sedeName)}</p>`,
      text: `Dear ${fornNome},\n\nWe recorded a delivery without a delivery note:\n\n${descrizione}\n\nPlease send:\n1) Purchase order copy/confirmation\n2) Delivery note (DDT) for these goods.\n\nThank you.\n\n${sedeName}`,
    }
  }
  if (lang === 'fr') {
    return {
      subject: `Demande : bon de commande et bon de livraison — ${sedeName}`,
      html: `<p>Madame, Monsieur ${escapeHtml(fornNome)},</p><p>Nous avons enregistré en système la livraison des marchandises ci-dessous, sans bon de livraison (BL) joint :</p>${block}<p>Pourriez-vous nous transmettre dès que possible :</p><ol><li>Une copie ou confirmation du <strong>bon de commande</strong> pour cette livraison ;</li><li>Le <strong>bon de livraison</strong> (document de transport) correspondant.</li></ol><p>Merci pour votre collaboration.</p><br><p>Cordialement,<br>${escapeHtml(sedeName)}</p>`,
      text: `Madame, Monsieur ${fornNome},\n\nLivraison enregistrée sans bon de livraison :\n\n${descrizione}\n\nMerci d’envoyer :\n1) Bon de commande\n2) Bon de livraison (BL)\n\n${sedeName}`,
    }
  }
  if (lang === 'de') {
    return {
      subject: `Anfrage: Bestellung und Lieferschein — ${sedeName}`,
      html: `<p>Sehr geehrte Damen und Herren,</p><p>wir haben die Lieferung der nachstehenden Ware in unserem System erfasst, jedoch keinen Lieferschein erhalten:</p>${block}<p>Bitte senden Sie uns zeitnah:</p><ol><li>Eine Kopie bzw. Bestätigung der <strong>Bestellung</strong> für diese Lieferung;</li><li>Den zugehörigen <strong>Lieferschein</strong> (Transport-/Lieferbeleg).</li></ol><p>Vielen Dank.</p><br><p>Mit freundlichen Grüßen,<br>${escapeHtml(sedeName)}</p>`,
      text: `Sehr geehrte Damen und Herren,\n\nLieferung ohne Lieferschein erfasst:\n\n${descrizione}\n\nBitte senden Sie:\n1) Bestellbestätigung/-kopie\n2) Lieferschein\n\n${sedeName}`,
    }
  }
  if (lang === 'es') {
    return {
      subject: `Solicitud: pedido y albarán de entrega — ${sedeName}`,
      html: `<p>Estimado/a ${escapeHtml(fornNome)},</p><p>Hemos registrado en el sistema la entrega de la mercancía indicada a continuación, sin albarán de entrega adjunto:</p>${block}<p>¿Podría enviarnos lo antes posible?</p><ol><li>Copia o confirmación del <strong>pedido de compra</strong> de este suministro;</li><li>El <strong>albarán de entrega</strong> (documento de transporte) correspondiente.</li></ol><p>Gracias por su colaboración.</p><br><p>Atentamente,<br>${escapeHtml(sedeName)}</p>`,
      text: `Estimado/a ${fornNome},\n\nEntrega registrada sin albarán:\n\n${descrizione}\n\nPor favor envíe:\n1) Pedido / confirmación\n2) Albarán de entrega\n\n${sedeName}`,
    }
  }

  return {
    subject: `Richiesta ordine e bolla di consegna — ${sedeName}`,
    html: `<p>Gentile ${escapeHtml(fornNome)},</p><p>abbiamo registrato nel nostro sistema la consegna delle merci indicate di seguito, senza aver ricevuto la relativa bolla di consegna (DDT) con la fornitura:</p>${block}<p>Vi preghiamo di inviarci al più presto:</p><ol><li>Copia o conferma dell’<strong>ordine di acquisto</strong> relativo a tale fornitura;</li><li>La <strong>bolla di consegna</strong> (documento di trasporto / DDT) corrispondente a questi prodotti.</li></ol><p>Grazie per la collaborazione.</p><br><p>Cordiali saluti,<br>${escapeHtml(sedeName)}</p>`,
    text: `Gentile ${fornNome},\n\nAbbiamo registrato una consegna senza DDT:\n\n${descrizione}\n\nVi preghiamo di inviare:\n1) Copia/conferma ordine d’acquisto\n2) Bolla di consegna (DDT) per le merci indicate.\n\n${sedeName}`,
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json({ error: 'Email non configurata (RESEND_API_KEY).' }, { status: 503 })
  }

  const authClient = await createClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Profilo non trovato' }, { status: 401 })

  let body: {
    fornitore_id?: string
    descrizione?: string
    sede_id?: string | null
    statement_id?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const fornitoreId = typeof body.fornitore_id === 'string' ? body.fornitore_id.trim() : ''
  const descrizione = typeof body.descrizione === 'string' ? body.descrizione.trim() : ''
  const sedeId = body.sede_id === undefined || body.sede_id === '' ? null : String(body.sede_id).trim() || null

  if (!fornitoreId) {
    return NextResponse.json({ error: 'fornitore_id obbligatorio' }, { status: 400 })
  }
  if (!descrizione) {
    return NextResponse.json({ error: 'descrizione obbligatoria' }, { status: 400 })
  }

  const service = createServiceClient()
  const isAdmin = String(profile.role ?? '').toLowerCase() === 'admin'

  const { data: fornitore, error: fErr } = await service
    .from('fornitori')
    .select('id, nome, email, language, sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()

  if (fErr || !fornitore) {
    return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
  }
  if (!isAdmin && profile.sede_id && fornitore.sede_id !== profile.sede_id) {
    return NextResponse.json({ error: 'Fornitore non consentito per questa sede' }, { status: 403 })
  }

  if (!fornitore.email?.trim()) {
    return NextResponse.json(
      {
        error:
          'Il fornitore non ha un indirizzo email in anagrafica. Aggiungilo dalla scheda fornitore.',
      },
      { status: 422 },
    )
  }

  let sedeNome = 'FLUXO'
  let sedeReplyTo = 'noreply@resend.dev'
  let sedeLang: Lang = 'en'

  const effectiveSedeId = sedeId ?? fornitore.sede_id
  if (effectiveSedeId) {
    const { data: sede } = await service
      .from('sedi')
      .select('nome, imap_user, country_code')
      .eq('id', effectiveSedeId)
      .maybeSingle()
    if (sede) {
      sedeNome = sede.nome ?? sedeNome
      sedeLang = localeFromCountryCode(sede.country_code)
      if (sede.imap_user?.trim()) sedeReplyTo = sede.imap_user.trim()
    }
  }

  const lang: Lang = ((fornitore.language as Lang | null) ?? sedeLang) as Lang
  const { subject, html, text } = buildEmail({
    fornNome: fornitore.nome ?? 'Fornitore',
    descrizione,
    sedeName: sedeNome,
    lang,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailErr } = await resend.emails.send({
    from: 'FLUXO <onboarding@resend.dev>',
    replyTo: sedeReplyTo !== 'noreply@resend.dev' ? sedeReplyTo : undefined,
    to: [fornitore.email.trim()],
    subject,
    html,
    text,
  })

  if (emailErr) {
    console.error('[richiedi-bolla-ordine] Resend:', emailErr)
    return NextResponse.json(
      { error: `Invio non riuscito: ${(emailErr as { message?: string }).message ?? 'sconosciuto'}` },
      { status: 500 },
    )
  }

  try {
    await service.from('log_sincronizzazione').insert([
      {
        mittente: sedeReplyTo,
        oggetto_mail: `[RICHIESTA BOLLA] ${subject}`,
        stato: 'successo',
        fornitore_id: fornitoreId,
        file_url: null,
        errore_dettaglio: body.statement_id ? `statement_id=${body.statement_id}` : null,
      },
    ])
  } catch (logErr) {
    console.warn('[richiedi-bolla-ordine] log insert:', logErr)
  }

  return NextResponse.json({
    ok: true,
    destinatario: fornitore.email.trim(),
    language: lang,
    sent_at: new Date().toISOString(),
  })
}
