import type { CommandId, CodaItem, AiSuggestion, DocumentOrigine } from '@/lib/command-system/types'
import { createClient } from '@/utils/supabase/client'

export interface ContestoApprendimento {
  origine: DocumentOrigine
  stato_origine: string
  pending_kind: string
  fornitore_id: string | null
  sede_id: string | null
  mittente?: string | null
}

function estraiContesto(item: CodaItem): ContestoApprendimento {
  return {
    origine: item.origine,
    stato_origine: item.stato_origine,
    pending_kind: item.pending_kind,
    fornitore_id: item.fornitore_id,
    sede_id: item.sede_id,
    mittente: item.contesto_originale?.mittente as string | null | undefined,
  }
}

function contestoToJsonb(contesto: ContestoApprendimento): Record<string, string | null> {
  return {
    origine: contesto.origine,
    stato_origine: contesto.stato_origine,
    pending_kind: contesto.pending_kind,
    ...(contesto.fornitore_id ? { fornitore_id: contesto.fornitore_id } : {}),
    ...(contesto.sede_id ? { sede_id: contesto.sede_id } : {}),
    ...(contesto.mittente ? { mittente: contesto.mittente } : {}),
  }
}

export async function suggerisciAzione(item: CodaItem): Promise<AiSuggestion | null> {
  const contesto = estraiContesto(item)
  const contestoPayload = contestoToJsonb(contesto)

  const supabase = createClient()

  const { data, error } = await supabase.rpc('calcola_confidenza_suggerimento', {
    p_sede_id: contesto.sede_id,
    p_fornitore_id: contesto.fornitore_id,
    p_contesto: contestoPayload,
  })

  if (error || !data) {
    if (error) console.warn('[ActionLearning] calcola_confidenza_suggerimento error:', error.message)
    return null
  }

  const result = data as {
    azione_id?: string
    confidenza?: number
    totali_conferme?: number
    match_tipo?: string
  }

  if (!result.azione_id || result.confidenza == null) {
    return null
  }

  const confidenzaNorm = result.confidenza > 1 ? result.confidenza / 100 : result.confidenza
  if (confidenzaNorm < 0.6) {
    return null
  }

  const totaliConferme = result.totali_conferme || 0
  const autoEsegui = confidenzaNorm >= 0.95 && totaliConferme >= 10

  return {
    azione_id: result.azione_id as CommandId,
    label: labelDaAzioneId(result.azione_id),
    confidenza: confidenzaNorm,
    totali_conferme: totaliConferme,
    match_tipo: (result.match_tipo as 'esatto' | 'generico') || 'generico',
    autoEsegui,
  }
}

export async function registraConfermaApprendimento(
  item: CodaItem,
  azioneId: CommandId,
  confermata: boolean,
): Promise<boolean> {
  const contesto = estraiContesto(item)
  const supabase = createClient()

  const { error } = await supabase.rpc('upsert_action_learning', {
    p_sede_id: contesto.sede_id,
    p_fornitore_id: contesto.fornitore_id,
    p_contesto: contestoToJsonb(contesto),
    p_azione_id: azioneId,
    p_era_suggerimento: true,
    p_seguito_consiglio: confermata,
  })

  if (error) {
    console.error('[ActionLearning] upsert error:', error.message)
    return false
  }

  return true
}

export async function registraEsecuzioneDiretta(
  item: CodaItem,
  azioneId: CommandId,
): Promise<boolean> {
  const contesto = estraiContesto(item)
  const supabase = createClient()

  const { error } = await supabase.rpc('upsert_action_learning', {
    p_sede_id: contesto.sede_id,
    p_fornitore_id: contesto.fornitore_id,
    p_contesto: contestoToJsonb(contesto),
    p_azione_id: azioneId,
    p_era_suggerimento: false,
    p_seguito_consiglio: true,
  })

  if (error) {
    console.error('[ActionLearning] registraEsecuzioneDiretta error:', error.message)
    return false
  }

  return true
}

function labelDaAzioneId(azioneId: string): string {
  const mappa: Record<string, string> = {
    'documento.scarta': 'Scarta documento',
    'documento.associa': 'Associa a fornitore',
    'documento.finalizza_come_fattura': 'Registra come fattura',
    'documento.finalizza_come_bolla': 'Registra come bolla',
    'documento.finalizza_come_nota_credito': 'Registra come nota credito',
    'documento.finalizza_come_statement': 'Archivia come estratto conto',
    'documento.finalizza_come_ordine': 'Registra come ordine',
    'documento.finalizza_come_comunicazione': 'Archivia come comunicazione',
    'documento.rianalizza_ocr': 'Rianalizza OCR',
    'documento.ignora_mittente': 'Ignora mittente',
    'fattura.approva': 'Approva fattura',
    'fattura.rifiuta': 'Rifiuta fattura',
    'statement.segna_come_ok': 'Segna come verificato',
    'statement.assegna_fattura': 'Assegna fattura',
  }
  return mappa[azioneId] || azioneId
}
