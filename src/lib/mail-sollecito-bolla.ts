/**
 * Single open delivery note → missing invoice reminder (batch /api/solleciti).
 * Wording aligned with richiedi-fattura / invia-sollecito conventions per locale.
 */
import type { Locale } from '@/lib/translations'

const INTL: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
}

function fmtDate(iso: string, lang: Locale) {
  const loc = INTL[lang] ?? 'en-GB'
  return new Intl.DateTimeFormat(loc, { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso))
}

export function buildSollecitoBollaEmail(opts: { nome: string; dataISO: string; lang: Locale }) {
  const { nome, dataISO, lang } = opts
  const d = fmtDate(dataISO, lang)

  if (lang === 'en') {
    return {
      subject: `Missing invoice – delivery on ${d}`,
      html: `<p>Dear ${nome},</p><p>We are still awaiting the invoice for the delivery on <strong>${d}</strong>.</p><p>Please send it at your earliest convenience so we can close our records.</p><p>Kind regards</p>`,
    }
  }
  if (lang === 'fr') {
    return {
      subject: `Facture manquante – livraison du ${d}`,
      html: `<p>Madame, Monsieur,</p><p>Nous n'avons pas encore reçu la facture relative à la livraison du <strong>${d}</strong> (${nome}).</p><p>Pourriez-vous nous l'adresser dans les meilleurs délais afin de permettre le rapprochement de nos comptes ?</p><p>Cordialement</p>`,
    }
  }
  if (lang === 'de') {
    return {
      subject: `Fehlende Rechnung – Lieferung vom ${d}`,
      html: `<p>Sehr geehrte Damen und Herren,</p><p>für die Lieferung vom <strong>${d}</strong> (Geschäftspartner: <strong>${nome}</strong>) liegt uns noch keine Rechnung vor.</p><p>Wir bitten Sie, uns die Rechnungskopie baldmöglichst zuzusenden, damit wir unsere Buchhaltung abschließen können.</p><p>Mit freundlichen Grüßen</p>`,
    }
  }
  if (lang === 'es') {
    return {
      subject: `Factura faltante – entrega del ${d}`,
      html: `<p>Estimado/a ${nome},</p><p>Aún estamos a la espera de la factura correspondiente a la entrega del <strong>${d}</strong>.</p><p>Le rogamos que nos la remita lo antes posible para poder cerrar nuestros registros.</p><p>Atentamente</p>`,
    }
  }
  // Italian (default formal tone)
  return {
    subject: `Richiesta fattura – bolla del ${d}`,
    html: `<p>Gentile ${nome},</p><p>in riferimento alla consegna del <strong>${d}</strong>, risulta ancora assente la relativa fattura nei nostri archivi.</p><p>Vi preghiamo cortesemente di inviarcela al più presto per consentire la chiusura contabile del periodo.</p><p>Cordiali saluti</p>`,
  }
}

/** Sollecito per messaggi con promessa di allegato (`promessa_invio_documento`) ancora senza PDF in coda. */
export function buildSollecitoPromessaDocumentoEmail(opts: { nome: string; lang: Locale }) {
  const { nome, lang } = opts

  if (lang === 'en') {
    return {
      subject: 'Reminder: promised document still pending',
      html: `<p>Dear ${nome},</p><p>Following your message indicating that you would send documentation shortly, we have not yet received the attachment in our inbox.</p><p>Please send it at your earliest convenience.</p><p>Kind regards</p>`,
    }
  }
  if (lang === 'fr') {
    return {
      subject: 'Relance : document promis non reçu',
      html: `<p>Madame, Monsieur,</p><p>Suite à votre message indiquant l’envoi prochain de pièces jointes, nous n’avons pas encore reçu le document (${nome}).</p><p>Merci de nous le transmettre dès que possible.</p><p>Cordialement</p>`,
    }
  }
  if (lang === 'de') {
    return {
      subject: 'Erinnerung: zugesagtes Dokument ausstehend',
      html: `<p>Sehr geehrte Damen und Herren,</p><p>auf Ihre Nachricht, dass Sie uns in Kürze Unterlagen zusenden würden, haben wir den Anhang noch nicht erhalten (${nome}).</p><p>Bitte senden Sie uns das Dokument zeitnah zu.</p><p>Mit freundlichen Grüßen</p>`,
    }
  }
  if (lang === 'es') {
    return {
      subject: 'Recordatorio: documento prometido pendiente',
      html: `<p>Estimado/a ${nome},</p><p>Tras su mensaje indicando que enviaría la documentación en breve, aún no hemos recibido el adjunto en nuestra bandeja.</p><p>Rogamos nos lo remita lo antes posible.</p><p>Atentamente</p>`,
    }
  }
  return {
    subject: 'Sollecito: documento promesso non ancora ricevuto',
    html: `<p>Gentile ${nome},</p><p>in seguito alla sua comunicazione con cui ha indicato l’invio a breve della documentazione, non risulta ancora pervenuto l’allegato nella nostra casella.</p><p>La preghiamo di inviarcelo al più presto.</p><p>Cordiali saluti</p>`,
  }
}
