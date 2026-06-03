import { NextRequest, NextResponse } from 'next/server'
import { assertItemSedeAccess } from '@/lib/action-learning/context'
import { rpcCalcolaConfidenza } from '@/lib/action-learning/server-rpc'
import type { CommandId, CodaItem, AiSuggestion } from '@/lib/command-system/types'
import { isMasterAdminRole } from '@/lib/roles'
import { createServiceClient, getProfile } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

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

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { item?: CodaItem }
  const item = body.item
  if (!item?.id) return NextResponse.json({ error: 'item richiesto' }, { status: 400 })

  if (!assertItemSedeAccess(profile.sede_id, isMasterAdminRole(profile.role), item)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: result, error } = await rpcCalcolaConfidenza(service, item)
  if (error) {
    console.warn('[ActionLearning] calcola_confidenza_suggerimento:', error)
    return NextResponse.json({ suggestion: null })
  }

  if (!result?.azione_id || result.confidenza == null) {
    return NextResponse.json({ suggestion: null })
  }

  const confidenzaNorm = result.confidenza > 1 ? result.confidenza / 100 : result.confidenza
  if (confidenzaNorm < 0.6) {
    return NextResponse.json({ suggestion: null })
  }

  const totaliConferme = result.totali_conferme || 0
  const suggestion: AiSuggestion = {
    azione_id: result.azione_id as CommandId,
    label: labelDaAzioneId(result.azione_id),
    confidenza: confidenzaNorm,
    totali_conferme: totaliConferme,
    match_tipo: (result.match_tipo as 'esatto' | 'generico') || 'generico',
    autoEsegui: confidenzaNorm >= 0.95 && totaliConferme >= 10,
  }

  return NextResponse.json({ suggestion })
}
