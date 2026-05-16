import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body: { documenti_ids?: string[]; categoria?: string } = await req.json().catch(() => ({}))

    const { documenti_ids, categoria } = body

    if (!documenti_ids || !Array.isArray(documenti_ids) || documenti_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'documenti_ids è obbligatorio e deve essere un array non vuoto.' },
        { status: 400 },
      )
    }

    const CATEGORIE_VALIDE = new Set([
      'FATTURA', 'BOLLA', 'ESTRATTO CONTO', 'ORDINE', 'LISTINO', 'COMUNICAZIONE', 'NOTA CREDITO',
    ])

    if (!categoria || !CATEGORIE_VALIDE.has(categoria)) {
      return NextResponse.json(
        { success: false, error: `Categoria non valida. Valori consentiti: ${[...CATEGORIE_VALIDE].join(', ')}.` },
        { status: 400 },
      )
    }

    const pendingKindMap: Record<string, string> = {
      FATTURA: 'fattura',
      BOLLA: 'bolla',
      'ESTRATTO CONTO': 'statement',
      ORDINE: 'ordine',
      LISTINO: 'listino',
      COMUNICAZIONE: 'comunicazione',
      'NOTA CREDITO': 'nota_credito',
    }

    const nuovoPendingKind = pendingKindMap[categoria]

    const { data: documenti, error: findError } = await supabase
      .from('documenti_da_processare')
      .select('id, fornitore_id, sede_id, file_name, metadata, fornitore:fornitori(nome)')
      .in('id', documenti_ids)

    if (findError) {
      logger.error('Errore recupero documenti per batch categoria', findError)
      return NextResponse.json({ success: false, error: findError.message }, { status: 500 })
    }

    if (!documenti || documenti.length === 0) {
      return NextResponse.json({ success: false, error: 'Nessun documento trovato.' }, { status: 404 })
    }

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const doc of documenti) {
      const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? (doc.metadata as Record<string, unknown>)
        : {}

      if (nuovoPendingKind) {
        meta.pending_kind = nuovoPendingKind
      }

      const { error: updateError } = await supabase
        .from('documenti_da_processare')
        .update({ metadata: meta })
        .eq('id', doc.id)

      if (updateError) {
        errorCount++
        errors.push(`Errore aggiornamento ${doc.id}: ${updateError.message}`)
        continue
      }

      const { error: logError } = await supabase.from('documenti_verifica_action_log').insert({
        documento_id: doc.id,
        action: 'aggiorna_categoria',
        anomalie_tipi: ['categoria_corretta_manualmente'],
        anomalie_count: 0,
        anomalie_gravita: 'nessuna',
        consigliato: null,
        seguito_consiglio: false,
        fornitore_id: doc.fornitore_id,
        fornitore_nome: (doc.fornitore as { nome?: string } | null)?.nome ?? null,
        file_name: doc.file_name,
        sede_id: doc.sede_id,
        documento_categoria: categoria,
      })

      if (logError) {
        logger.error(`Errore logging batch categoria per ${doc.id}`, logError)
      }

      successCount++
    }

    logger.info(`Batch categoria completato: ${successCount} successi, ${errorCount} errori`, {
      categoria,
      totale: documenti.length,
      successCount,
      errorCount,
    })

    return NextResponse.json({
      success: true,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Categoria "${categoria}" assegnata a ${successCount} documento${successCount !== 1 ? 'i' : ''}.`,
    })
  } catch (err) {
    logger.error('Errore PUT categoria batch', err)
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 })
  }
}
