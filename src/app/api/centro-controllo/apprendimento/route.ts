import { NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'

export interface ApprendimentoStats {
  pattern_totali: number
  conferme_totali: number
  suggerimenti_totali: number
  pattern_auto_eseguibili: number
  azioni_piu_comuni: { azione_id: string; label: string; count: number }[]
  log_recenti: {
    id: string
    azione_id: string
    label?: string
    confermata: boolean
    eseguita: boolean
    created_at: string
    error?: string | null
  }[]
  confidenza_media: number
}

export async function GET(req: Request) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role ?? '')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const sedeId = searchParams.get('sede_id')

  const service = createServiceClient()

  const [patternRes, logRes] = await Promise.all([
    service.from('ai_action_learning')
      .select('id, azione_id, totali_conferme, totali_suggerimenti')
      .eq('sede_id', sedeId)
      .limit(1000),
    service.from('ai_action_learning_log')
      .select('id, azione_id, confermata, eseguita, created_at, error')
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const patterns = patternRes.data || []
  const logs = logRes.data || []

  const confermeTotali = patterns.reduce((acc, p) => acc + (p.totali_conferme || 0), 0)
  const suggerimentiTotali = patterns.reduce((acc, p) => acc + (p.totali_suggerimenti || 0), 0)
  const patternAutoEseguibili = patterns.filter((p) => (p.totali_conferme || 0) >= 10).length

  const azioneCount = new Map<string, number>()
  for (const p of patterns) {
    const curr = azioneCount.get(p.azione_id) || 0
    azioneCount.set(p.azione_id, curr + 1)
  }

  const labelMap: Record<string, string> = {
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
    'documento.apri': 'Apri documento',
    'documento.aggiorna_categoria': 'Aggiorna categoria',
    'fattura.approva': 'Approva fattura',
    'fattura.rifiuta': 'Rifiuta fattura',
    'fattura.resetta_approvazione': 'Resetta approvazione',
    'statement.segna_come_ok': 'Segna come verificato',
    'statement.assegna_fattura': 'Assegna fattura',
    'statement.ricalcola': 'Ricalcola',
  }

  const azioniPiuComuni = [...azioneCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([azione_id, count]) => ({
      azione_id,
      label: labelMap[azione_id] || azione_id,
      count,
    }))

  const confidenzaMedia = patterns.length > 0
    ? patterns.reduce((acc, p) => {
        const totale = (p.totali_conferme || 0) + (p.totali_suggerimenti || 0)
        const ratio = totale > 0 ? (p.totali_conferme || 0) / totale : 0
        return acc + ratio
      }, 0) / patterns.length
    : 0

  const result: ApprendimentoStats = {
    pattern_totali: patterns.length,
    conferme_totali: confermeTotali,
    suggerimenti_totali: suggerimentiTotali,
    pattern_auto_eseguibili: patternAutoEseguibili,
    azioni_piu_comuni: azioniPiuComuni,
    log_recenti: logs.map((l) => ({
      id: l.id,
      azione_id: l.azione_id,
      label: labelMap[l.azione_id] || l.azione_id,
      confermata: l.confermata,
      eseguita: l.eseguita,
      created_at: l.created_at,
      error: l.error,
    })),
    confidenza_media: Math.round(confidenzaMedia * 100),
  }

  return NextResponse.json(result)
}
