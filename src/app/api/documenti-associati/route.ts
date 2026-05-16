import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type Anomalia = {
  id: string
  tipo: 'file_mancante' | 'fornitore_mancante' | 'data_mancante' | 'riferimento_assente' | 'riferimento_inesistente' | 'fattura_doppia' | 'documento_duplicato' | 'sede_mancante' | 'metadati_incompleti' | 'associazione_vecchia'
  gravita: 'alta' | 'media' | 'bassa'
  descrizione: string
  documento_id: string
  riferimento_id?: string
}

type DocumentoAssociato = {
  id: string
  created_at: string | null
  data_documento: string | null
  mittente: string | null
  oggetto_mail: string | null
  file_url: string | null
  file_name: string | null
  content_type: string | null
  stato: string
  is_statement: boolean
  sede_id: string | null
  fornitore_id: string | null
  fattura_id: string | null
  bolla_id: string | null
  metadata: Record<string, unknown> | null
  fornitore: { nome: string; email?: string; piva?: string } | null
  sede: { nome: string } | null
  fattura: { data: string; numero_fattura: string; importo: number } | null
  bolla: { data: string; numero_bolla: string; importo: number } | null
  anomalie: Anomalia[]
  giorni_da_associazione: number
}

type StatisticheVerifica = {
  totale: number
  totale_con_anomalie: number
  totale_ok: number
  distribuzione_sedi: Record<string, number>
  distribuzione_fornitori: Record<string, number>
  distribuzione_tipo: Record<string, number>
  distribuzione_mese: Record<string, number>
  anomalie: {
    per_tipo: Record<string, number>
    per_gravita: Record<string, number>
    totali: number
  }
}

type VerifyResponse = {
  success: boolean
  data: DocumentoAssociato[]
  total: number
  page: number
  limit: number
  statistiche: StatisticheVerifica
  anomalie_riepilogo: {
    tipo: string
    conteggio: number
    gravita: string
  }[]
}

