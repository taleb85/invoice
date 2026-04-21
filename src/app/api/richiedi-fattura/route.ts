/**
 * POST /api/richiedi-fattura
 *
 * Sends invoice-request emails for open delivery notes that have no invoice yet.
 * Language is auto-detected from sede's country_code:
 *   UK/GB → English · IT → Italian · FR → French · DE → German · ES → Spanish
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { Resend } from 'resend'
import { localeFromCountryCode, type Locale } from '@/lib/translations'

type Lang = Locale

const LOCALE_MAP: Record<Lang, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

function formatDate(d: string, locale = 'en-GB') {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d))
}

function buildInvoiceRequestEmail(opts: {
  nome:       string
  sedeName:   string
  dates:      string[]
  lang:       Lang
}) {
  const { nome, sedeName, dates, lang } = opts
  const intlLocale = LOCALE_MAP[lang] ?? 'en-GB'
  const sortedDates = [...dates].sort()

  if (lang === 'en') {
    const listaDate = sortedDates.map(d => `<li>Delivery on <strong>${formatDate(d, intlLocale)}</strong></li>`).join('')
    return {
      subject: sortedDates.length === 1
        ? `Missing Invoice – Delivery of ${formatDate(sortedDates[0], intlLocale)}`
        : `Missing Invoices (${sortedDates.length} deliveries)`,
      html: `<p>Dear ${nome},</p><p>We are waiting to receive the invoices for the following deliveries:</p><ul>${listaDate}</ul><p>Please provide them at your earliest convenience.</p><br><p>Kind regards,<br>${sedeName}</p>`,
    }
  }

  if (lang === 'fr') {
    const listaDate = sortedDates.map(d => `<li>Livraison du <strong>${formatDate(d, intlLocale)}</strong></li>`).join('')
    return {
      subject: sortedDates.length === 1
        ? `Facture manquante – Livraison du ${formatDate(sortedDates[0], intlLocale)}`
        : `Factures manquantes (${sortedDates.length} livraisons)`,
      html: `<p>Madame, Monsieur ${nome},</p><p>Nous attendons de recevoir les factures pour les livraisons suivantes :</p><ul>${listaDate}</ul><p>Merci de nous les faire parvenir dès que possible.</p><br><p>Cordialement,<br>${sedeName}</p>`,
    }
  }

  if (lang === 'de') {
    const listaDate = sortedDates.map(d => `<li>Lieferung vom <strong>${formatDate(d, intlLocale)}</strong></li>`).join('')
    return {
      subject: sortedDates.length === 1
        ? `Fehlende Rechnung – Lieferung vom ${formatDate(sortedDates[0], intlLocale)}`
        : `Fehlende Rechnungen (${sortedDates.length} Lieferungen)`,
      html: `<p>Sehr geehrte Damen und Herren bei ${nome},</p><p>Wir warten auf die Rechnungen für folgende Lieferungen:</p><ul>${listaDate}</ul><p>Bitte senden Sie uns diese so bald wie möglich zu.</p><br><p>Mit freundlichen Grüßen,<br>${sedeName}</p>`,
    }
  }

  if (lang === 'es') {
    const listaDate = sortedDates.map(d => `<li>Entrega del <strong>${formatDate(d, intlLocale)}</strong></li>`).join('')
    return {
      subject: sortedDates.length === 1
        ? `Factura faltante – Entrega del ${formatDate(sortedDates[0], intlLocale)}`
        : `Facturas faltantes (${sortedDates.length} entregas)`,
      html: `<p>Estimado/a ${nome},</p><p>Estamos a la espera de recibir las facturas correspondientes a las siguientes entregas:</p><ul>${listaDate}</ul><p>Le rogamos que nos las envíe a la mayor brevedad posible.</p><br><p>Atentamente,<br>${sedeName}</p>`,
    }
  }

  // Italian fallback
  const listaDate = sortedDates.map(d => `<li>Consegna del <strong>${formatDate(d, intlLocale)}</strong></li>`).join('')
  return {
    subject: sortedDates.length === 1
      ? `Richiesta Fattura – Consegna del ${formatDate(sortedDates[0], intlLocale)}`
      : `Richiesta Fatture Mancanti (${sortedDates.length} consegne)`,
    html: `<p>Buongiorno ${nome},</p><p>Siamo in attesa di ricevere le fatture relative alle seguenti consegne:</p><ul>${listaDate}</ul><p>Vi preghiamo di provvedere all'invio il prima possibile.</p><br><p>Cordiali saluti,<br>${sedeName}</p>`,
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json()
  const bollaIds: string[] = Array.isArray(body.bolla_ids) ? body.bolla_ids : body.bolla_id ? [body.bolla_id] : []
  const sedeId: string | undefined = body.sede_id

  if (!bollaIds.length) return NextResponse.json({ error: 'No delivery notes specified' }, { status: 400 })

  // ── Resolve sede for language + reply-to ─────────────────────────────
  let sedeLang: Lang = 'en'
  let replyTo: string | undefined
  let sedeName = 'Smart Pair'
  const svc = createServiceClient()

  if (sedeId) {
    const { data: sede } = await svc.from('sedi')
      .select('nome, imap_user, country_code')
      .eq('id', sedeId)
      .single()
    if (sede) {
      sedeLang = localeFromCountryCode(sede.country_code)
      replyTo  = sede.imap_user ?? undefined
      sedeName = sede.nome
    }
  }

  const { data: bolle, error: dbError } = await supabase
    .from('bolle')
    .select('id, data, fornitori(id, nome, email, language)')
    .in('id', bollaIds)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!bolle?.length) return NextResponse.json({ error: 'Delivery notes not found' }, { status: 404 })

  const resend = new Resend(process.env.RESEND_API_KEY)

  // Group by supplier — one email per supplier
  const byFornitore = new Map<string, { nome: string; email: string; date: string[]; lang: Lang }>()
  for (const bolla of bolle) {
    const raw = bolla.fornitori
    const f = (Array.isArray(raw) ? raw[0] : raw) as { id: string; nome: string; email: string | null; language: string | null } | null
    if (!f?.email) continue
    if (!byFornitore.has(f.id)) {
      // Supplier language > sede language fallback
      const supplierLang = (f.language as Lang | null) ?? sedeLang
      byFornitore.set(f.id, { nome: f.nome, email: f.email, date: [], lang: supplierLang })
    }
    byFornitore.get(f.id)!.date.push(bolla.data)
  }

  let inviati = 0
  const errori: string[] = []

  for (const { nome, email, date, lang } of byFornitore.values()) {
    const { subject, html } = buildInvoiceRequestEmail({ nome, sedeName, dates: date, lang })

    const { error: mailError } = await resend.emails.send({
      from:    'Smart Pair <onboarding@resend.dev>',
      replyTo: replyTo,
      to:      email,
      subject,
      html,
    })

    if (mailError) {
      errori.push(`${nome} (${email}): ${mailError.message}`)
    } else {
      inviati++
    }
  }

  return NextResponse.json({
    inviati,
    totale: byFornitore.size,
    ...(errori.length > 0 && { errori }),
  })
}
