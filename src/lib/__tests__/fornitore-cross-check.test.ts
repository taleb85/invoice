import { describe, expect, it } from 'vitest'
import {
  extractSupplierFieldsFromEmailBody,
  crossCheckSupplierFields,
  compareRagioneSociale,
  comparePartitaIva,
  tokenOverlapRatio,
  normalizeRagioneSocialeForComparison,
} from '@/lib/fornitore-cross-check'
import { stripEmailPlusAlias } from '@/lib/fornitore-resolve-scan-email'
import type { OcrResult } from '@/lib/ocr-invoice'

function testOcr(fields: {
  ragione_sociale?: string | null
  p_iva?: string | null
  indirizzo?: string | null
}): OcrResult {
  return {
    ragione_sociale: fields.ragione_sociale ?? null,
    p_iva: fields.p_iva ?? null,
    indirizzo: fields.indirizzo ?? null,
    data_fattura: null,
    numero_fattura: null,
    tipo_documento: null,
    totale_iva_inclusa: null,
  }
}

describe('extractSupplierFieldsFromEmailBody', () => {

  it('estrae P.IVA da corpo email classico italiano', () => {
    const body = `Buongiorno,
    in allegato la fattura richiesta.
    Ditta: La Tua Pasta SRL
    P.IVA: 01234567890
    Indirizzo: Via Roma 123, 20100 Milano
    Grazie`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.p_iva).toBe('01234567890')
    expect(fields.ragione_sociale).toBe('La Tua Pasta SRL')
    expect(fields.indirizzo).toContain('Via Roma')
  })

  it('estrae P.IVA con prefisso "Partita IVA"', () => {
    const body = `Partita IVA: IT 01234567890
    Ragione Sociale: PASTA FRESCA SRL`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.p_iva).toBe('01234567890')
    expect(fields.ragione_sociale).toBe('PASTA FRESCA SRL')
  })

  it('estrae P.IVA con formato VAT inglese', () => {
    const body = `Supplier: Olive Oil Co Ltd
    VAT number: GB123456789
    Address: 12 Oxford Street, London`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.p_iva).toBe('123456789')
    expect(fields.ragione_sociale).toBe('Olive Oil Co Ltd')
  })

  it('estrae ragione sociale con "Società" e indirizzo', () => {
    const body = `Società: "Vini Rossi & Bianchi SRL"
    Sede: Corso Italia 45, 10122 Torino
    Cell: 347 1234567`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.ragione_sociale).toBe('Vini Rossi & Bianchi SRL')
    expect(fields.indirizzo).toContain('Corso Italia')
    expect(fields.telefono).toBe('3471234567')
  })

  it('estrae email di contatto dal corpo', () => {
    const body = `Per qualsiasi informazione contattare:
    Email: ordini@fornitore.it
    Tel: 02 12345678`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.email_contatto).toBe('ordini@fornitore.it')
  })

  it('estrae referente dal corpo email', () => {
    const body = `Referente: Marco Rossi
    Ditta: Forniture Alimentari SRL
    C.A. Ufficio Acquisti`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.referente).toBe('Marco Rossi')
  })

  it('restituisce oggetti null per corpo email vuoto', () => {
    const fields = extractSupplierFieldsFromEmailBody('')
    expect(fields.p_iva).toBeNull()
    expect(fields.ragione_sociale).toBeNull()
    expect(fields.indirizzo).toBeNull()
    expect(fields.email_contatto).toBeNull()
  })

  it('estrae fornitore in inglese con formato "Company:"', () => {
    const body = `Company: "Fresh Vegetables Ltd"
    VAT: IE123456789
    Please find attached the invoice for this month's delivery.`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.ragione_sociale).toBe('Fresh Vegetables Ltd')
    expect(fields.p_iva).toBe('123456789')
  })

  it('estrae da email con "Ditta" e P.IVA su righe separate', () => {
    const body = `Ditta: CASEIFICIO ALPINO SPA
    Via Monte Bianco 10
    11020 Aosta
    P.IVA 00123450157
    Tel. 0165 123456`
    const fields = extractSupplierFieldsFromEmailBody(body)
    expect(fields.ragione_sociale).toContain('CASEIFICIO')
    expect(fields.p_iva).toBe('00123450157')
    expect(fields.telefono).toBe('0165123456')
  })
})

