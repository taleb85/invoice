import type { SupabaseClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity-logger'

const COMMERCIAL_DOC_SIGNALS = [
  'listino', 'prezzi', 'price list', 'pricelist', 'price update',
  'catalogo', 'catalog', 'brochure', 'tariffario', 'tariffe',
  'scheda tecnica', 'technical sheet', 'certificazione',
  'price sheet', 'pricing', 'new prices', 'riferimento prezzi',
  'offer', 'offerta', 'proposta', 'proposal',
]

const COMMERCIAL_FILE_SIGNALS = [
  'listino', 'prezzi', 'price', 'catalogo', 'catalog',
  'brochure', 'tariff', 'scheda_tecnica', 'certificat',
]

function isCommercialDocument(ocrTipo: string | null, subject: string | null, fileName: string | null): boolean {
  const tipo = (ocrTipo ?? '').toLowerCase().trim()
  if (tipo === 'fattura' || tipo === 'bolla') return false

  const subjectLower = (subject ?? '').toLowerCase()
  const fileNameLower = (fileName ?? '').toLowerCase()
  const text = `${subjectLower} ${fileNameLower}`

  for (const signal of COMMERCIAL_DOC_SIGNALS) {
    if (text.includes(signal)) return true
  }
  for (const signal of COMMERCIAL_FILE_SIGNALS) {
    if (fileNameLower.includes(signal)) return true
  }
  return false
}

function inferDocumentLabel(subject: string | null, fileName: string | null, ragioneSociale: string | null): string {
  const text = `${(subject ?? '')} ${(fileName ?? '')}`.toLowerCase()
  const name = (ragioneSociale ?? '').toLowerCase()

  if (text.includes('listino') || text.includes('prezzi') || text.includes('price list') || text.includes('pricelist') || text.includes('tariff')) {
    return name.includes('listino') ? 'listino prezzi' : 'Listino prezzi'
  }
  if (text.includes('catalogo') || text.includes('catalog') || text.includes('brochure')) {
    return 'Catalogo prodotti'
  }
  if (text.includes('scheda tecnica') || text.includes('technical sheet') || text.includes('certificazio')) {
    return 'Scheda tecnica'
  }
  if (text.includes('offer') || text.includes('offerta') || text.includes('proposta')) {
    return 'Offerta commerciale'
  }
  return 'Documento commerciale'
}

export async function autoCreatePotentialSupplierFromScan(
  service: SupabaseClient,
  ocr: {
    ragione_sociale: string | null
    p_iva: string | null
    tipo_documento: string | null
    indirizzo?: string | null
  },
  email: {
    from: string | null
    subject: string | null
  },
  attachmentFileName: string | null,
  fileUrl: string | null,
  sedeId: string | null,
  userId: string | null,
): Promise<void> {
  if (!ocr.ragione_sociale?.trim()) return

  if (!isCommercialDocument(ocr.tipo_documento, email.subject, attachmentFileName)) return

  const nomeAzienda = ocr.ragione_sociale.trim()
  const emailContatto = email.from?.trim().toLowerCase() ?? null
  const documentLabel = inferDocumentLabel(email.subject, attachmentFileName, ocr.ragione_sociale)
  const label = documentLabel.toLowerCase()

  const isPriceList = label.includes('listino') || label.includes('prezzi')
  const isCatalog = label.includes('catalogo') || label.includes('catalog') || label.includes('brochure')
  const isTechnical = label.includes('scheda tecnica') || label.includes('certificazione')

  let scoreQualita = 3
  let scorePrezzi = 3
  let scoreDocumentazione = 3
  let settoreMerceologico: string | null = null

  if (isPriceList) {
    scoreQualita = 4; scorePrezzi = 4; scoreDocumentazione = 5
    settoreMerceologico = 'Listino prezzi'
  } else if (isCatalog) {
    scoreQualita = 4; scorePrezzi = 3; scoreDocumentazione = 4
    settoreMerceologico = 'Catalogo prodotti'
  } else if (isTechnical) {
    scoreQualita = 5; scorePrezzi = 2; scoreDocumentazione = 5
  }

  const scoreTotale = Math.round(
    ((0.30 * scoreQualita + 0.25 * scorePrezzi + 0.10 * scoreDocumentazione) / (0.30 + 0.25 + 0.10)) * 20 * 100
  ) / 100

  const finalProductTypes = [documentLabel]

  const { data: existing } = await service
    .from('comunicazioni_fornitori_potenziali')
    .select('id')
    .or(`nome_azienda.ilike.${nomeAzienda},email_contatto.eq.${emailContatto}`)
    .limit(1)
    .maybeSingle()

  if (existing) return

  const { data: comunicazione, error: insertErr } = await service
    .from('comunicazioni_fornitori_potenziali')
    .insert({
      canale: 'email',
      nome_azienda: nomeAzienda,
      email_contatto: emailContatto,
      partita_iva: ocr.p_iva?.trim() ?? null,
      settore_merceologico: settoreMerceologico,
      tipologia_prodotto: finalProductTypes,
      score_qualita: scoreQualita,
      score_prezzi: scorePrezzi,
      score_documentazione: scoreDocumentazione,
      score_totale: scoreTotale,
      stato: 'da_valutare',
    })
    .select('id, nome_azienda')
    .single()

  if (insertErr) {
    console.error(`[auto-potential-supplier] Errore insert per "${nomeAzienda}": ${insertErr.message}`)
    return
  }

  if (fileUrl) {
    await service.from('cataloghi_fornitori_potenziali').insert({
      comunicazione_id: comunicazione.id,
      file_url: fileUrl,
      tipo_documento: 'listino_prezzi',
      prodotti_rappresentati: finalProductTypes,
    })
  }

  if (userId) {
    await logActivity(service, {
      userId,
      sedeId,
      action: 'potential_supplier.created',
      entityType: 'comunicazioni_fornitori_potenziali',
      entityId: comunicazione.id,
      entityLabel: comunicazione.nome_azienda,
      metadata: {
        source: 'auto_email_scan',
        tipo_documento: ocr.tipo_documento,
        score: scoreTotale,
      },
    }).catch(() => {})
  }

  console.log(`[auto-potential-supplier] Creato fornitore potenziale: "${comunicazione.nome_azienda}" (score: ${scoreTotale}%)`)
}
