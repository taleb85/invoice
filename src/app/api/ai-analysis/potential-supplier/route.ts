import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { logActivity, type ActivityAction } from '@/lib/activity-logger'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'

export const dynamic = 'force-dynamic'

/**
 * Calcola score di idoneità in base al tipo di documento rilevato.
 * Listini prezzi / cataloghi → alto potenziale.
 */
function calcolaScoreDaDocumento(documentTypeLabel?: string): {
  score_qualita: number
  score_prezzi: number
  score_documentazione: number
  score_totale: number
  settore_merceologico: string | null
} {
  const label = (documentTypeLabel ?? '').toLowerCase()

  const isPriceList = label.includes('listino') || label.includes('prezzi') || label.includes('price list')
  const isCatalog = label.includes('catalogo') || label.includes('catalog') || label.includes('brochure')
  const isTechnical = label.includes('scheda tecnica') || label.includes('certificazione')

  let score_qualita = 3
  let score_prezzi = 3
  let score_documentazione = 3
  let settore_merceologico: string | null = null

  if (isPriceList) {
    score_qualita = 4
    score_prezzi = 4
    score_documentazione = 5
    settore_merceologico = 'Listino prezzi'
  } else if (isCatalog) {
    score_qualita = 4
    score_prezzi = 3
    score_documentazione = 4
    settore_merceologico = 'Catalogo prodotti'
  } else if (isTechnical) {
    score_qualita = 5
    score_prezzi = 2
    score_documentazione = 5
  }

  const score_totale = Math.round(((0.30 * score_qualita + 0.25 * score_prezzi + 0.10 * score_documentazione) / (0.30 + 0.25 + 0.10)) * 20 * 100) / 100

  return { score_qualita, score_prezzi, score_documentazione, score_totale, settore_merceologico }
}

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const service = createServiceClient()

  let body: {
    entityType?: string
    entityId?: string
    supplier_name?: string
    contact_email?: string
    contact_phone?: string
    product_types?: string[]
    document_type_label?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  if (!body.entityType || !body.entityId) {
    return NextResponse.json({ error: 'entityType e entityId richiesti' }, { status: 400 })
  }

  const supplierName = (body.supplier_name ?? '').trim()
  const productTypes: string[] = Array.isArray(body.product_types) ? body.product_types : []

  // Recupera informazioni dal documento originale per fallback
  let fileUrl: string | null = null
  let documentDate: string | null = null
  let dbSupplierName: string | null = null

  if (body.entityType === 'bolla') {
    const { data } = await service
      .from('bolle')
      .select('id, file_url, data, fornitore:fornitori(nome)')
      .eq('id', body.entityId)
      .maybeSingle()
    if (data) {
      fileUrl = data.file_url
      documentDate = data.data
      const forn = data.fornitore as unknown as { nome: string } | null
      dbSupplierName = forn?.nome ?? null
    }
  } else {
    const { data } = await service
      .from('fatture')
      .select('id, file_url, data, fornitore:fornitori(nome)')
      .eq('id', body.entityId)
      .maybeSingle()
    if (data) {
      fileUrl = data.file_url
      documentDate = data.data
      const forn = data.fornitore as unknown as { nome: string } | null
      dbSupplierName = forn?.nome ?? null
    }
  }

  // Fallback: se l'AI non ha estratto il nome fornitore, usa quello già presente nel DB
  const finalName = supplierName || dbSupplierName || (body.document_type_label ? `Nuovo fornitore — ${body.document_type_label}` : 'Fornitore da documentazione')
  const finalProductTypes: string[] = productTypes.length > 0 ? productTypes : (body.document_type_label ? [body.document_type_label] : [])

  const scoring = calcolaScoreDaDocumento(body.document_type_label)

  // Crea il record fornitore potenziale
  const { data: comunicazione, error: insertErr } = await service
    .from('comunicazioni_fornitori_potenziali')
    .insert({
      canale: 'email',
      nome_azienda: finalName,
      email_contatto: body.contact_email?.trim().toLowerCase() ?? null,
      telefono_contatto: body.contact_phone?.trim() ?? null,
      settore_merceologico: scoring.settore_merceologico,
      tipologia_prodotto: finalProductTypes.length > 0 ? finalProductTypes : null,
      score_qualita: scoring.score_qualita,
      score_prezzi: scoring.score_prezzi,
      score_documentazione: scoring.score_documentazione,
      score_totale: scoring.score_totale,
      stato: 'da_valutare',
    })
    .select('id, nome_azienda, score_totale')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Allega il documento come catalogo se c'è un file_url
  if (fileUrl) {
    await service.from('cataloghi_fornitori_potenziali').insert({
      comunicazione_id: comunicazione.id,
      file_url: fileUrl,
      tipo_documento: 'listino_prezzi',
      prodotti_rappresentati: finalProductTypes,
    })
  }

  await logActivity(service, {
    userId: user.id,
    sedeId: null,
    action: 'potential_supplier.created',
    entityType: 'comunicazioni_fornitori_potenziali',
    entityId: comunicazione.id,
    entityLabel: comunicazione.nome_azienda,
    metadata: {
      source: 'ai_analysis',
      entityType: body.entityType,
      entityId: body.entityId,
      score: comunicazione.score_totale,
    },
  })

  return NextResponse.json({
    message: `Fornitore potenziale "${comunicazione.nome_azienda}" registrato (score: ${comunicazione.score_totale ?? '?'}%).`,
    id: comunicazione.id,
    score: comunicazione.score_totale,
  })
}