async function buildVerificaAnomalie(
  doc: Record<string, unknown>,
  allDocs: Record<string, unknown>[],
): Promise<Anomalia[]> {
  const anomalie: Anomalia[] = []
  const id = doc.id as string
  const giorni = doc.created_at
    ? Math.floor((Date.now() - new Date(doc.created_at as string).getTime()) / (24 * 60 * 60 * 1000))
    : 0

  if (!doc.file_url) {
    anomalie.push({ id: `file-${id}`, tipo: 'file_mancante', gravita: 'alta', descrizione: 'Il documento non ha un file_url associato. Il PDF potrebbe essere stato eliminato o non caricato correttamente.', documento_id: id })
  }

  if (!doc.fornitore_id) {
    anomalie.push({ id: `forn-${id}`, tipo: 'fornitore_mancante', gravita: 'alta', descrizione: 'Il documento è associato ma non ha un fornitore collegato. L\'associazione è incompleta.', documento_id: id })
  }

  if (!doc.data_documento) {
    anomalie.push({ id: `data-${id}`, tipo: 'data_mancante', gravita: 'media', descrizione: 'Il documento non ha una data documento valida.', documento_id: id })
  }

  if (!doc.sede_id) {
    anomalie.push({ id: `sede-${id}`, tipo: 'sede_mancante', gravita: 'media', descrizione: 'Il documento non è associato a nessuna sede.', documento_id: id })
  }

  const fatturaId = doc.fattura_id as string | null
  const bollaId = doc.bolla_id as string | null
  if (!fatturaId && !bollaId) {
    anomalie.push({ id: `rif-${id}`, tipo: 'riferimento_assente', gravita: 'alta', descrizione: 'Documento associato ma senza collegamento a fattura o bolla. Verificare che l\'associazione sia completa.', documento_id: id })
  }

  if (giorni > 180) {
    anomalie.push({ id: `vecchio-${id}`, tipo: 'associazione_vecchia', gravita: 'bassa', descrizione: `Documento associato da ${giorni} giorni. Verificare se può essere archiviato o eliminato.`, documento_id: id })
  }

  const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
    ? (doc.metadata as Record<string, unknown>)
    : null

  if (!meta || Object.keys(meta).length === 0) {
    anomalie.push({ id: `meta-${id}`, tipo: 'metadati_incompleti', gravita: 'bassa', descrizione: 'Il documento non ha metadati OCR.', documento_id: id })
  }

  const fornitoreId = doc.fornitore_id as string | null
  const dataDoc = doc.data_documento as string | null
  const docFileUrl = doc.file_url as string | null
  if (fornitoreId && dataDoc && meta) {
    const importo = meta.totale_iva_inclusa as number | null
    const numFattura = meta.numero_fattura as string | null

    const duplicati = allDocs.filter((d) => {
      if (d.id === id) return false
      if ((d.fornitore_id as string | null) !== fornitoreId) return false
      // Stesso file fisico — non è un duplicato, è lo stesso documento
      const dUrl = d.file_url as string | null
      if (docFileUrl && dUrl && docFileUrl === dUrl) return false
      const dMeta = d.metadata && typeof d.metadata === 'object' && !Array.isArray(d.metadata)
        ? (d.metadata as Record<string, unknown>)
        : null
      let match = false
      if (numFattura && dMeta?.numero_fattura && dMeta.numero_fattura === numFattura) {
        match = true
      }
      if (importo != null && dMeta?.totale_iva_inclusa != null && Number(dMeta.totale_iva_inclusa) === importo && (d.data_documento as string | null) === dataDoc) {
        match = true
      }
      return match
    })

    // Conta ogni coppia una volta sola (id < dup.id) per evitare doppio conteggio
    for (const dup of duplicati) {
      const dupId = dup.id as string
      if (id > dupId) continue
      anomalie.push({
        id: `dup-${id}-${dupId}`,
        tipo: 'documento_duplicato',
        gravita: 'alta',
        descrizione: `Possibile duplicato del documento ${dupId}. Stesso fornitore e ${numFattura ? `stesso numero fattura (${numFattura})` : importo != null ? `stesso importo (€${importo})` : 'stessi dati'}.`,
        documento_id: id,
        riferimento_id: dupId,
      })
    }
  }

  return anomalie
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') ?? '50')))
    const sedeId = searchParams.get('sede_id')
    const fornitoreId = searchParams.get('fornitore_id')
    const fromDate = searchParams.get('from_date')
    const toDate = searchParams.get('to_date')
    const tipo = searchParams.get('tipo')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'desc'
    const anomalieOnly = searchParams.get('anomalie_only') === 'true'
    const reportMode = searchParams.get('report') === 'true'

    let query = reportMode
      ? supabase
          .from('documenti_da_processare')
          .select('*, fornitore:fornitori(nome, email, piva), sede:sedi(nome)', { count: 'exact', head: false })
          .eq('stato', 'associato')
      : supabase
          .from('documenti_da_processare')
          .select('*, fornitore:fornitori(nome, email, piva), sede:sedi(nome)')
          .eq('stato', 'associato')

    if (sedeId) {
      if (sedeId === 'null') {
        query = query.is('sede_id', null)
      } else {
        query = query.eq('sede_id', sedeId)
      }
    }
    if (fornitoreId) {
      if (fornitoreId === 'null') {
        query = query.is('fornitore_id', null)
      } else {
        query = query.eq('fornitore_id', fornitoreId)
      }
    }
    if (fromDate) query = query.gte('data_documento', fromDate)
    if (toDate) query = query.lte('data_documento', toDate)
    if (tipo) query = query.eq('is_statement', tipo === 'statement')
    if (search) {
      query = query.or(
        `mittente.ilike.%${search}%,file_name.ilike.%${search}%,oggetto_mail.ilike.%${search}%`,
      )
    }

    const sortColumn = ['created_at', 'data_documento', 'mittente', 'file_name'].includes(sortBy)
      ? sortBy
      : 'created_at'
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' })

    if (reportMode) {
      const { data: allDocs, error, count } = await query

      if (error) {
        logger.error('Errore recupero documenti per report', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      const docs = allDocs as Record<string, unknown>[]

      // Deduplica per file_url: stesso documento fisico conta una volta sola
      const seenUrl = new Set<string>()
      const docsUnici = docs.filter(d => {
        const url = d.file_url as string | undefined
        if (!url) return true
        if (seenUrl.has(url)) return false
        seenUrl.add(url)
        return true
      })
      const total = docsUnici.length

      let docsConAnomalieCount = 0
      const distribuzioneSedi: Record<string, number> = {}
      const distribuzioneFornitori: Record<string, number> = {}
      const distribuzioneTipo: Record<string, number> = {}
      const distribuzioneMese: Record<string, number> = {}
      const anomaliePerTipo: Record<string, number> = {}
      const anomaliePerGravita: Record<string, number> = {}

      for (const doc of docsUnici) {
        const anomalie = await buildVerificaAnomalie(doc, docs)

        for (const a of anomalie) {
          anomaliePerTipo[a.tipo] = (anomaliePerTipo[a.tipo] || 0) + 1
          anomaliePerGravita[a.gravita] = (anomaliePerGravita[a.gravita] || 0) + 1
        }

        if (anomalie.length > 0) docsConAnomalieCount++

        const sedeNome = (doc.sede as { nome?: string } | null)?.nome ?? '(nessuna sede)'
        distribuzioneSedi[sedeNome] = (distribuzioneSedi[sedeNome] || 0) + 1

        const fornitoreNome = (doc.fornitore as { nome?: string } | null)?.nome ?? '(nessun fornitore)'
        distribuzioneFornitori[fornitoreNome] = (distribuzioneFornitori[fornitoreNome] || 0) + 1

        const pendingKind = doc.metadata
          ? ((doc.metadata as Record<string, unknown>).pending_kind as string) ?? 'altro'
          : 'altro'
        distribuzioneTipo[pendingKind] = (distribuzioneTipo[pendingKind] || 0) + 1

        if (doc.created_at) {
          const mese = (doc.created_at as string).substring(0, 7)
          distribuzioneMese[mese] = (distribuzioneMese[mese] || 0) + 1
        }
      }

      const anomalieRiepilogo = Object.entries(anomaliePerTipo).map(([tipo, conteggio]) => {
        let gravita = 'bassa'
        if (['file_mancante', 'fornitore_mancante', 'riferimento_assente', 'documento_duplicato'].includes(tipo)) gravita = 'alta'
        else if (['data_mancante', 'sede_mancante', 'riferimento_inesistente'].includes(tipo)) gravita = 'media'
        return { tipo, conteggio, gravita }
      }).sort((a, b) => b.conteggio - a.conteggio)

      const statistiche: StatisticheVerifica = {
        totale: total,
        totale_con_anomalie: docsConAnomalieCount,
        totale_ok: total - docsConAnomalieCount,
        distribuzione_sedi: distribuzioneSedi,
        distribuzione_fornitori: distribuzioneFornitori,
        distribuzione_tipo: distribuzioneTipo,
        distribuzione_mese: distribuzioneMese,
        anomalie: {
          per_tipo: anomaliePerTipo,
          per_gravita: anomaliePerGravita,
          totali: Object.values(anomaliePerTipo).reduce((a, b) => a + b, 0),
        },
      }

      return NextResponse.json({
        success: true,
        total,
        statistiche,
        anomalie_riepilogo: anomalieRiepilogo,
      })
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data: rawDocs, error, count } = await query.range(from, to)

    if (error) {
      logger.error('Errore recupero documenti associati', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const allDocs = rawDocs as unknown as Record<string, unknown>[]
    const total = count ?? 0

    const docsConAnomalie = await Promise.all(
      allDocs.map(async (doc) => {
        const anomalie = await buildVerificaAnomalie(doc, allDocs)
        const giorni = doc.created_at
          ? Math.floor((Date.now() - new Date(doc.created_at as string).getTime()) / (24 * 60 * 60 * 1000))
          : 0

        if (anomalieOnly && anomalie.length === 0) return null

        const docMeta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
          ? (doc.metadata as Record<string, unknown>)
          : null

        let fatturaData = null
        if (doc.fattura_id) {
          const { data: fData } = await supabase
            .from('fatture')
            .select('data, numero_fattura, importo')
            .eq('id', doc.fattura_id)
            .maybeSingle()
          fatturaData = fData
          if (!fData) {
            anomalie.push({
              id: `fk-fatt-${doc.id}`,
              tipo: 'riferimento_inesistente',
              gravita: 'alta',
              descrizione: `La fattura collegata (${doc.fattura_id}) non esiste più. Il riferimento è orfano.`,
              documento_id: doc.id as string,
            })
          }
        }

        let bollaData = null
        if (doc.bolla_id) {
          const { data: bData } = await supabase
            .from('bolle')
            .select('data, numero_bolla, importo')
            .eq('id', doc.bolla_id)
            .maybeSingle()
          bollaData = bData
          if (!bData) {
            anomalie.push({
              id: `fk-bolla-${doc.id}`,
              tipo: 'riferimento_inesistente',
              gravita: 'alta',
              descrizione: `La bolla collegata (${doc.bolla_id}) non esiste più. Il riferimento è orfano.`,
              documento_id: doc.id as string,
            })
          }
        }

        const risultato: DocumentoAssociato = {
          id: doc.id as string,
          created_at: doc.created_at as string | null,
          data_documento: doc.data_documento as string | null,
          mittente: doc.mittente as string | null,
          oggetto_mail: doc.oggetto_mail as string | null,
          file_url: doc.file_url as string | null,
          file_name: doc.file_name as string | null,
          content_type: doc.content_type as string | null,
          stato: doc.stato as string,
          is_statement: doc.is_statement as boolean,
          sede_id: doc.sede_id as string | null,
          fornitore_id: doc.fornitore_id as string | null,
          fattura_id: doc.fattura_id as string | null,
          bolla_id: doc.bolla_id as string | null,
          metadata: docMeta,
          fornitore: doc.fornitore as { nome: string; email?: string; piva?: string } | null ?? null,
          sede: doc.sede as { nome: string } | null ?? null,
          fattura: fatturaData as { data: string; numero_fattura: string; importo: number } | null ?? null,
          bolla: bollaData as { data: string; numero_bolla: string; importo: number } | null ?? null,
          anomalie,
          giorni_da_associazione: giorni,
        }

        return risultato
      }),
    )

    const data = docsConAnomalie.filter((d): d is DocumentoAssociato => d !== null)

    const distribuzioneSedi: Record<string, number> = {}
    const distribuzioneFornitori: Record<string, number> = {}
    const distribuzioneTipo: Record<string, number> = {}
    const distribuzioneMese: Record<string, number> = {}
    const anomaliePerTipo: Record<string, number> = {}
    const anomaliePerGravita: Record<string, number> = {}

    for (const doc of data) {
      const sedeNome = doc.sede?.nome ?? '(nessuna sede)'
      distribuzioneSedi[sedeNome] = (distribuzioneSedi[sedeNome] || 0) + 1
      const fornitoreNome = doc.fornitore?.nome ?? '(nessun fornitore)'
      distribuzioneFornitori[fornitoreNome] = (distribuzioneFornitori[fornitoreNome] || 0) + 1
      const pendingKind = doc.metadata
        ? (doc.metadata.pending_kind as string) ?? 'altro'
        : 'altro'
      distribuzioneTipo[pendingKind] = (distribuzioneTipo[pendingKind] || 0) + 1
      if (doc.created_at) {
        const mese = doc.created_at.substring(0, 7)
        distribuzioneMese[mese] = (distribuzioneMese[mese] || 0) + 1
      }
      for (const a of doc.anomalie) {
        anomaliePerTipo[a.tipo] = (anomaliePerTipo[a.tipo] || 0) + 1
        anomaliePerGravita[a.gravita] = (anomaliePerGravita[a.gravita] || 0) + 1
      }
    }

    const anomalieRiepilogo = Object.entries(anomaliePerTipo).map(([tipo, conteggio]) => {
      let gravita = 'bassa'
      if (['file_mancante', 'fornitore_mancante', 'riferimento_assente', 'documento_duplicato'].includes(tipo)) gravita = 'alta'
      else if (['data_mancante', 'sede_mancante', 'riferimento_inesistente'].includes(tipo)) gravita = 'media'
      return { tipo, conteggio, gravita }
    }).sort((a, b) => b.conteggio - a.conteggio)

    const statistiche: StatisticheVerifica = {
      totale: total,
      totale_con_anomalie: data.filter((d) => d.anomalie.length > 0).length,
      totale_ok: data.filter((d) => d.anomalie.length === 0).length,
      distribuzione_sedi: distribuzioneSedi,
      distribuzione_fornitori: distribuzioneFornitori,
      distribuzione_tipo: distribuzioneTipo,
      distribuzione_mese: distribuzioneMese,
      anomalie: {
        per_tipo: anomaliePerTipo,
        per_gravita: anomaliePerGravita,
        totali: Object.values(anomaliePerTipo).reduce((a, b) => a + b, 0),
      },
    }

    const result: VerifyResponse = {
      success: true,
      data,
      total,
      page,
      limit,
      statistiche,
      anomalie_riepilogo: anomalieRiepilogo,
    }

    return NextResponse.json(result)
  } catch (err) {
    logger.error('Errore documenti-associati', err)
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 })
  }
}

function determinaCategoriaDocumento(doc: Record<string, unknown>): string {
  if (doc.fattura_id) return 'FATTURA'
  if (doc.bolla_id) return 'BOLLA'
  if (doc.is_statement) return 'ESTRATTO CONTO'
  const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
    ? (doc.metadata as Record<string, unknown>)
    : null
  const pk = meta?.pending_kind as string | undefined
  if (pk === 'fattura' || pk === 'invoice') return 'FATTURA'
  if (pk === 'bolla') return 'BOLLA'
  if (pk === 'statement') return 'ESTRATTO CONTO'
  if (pk === 'ordine') return 'ORDINE'
  if (pk === 'listino') return 'LISTINO'
  if (pk === 'comunicazione') return 'COMUNICAZIONE'
  if (pk === 'nota_credito') return 'NOTA CREDITO'
  return 'Documento'
}

function determinaAzioneConsigliata(anomalie: Anomalia[]): { azione: 'scarta' | 'resetta' | 'elimina_duplicato' } | null {
  if (anomalie.length === 0) return null
  if (anomalie.some(a => a.tipo === 'documento_duplicato')) return { azione: 'elimina_duplicato' }
  if (anomalie.some(a => a.tipo === 'file_mancante')) return { azione: 'scarta' }
  return { azione: 'resetta' }
}

function calcolaGravitaMax(anomalie: Anomalia[]): string {
  if (anomalie.length === 0) return 'nessuna'
  if (anomalie.some(a => a.gravita === 'alta')) return 'alta'
  if (anomalie.some(a => a.gravita === 'media')) return 'media'
  return 'bassa'
}

async function logAzioneVerifica(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    documento_id: string
    action: 'scarta' | 'resetta' | 'elimina_duplicato'
    anomalie: Anomalia[]
    batch_id?: string
    fornitore_id?: string | null
    fornitore_nome?: string | null
    file_name?: string | null
    sede_id?: string | null
    documento_categoria?: string | null
  }
) {
  const consigliato = determinaAzioneConsigliata(params.anomalie)
  const anomalieTipi = [...new Set(params.anomalie.map(a => a.tipo))]

  const { error } = await supabase.from('documenti_verifica_action_log').insert({
    documento_id: params.documento_id,
    action: params.action,
    anomalie_tipi: anomalieTipi,
    anomalie_count: params.anomalie.length,
    anomalie_gravita: calcolaGravitaMax(params.anomalie),
    consigliato: consigliato?.azione ?? null,
    seguito_consiglio: consigliato?.azione === params.action,
    batch_id: params.batch_id ?? null,
    fornitore_id: params.fornitore_id ?? null,
    fornitore_nome: params.fornitore_nome ?? null,
    file_name: params.file_name ?? null,
    sede_id: params.sede_id ?? null,
    documento_categoria: params.documento_categoria ?? null,
  })
  if (error) {
    logger.error('Errore logging azione verifica', error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body: { action?: string; documento_id?: string } = await req.json().catch(() => ({}))
    const { action, documento_id } = body

    if (!action || !documento_id) {
      return NextResponse.json(
        { success: false, error: 'Parametri mancanti: action e documento_id sono obbligatori.' },
        { status: 400 },
      )
    }

    const validActions = ['scarta', 'resetta', 'elimina_duplicato']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Azione non valida. Azioni consentite: ${validActions.join(', ')}.` },
        { status: 400 },
      )
    }

    const { data: documento, error: findError } = await supabase
      .from('documenti_da_processare')
      .select('*, fornitore:fornitori(nome, email, piva), sede:sedi(nome)')
      .eq('id', documento_id)
      .maybeSingle()

    if (findError || !documento) {
      logger.error('Documento non trovato', { id: documento_id, error: findError })
      return NextResponse.json({ success: false, error: 'Documento non trovato.' }, { status: 404 })
    }

    if (documento.stato !== 'associato' && action !== 'resetta') {
      return NextResponse.json(
        { success: false, error: `Il documento è in stato "${documento.stato}". Azione "${action}" non consentita.` },
        { status: 409 },
      )
    }

    const { data: allDocs } = await supabase
      .from('documenti_da_processare')
      .select('id, fornitore_id, data_documento, metadata, created_at, file_url, sede_id, fattura_id, bolla_id')
      .eq('stato', 'associato')

    const anomalie = await buildVerificaAnomalie(
      documento as unknown as Record<string, unknown>,
      (allDocs ?? []) as unknown as Record<string, unknown>[],
    )

    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'scarta':
      case 'elimina_duplicato':
        updateData = {
          stato: 'scartato',
          fattura_id: null,
          bolla_id: null,
          note: action === 'elimina_duplicato'
            ? `Eliminato come duplicato il ${new Date().toISOString().substring(0, 10)}`
            : `Scartato da verifica associazioni il ${new Date().toISOString().substring(0, 10)}`,
        }
        break

      case 'resetta':
        updateData = {
          stato: 'da_associare',
          fattura_id: null,
          bolla_id: null,
          note: `Riassegnato a da_associare dalla verifica associazioni il ${new Date().toISOString().substring(0, 10)}`,
        }
        break
    }

    const { error: updateError } = await supabase
      .from('documenti_da_processare')
      .update(updateData)
      .eq('id', documento_id)

    if (updateError) {
      logger.error(`Errore aggiornamento documento (${action})`, updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    await logAzioneVerifica(supabase, {
      documento_id,
      action: action as 'scarta' | 'resetta' | 'elimina_duplicato',
      anomalie,
      fornitore_id: documento.fornitore_id,
      fornitore_nome: (documento.fornitore as { nome?: string } | null)?.nome ?? null,
      file_name: documento.file_name,
      sede_id: documento.sede_id,
      documento_categoria: determinaCategoriaDocumento(documento as unknown as Record<string, unknown>),
    })

    logger.info(`Documento ${documento_id} aggiornato con azione "${action}"`, {
      action,
      documento_id,
      stato_precedente: documento.stato,
      file_name: documento.file_name,
      anomalie_count: anomalie.length,
    })

    return NextResponse.json({
      success: true,
      action,
      documento_id,
      message:
        action === 'scarta'
          ? 'Documento scartato con successo.'
          : action === 'elimina_duplicato'
            ? 'Duplicato eliminato con successo.'
            : 'Documento riassegnato a "da associare" con successo.',
    })
  } catch (err) {
    logger.error('Errore PATCH documenti-associati', err)
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body: { action?: string; document_ids?: string[] } = await req.json().catch(() => ({}))
    const { action, document_ids } = body

    if (!action || !document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Parametri mancanti: action e document_ids (array) sono obbligatori.' },
        { status: 400 },
      )
    }

    if (document_ids.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Massimo 500 documenti per volta. Riduci la selezione.' },
        { status: 400 },
      )
    }

    const validActions = ['scarta', 'resetta', 'elimina_duplicato']
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Azione non valida. Azioni consentite: ${validActions.join(', ')}.` },
        { status: 400 },
      )
    }

    const { data: documenti, error: findError } = await supabase
      .from('documenti_da_processare')
      .select('*, fornitore:fornitori(nome, email, piva), sede:sedi(nome)')
      .in('id', document_ids)

    if (findError) {
      logger.error('Errore recupero documenti per batch', findError)
      return NextResponse.json({ success: false, error: findError.message }, { status: 500 })
    }

    const { data: allDocs } = await supabase
      .from('documenti_da_processare')
      .select('id, fornitore_id, data_documento, metadata, created_at, file_url, sede_id, fattura_id, bolla_id')
      .eq('stato', 'associato')

    const docMap = new Map(documenti?.map((d) => [d.id, d]) ?? [])
    const errors: { id: string; error: string }[] = []
    const processed: string[] = []
    const batchId = crypto.randomUUID()

    for (const docId of document_ids) {
      const documento = docMap.get(docId)
      if (!documento) {
        errors.push({ id: docId, error: 'Documento non trovato.' })
        continue
      }
      if (documento.stato !== 'associato' && action !== 'resetta') {
        errors.push({ id: docId, error: `Stato "${documento.stato}" non compatibile con azione "${action}".` })
        continue
      }

      const anomalie = await buildVerificaAnomalie(
        documento as unknown as Record<string, unknown>,
        (allDocs ?? []) as unknown as Record<string, unknown>[],
      )

      let updateData: Record<string, unknown> = {}

      switch (action) {
        case 'scarta':
        case 'elimina_duplicato':
          updateData = {
            stato: 'scartato',
            fattura_id: null,
            bolla_id: null,
            note: action === 'elimina_duplicato'
              ? `Eliminato come duplicato il ${new Date().toISOString().substring(0, 10)}`
              : `Scartato da verifica associazioni il ${new Date().toISOString().substring(0, 10)}`,
          }
          break
        case 'resetta':
          updateData = {
            stato: 'da_associare',
            fattura_id: null,
            bolla_id: null,
            note: `Riassegnato a da_associare dalla verifica associazioni il ${new Date().toISOString().substring(0, 10)}`,
          }
          break
      }

      const { error: updateError } = await supabase
        .from('documenti_da_processare')
        .update(updateData)
        .eq('id', docId)

      if (updateError) {
        errors.push({ id: docId, error: updateError.message })
      } else {
        processed.push(docId)
        await logAzioneVerifica(supabase, {
          documento_id: docId,
          action: action as 'scarta' | 'resetta' | 'elimina_duplicato',
          anomalie,
          batch_id: batchId,
          fornitore_id: documento.fornitore_id,
          fornitore_nome: (documento.fornitore as { nome?: string } | null)?.nome ?? null,
          file_name: documento.file_name,
          sede_id: documento.sede_id,
          documento_categoria: determinaCategoriaDocumento(documento as unknown as Record<string, unknown>),
        })
      }
    }

    logger.info(`Batch ${action} completato`, {
      action,
      batch_id: batchId,
      richiesti: document_ids.length,
      processati: processed.length,
      errori: errors.length,
    })

    return NextResponse.json({
      success: true,
      action,
      batch_id: batchId,
      processed_count: processed.length,
      error_count: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message:
        errors.length === 0
          ? `${processed.length} documenti ${action === 'scarta' ? 'scartati' : action === 'elimina_duplicato' ? 'eliminati come duplicati' : 'riassegnati a "da associare"'} con successo.`
          : `${processed.length} documenti processati, ${errors.length} errori.`,
    })
  } catch (err) {
    logger.error('Errore POST batch documenti-associati', err)
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 })
  }
}
