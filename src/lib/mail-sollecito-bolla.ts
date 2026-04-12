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