describe('compareRagioneSociale', () => {

  it('match esatto con e senza forma giuridica', () => {
    expect(compareRagioneSociale('La Tua Pasta SRL', 'LA TUA PASTA SRL')).toBe('exact')
  })

  it('match forte con token overlap >= 50%: SRL e S.R.L. normalizzati', () => {
    expect(compareRagioneSociale('PASTA FRESCA SRL', 'PASTA FRESCA s.r.l.')).toBe('exact')
  })

  it('match forte "La Tua Pasta" vs "PASTA" (overlap 50%)', () => {
    expect(compareRagioneSociale('La Tua Pasta', 'PASTA')).toBe('strong')
  })

  it('nessun match per nomi completamente diversi', () => {
    expect(compareRagioneSociale('Fiat SPA', 'Apple Inc')).toBe('none')
  })

  it('match esatto ignorando "SRL"', () => {
    expect(compareRagioneSociale('CASEIFICIO ALPINO', 'CASEIFICIO ALPINO SPA')).toBe('exact')
  })

  it('match parziale con un token comune lungo', () => {
    expect(compareRagioneSociale('Verdi Frutta e Verdura', 'FRUTTA FRESCA SRL')).toBe('partial')
  })
})

describe('comparePartitaIva', () => {

  it('match esatto su P.IVA 11 cifre', () => {
    expect(comparePartitaIva('01234567890', '01234567890')).toBe('exact')
  })

  it('match su ultime 9 cifre (prefisso IT)', () => {
    expect(comparePartitaIva('IT01234567890', '01234567890')).toBe('exact')
  })

  it('nessun match per numeri troppo corti', () => {
    expect(comparePartitaIva('12345', '01234567890')).toBe('none')
  })

  it('nessun match per P.IVA completamente diverse', () => {
    expect(comparePartitaIva('01234567890', '09876543210')).toBe('none')
  })
})

describe('tokenOverlapRatio', () => {

  it('overlap 100% per stringhe identiche', () => {
    expect(tokenOverlapRatio('La Tua Pasta', 'La Tua Pasta')).toBe(1)
  })

  it('overlap ~33% quando 1/3 token combaciano', () => {
    expect(tokenOverlapRatio('Pasta Fresca', 'Pasta Secca')).toBeCloseTo(0.333, 2)
  })

  it('overlap 0 per stringhe completamente diverse', () => {
    expect(tokenOverlapRatio('Fiat', 'Apple')).toBe(0)
  })

  it('overlap per token comune lungo', () => {
    const r = tokenOverlapRatio('CASEIFICIO ALPINO SPA', 'CASEIFICIO BOLOGNA SRL')
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(1)
  })
})

describe('normalizeRagioneSocialeForComparison', () => {

  it('rimuove stop words e normalizza', () => {
    expect(normalizeRagioneSocialeForComparison('La Tua Pasta SRL')).toBe('TUA PASTA')
  })

  it('gestisce caratteri accentati', () => {
    expect(normalizeRagioneSocialeForComparison("Pasticceria De' Rossi")).toContain('ROSSI')
  })

  it('ritorna vuoto per stringa vuota', () => {
    expect(normalizeRagioneSocialeForComparison('')).toBe('')
  })
})

describe('crossCheckSupplierFields', () => {

  it('conferma match con P.IVA corrispondente tra mail e OCR', () => {
    const emailFields = {
      ragione_sociale: 'La Tua Pasta SRL',
      p_iva: '01234567890',
      indirizzo: null,
      email_contatto: null,
      telefono: null,
      referente: null,
    }
    const result = crossCheckSupplierFields(
      emailFields,
      testOcr({
        ragione_sociale: 'LA TUA PASTA SRL',
        p_iva: '01234567890',
        indirizzo: 'Via Roma 123',
      }),
    )
    expect(result.confirmed).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(50)
  })

  it('non conferma match SENZA P.IVA (nome forte non basta per auto-conferma)', () => {
    const emailFields = {
      ragione_sociale: 'Verdi Frutta Fresca',
      p_iva: null,
      indirizzo: null,
      email_contatto: null,
      telefono: null,
      referente: null,
    }
    const result = crossCheckSupplierFields(
      emailFields,
      testOcr({ ragione_sociale: 'VERDI FRUTTA SRL', p_iva: null }),
    )
    expect(result.confirmed).toBe(false)
  })

  it('non conferma match per nomi diversi', () => {
    const emailFields = {
      ragione_sociale: 'CASEIFICIO ALPINO SPA',
      p_iva: null,
      indirizzo: null,
      email_contatto: null,
      telefono: null,
      referente: null,
    }
    const result = crossCheckSupplierFields(
      emailFields,
      testOcr({ ragione_sociale: 'FIAT AUTO SPA', p_iva: null }),
    )
    expect(result.confirmed).toBe(false)
  })

  it('conferma con P.IVA da email e nome dal documento', () => {
    const emailFields = {
      ragione_sociale: null,
      p_iva: '01234567890',
      indirizzo: null,
      email_contatto: null,
      telefono: null,
      referente: null,
    }
    const result = crossCheckSupplierFields(
      emailFields,
      testOcr({ ragione_sociale: 'LA TUA PASTA SRL', p_iva: '01234567890' }),
    )
    expect(result.confirmed).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(50)
  })
})

