import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { logger } from '@/lib/logger'
import { recordLearnedKindFromDocMetadata, type LearnedPendingKind } from '@/lib/fornitore-doc-type-hints'

export const dynamic = 'force-dynamic'

const CATEGORIE_VALIDE = new Set([
  'FATTURA',
  'BOLLA',
  'ESTRATTO CONTO',
  'ORDINE',
  'LISTINO',
  'COMUNICAZIONE',
  'NOTA CREDITO',
])

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body: { documento_id?: string; categoria?: string } = await req.json().catch(() => ({}))

    const { documento_id, categoria } = body

    if (!documento_id) {
      return NextResponse.json(
        { success: false, error: 'documento_id è obbligatorio.' },
        { status: 400 },
      )
    }

    if (!categoria || !CATEGORIE_VALIDE.has(categoria)) {
      return NextResponse.json(
        { success: false, error: `Categoria non valida. Valori consentiti: ${[...CATEGORIE_VALIDE].join(', ')}.` },
        { status: 400 },
      )
    }

    const { data: documento, error: findError } = await supabase
      .from('documenti_da_processare')
      .select('*, fornitore:fornitori(nome, email, piva), sede:sedi(nome)')
      .eq('id', documento_id)
      .maybeSingle()

    if (findError || !documento) {
      logger.error('Documento non trovato per cambio categoria', { id: documento_id, error: findError })
      return NextResponse.json({ success: false, error: 'Documento non trovato.' }, { status: 404 })
    }

    const meta = documento.metadata && typeof documento.metadata === 'object' && !Array.isArray(documento.metadata)
      ? (documento.metadata as Record<string, unknown>)
      : {}

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
    if (nuovoPendingKind) {
      meta.pending_kind = nuovoPendingKind
    }

    const { error: updateError } = await supabase
      .from('documenti_da_processare')
      .update({ metadata: meta })
      .eq('id', documento_id)

    if (updateError) {
      logger.error('Errore aggiornamento categoria documento', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // Registra apprendimento AI: per questo fornitore, documenti con questo tipo OCR
    // vanno classificati come la categoria scelta dall'utente
    if (nuovoPendingKind && documento.fornitore_id) {
      const pendingKindMapReverse: Record<string, LearnedPendingKind> = {
        fattura: 'fattura',
        bolla: 'bolla',
        statement: 'statement',
        ordine: 'ordine',
        comunicazione: 'comunicazione',
        nota_credito: 'nota_credito',
      }
      const learnedKind = pendingKindMapReverse[nuovoPendingKind] as LearnedPendingKind | undefined
      if (learnedKind) {
        recordLearnedKindFromDocMetadata(supabase, {
          fornitoreId: documento.fornitore_id,
          metadata: documento.metadata,
          pendingKind: learnedKind,
        }).catch(() => {})
      }
    }

    const anomalieTipi = ['categoria_corretta_manualmente']
    const { error: logError } = await supabase.from('documenti_verifica_action_log').insert({
      documento_id,
      action: 'aggiorna_categoria',
      anomalie_tipi: anomalieTipi,
      anomalie_count: 0,
      anomalie_gravita: 'nessuna',
      consigliato: null,
      seguito_consiglio: false,
      fornitore_id: documento.fornitore_id,
      fornitore_nome: (documento.fornitore as { nome?: string } | null)?.nome ?? null,
      file_name: documento.file_name,
      sede_id: documento.sede_id,
      documento_categoria: categoria,
    })

    if (logError) {
      logger.error('Errore logging cambio categoria', logError)
    }

    logger.info(`Categoria documento ${documento_id} aggiornata a "${categoria}"`, {
      documento_id,
      categoria_precedente: (documento.metadata as Record<string, unknown> | null)?.pending_kind ?? null,
      categoria_nuova: nuovoPendingKind,
    })

    return NextResponse.json({
      success: true,
      documento_id,
      categoria,
      message: `Categoria aggiornata a "${categoria}".`,
    })
  } catch (err) {
    logger.error('Errore PUT categoria', err)
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 })
  }
}
