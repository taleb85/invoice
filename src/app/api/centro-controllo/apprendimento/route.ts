import { NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'

export interface ApprendimentoStats {
  pattern_totali: number
  conferme_totali: number
  suggerimenti_totali: number
  pattern_auto_eseguibili: number
  pattern_confermati_3: number
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
  const sedeIdParam = searchParams.get('sede_id')?.trim() || null

  const service = createServiceClient()

  let patternQuery = service
    .from('ai_action_learning')
    .select('id, azione_id, totali_conferme, totali_suggerimenti, ultima_esecuzione_at, updated_at, created_at')
    .limit(1000)
  if (sedeIdParam) patternQuery = patternQuery.eq('sede_id', sedeIdParam)

  let logQuery = service
    .from('ai_action_learning_log')
    .select('id, azione_eseguita, esito, era_suggerimento, created_at, errore')
    .order('created_at', { ascending: false })
    .limit(50)
  if (sedeIdParam) logQuery = logQuery.eq('sede_id', sedeIdParam)

  const [patternRes, logRes] = await Promise.all([patternQuery, logQuery])

  const patterns = patternRes.data || []
  let logs = logRes.data || []

  const confermeTotali = patterns.reduce((acc, p) => acc + (p.totali_conferme || 0), 0)
  const suggerimentiTotali = patterns.reduce((acc, p) => acc + (p.totali_suggerimenti || 0), 0)
  const patternAutoEseguibili = patterns.filter((p) => (p.totali_conferme || 0) >= 10).length
  const patternConfermati3 = patterns.filter((p) => (p.totali_conferme || 0) >= 3).length

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

  if (!logs.length && patterns.length) {
    logs = [...patterns]
      .sort((a, b) => {
        const at = a.ultima_esecuzione_at || a.updated_at || a.created_at || ''
        const bt = b.ultima_esecuzione_at || b.updated_at || b.created_at || ''
        return bt.localeCompare(at)
      })
      .slice(0, 50)
      .map((p) => ({
        id: p.id,
        azione_eseguita: p.azione_id,
        esito: 'successo' as const,
        era_suggerimento: false,
        created_at: p.ultima_esecuzione_at || p.updated_at || p.created_at || new Date().toISOString(),
        errore: null,
      }))
  }

  const result: ApprendimentoStats = {
    pattern_totali: patterns.length,
    conferme_totali: confermeTotali,
    suggerimenti_totali: suggerimentiTotali,
    pattern_auto_eseguibili: patternAutoEseguibili,
    pattern_confermati_3: patternConfermati3,
    azioni_piu_comuni: azioniPiuComuni,
    log_recenti: logs.map((l) => {
      const azioneId = (l as { azione_eseguita?: string; azione_id?: string }).azione_eseguita
        ?? (l as { azione_id?: string }).azione_id
        ?? ''
      const esito = (l as { esito?: string }).esito
      const confermataLegacy = (l as { confermata?: boolean }).confermata
      const eseguitaLegacy = (l as { eseguita?: boolean }).eseguita
      return {
        id: l.id,
        azione_id: azioneId,
        label: labelMap[azioneId] || azioneId,
        confermata: esito != null ? esito !== 'annullato' : !!confermataLegacy,
        eseguita: esito != null ? esito === 'successo' : !!eseguitaLegacy,
        created_at: l.created_at,
        error: (l as { errore?: string | null; error?: string | null }).errore
          ?? (l as { error?: string | null }).error
          ?? null,
      }
    }),
    confidenza_media: Math.round(confidenzaMedia * 100),
  }

  return NextResponse.json(result)
}