describe('stripEmailPlusAlias', () => {

  it('rimuove +alias da indirizzo email', () => {
    expect(stripEmailPlusAlias('fornitore+ordini@domain.com')).toBe('fornitore@domain.com')
  })

  it('lascia invariato indirizzo senza +alias', () => {
    expect(stripEmailPlusAlias('fornitore@domain.com')).toBe('fornitore@domain.com')
  })

  it('gestisce +alias multipli', () => {
    expect(stripEmailPlusAlias('test+spam+extra@domain.com')).toBe('test@domain.com')
  })

  it('lascia invariato indirizzo senza @', () => {
    expect(stripEmailPlusAlias('notanemail')).toBe('notanemail')
  })
})

describe('scenari reali completi (cross-check + estrazione)', () => {

  it('1. Mail con P.IVA "P.IVA 01234567890" + documento con stessa P.IVA', () => {
    const emailText = `Gentile cliente,
    in allegato la fattura del mese.
    Ditta: La Tua Pasta SRL
    P.IVA: 01234567890
    Importo: € 1.234,56`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    expect(emailFields.p_iva).toBe('01234567890')
    expect(emailFields.ragione_sociale).toBe('La Tua Pasta SRL')

    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'LA TUA PASTA SRL',
      p_iva: '01234567890',
      indirizzo: null,
    }))
    expect(result.confirmed).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(80)
  })

  it('2. Mail senza P.IVA ma fornitore citato + documento con nome simile (non conferma senza P.IVA)', () => {
    const emailText = `Buongiorno,
    allego la nota di credito per Caseificio Alpino.
    Cordiali saluti`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'CASEIFICIO ALPINO SPA',
      p_iva: null,
    }))
    expect(result.confirmed).toBe(false)
  })

  it('3. Mail con VAT GB + documento con stesso numero', () => {
    const emailText = `Dear Customer,
    Please find attached the invoice.
    Supplier: British Cheese Ltd
    VAT: GB123456789`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    expect(emailFields.p_iva).toBe('123456789')

    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'BRITISH CHEESE LTD',
      p_iva: '123456789',
    }))
    expect(result.confirmed).toBe(true)
  })

  it('4. Mail senza dati fornitore + documento con nome chiaro', () => {
    const emailText = `Come da accordi, invio in allegato il documento richiesto.`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    expect(emailFields.p_iva).toBeNull()
    expect(emailFields.ragione_sociale).toBeNull()

    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'FIAT AUTO SPA',
      p_iva: null,
    }))
    expect(result.confirmed).toBe(false)
  })

  it('5. Mail e documento con nomi che condividono solo un token', () => {
    const emailText = `Ditta: Pasta Fresca SRL`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'PASTA SECCA SPA',
      p_iva: null,
    }))
    expect(result.confirmed).toBe(false)
  })

  it('6. Mail con indirizzo + documento con stesso indirizzo e nome', () => {
    const emailText = `Ditta: Forniture Ufficio SRL
    Sede: Via Roma 123, Milano
    P.IVA: 09876543210`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'FORNITURE UFFICIO SRL',
      p_iva: '09876543210',
      indirizzo: 'Via Roma 123, Milano',
    }))
    expect(result.confirmed).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(80)
  })

  it('7. P.IVA nella mail + documento con solo nome (nessuna P.IVA)', () => {
    const emailText = `P.IVA 00112233445
    Fornitore: Prodotti Chimici SPA`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    expect(emailFields.p_iva).toBe('00112233445')

    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'PRODOTTI CHIMICI SPA',
      p_iva: '00112233445',
    }))
    expect(result.confirmed).toBe(true)
  })

  it('8. Mail vuota — nessun dato estratto', () => {
    const emailFields = extractSupplierFieldsFromEmailBody(null)
    expect(emailFields.ragione_sociale).toBeNull()
    expect(emailFields.p_iva).toBeNull()
  })

  it('9. Mail con azienda in inglese "Company" e VAT', () => {
    const emailText = `Company: German Auto Parts GmbH
    VAT: DE123456789
    Street: Industriestr. 50, Berlin`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    expect(emailFields.ragione_sociale).toBe('German Auto Parts GmbH')
    expect(emailFields.p_iva).toBe('123456789')

    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'GERMAN AUTO PARTS GMBH',
      p_iva: '123456789',
    }))
    expect(result.confirmed).toBe(true)
  })

  it('10. Mail con P.IVA + nome fornitore parzialmente diverso dal documento (variazione)', () => {
    const emailText = `Ditta: Pasticceria De Rosa SRL
    P.IVA: 05678901234`
    const emailFields = extractSupplierFieldsFromEmailBody(emailText)
    const result = crossCheckSupplierFields(emailFields, testOcr({
      ragione_sociale: 'PASTICCERIA DE ROSA SRL',
      p_iva: '05678901234',
    }))
    expect(result.confirmed).toBe(true)
  })
})
