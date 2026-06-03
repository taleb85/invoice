import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type AzionePattern = {
  action: string
  count: number
  percentuale: number
}

type PatternAnomalia = {
  anomalie_tipi: string[]
  anomalie_count: number
  gravita_max: string
  documento_categoria: string | null
  totale_azioni: number
  azioni: AzionePattern[]
  azione_piu_frequente: { action: string; percentuale: number } | null
}

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data: logs, error } = await supabase
      .from('documenti_verifica_action_log')
      .select('action, anomalie_tipi, anomalie_count, anomalie_gravita, consigliato, seguito_consiglio, documento_categoria')
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Errore recupero log azioni verifica', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        success: true,
        statistiche_generali: {
          totale_azioni: 0,
          per_azione: { scarta: 0, resetta: 0, elimina_duplicato: 0 },
          totale_con_consiglio: 0,
          consigli_seguiti: 0,
          accuratezza_consigli: 0,
        },
        pattern_anomalie_azioni: [],
      })
    }

    const perAzione: Record<string, number> = { scarta: 0, resetta: 0, elimina_duplicato: 0 }
    let consigliPresenti = 0
    let consigliSeguiti = 0

    const patternMap = new Map<string, { anomalie_tipi: string[]; anomalie_count: number; gravita_max: string; documento_categoria: string | null; azioni: Record<string, number>; totale: number }>()

    for (const log of logs) {
      perAzione[log.action] = (perAzione[log.action] || 0) + 1

      if (log.consigliato) {
        consigliPresenti++
        if (log.seguito_consiglio) consigliSeguiti++
      }

      const anomalieKey = [...(log.anomalie_tipi ?? [])].sort().join('|') || 'nessuna_anomalia'
      const catKey = log.documento_categoria ?? 'nessuna_categoria'
      const key = `${anomalieKey}__${catKey}`
      const gravita = log.anomalie_gravita || 'nessuna'

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          anomalie_tipi: log.anomalie_tipi ?? [],
          anomalie_count: log.anomalie_count ?? 0,
          gravita_max: gravita,
          documento_categoria: log.documento_categoria ?? null,
          azioni: {},
          totale: 0,
        })
      }

      const entry = patternMap.get(key)!
      entry.azioni[log.action] = (entry.azioni[log.action] || 0) + 1
      entry.totale++
    }

    const patternAnomalieAzioni: PatternAnomalia[] = []
    for (const entry of patternMap.values()) {
      const azioni: AzionePattern[] = Object.entries(entry.azioni)
        .sort(([, a], [, b]) => b - a)
        .map(([action, count]) => ({
          action,
          count,
          percentuale: Math.round((count / entry.totale) * 100),
        }))

      patternAnomalieAzioni.push({
        anomalie_tipi: entry.anomalie_tipi,
        anomalie_count: entry.anomalie_count,
        gravita_max: entry.gravita_max,
        documento_categoria: entry.documento_categoria,
        totale_azioni: entry.totale,
        azioni,
        azione_piu_frequente: azioni.length > 0
          ? { action: azioni[0].action, percentuale: azioni[0].percentuale }
          : null,
      })
    }

    patternAnomalieAzioni.sort((a, b) => b.totale_azioni - a.totale_azioni)

    const accuratezza = consigliPresenti > 0
      ? Math.round((consigliSeguiti / consigliPresenti) * 100)
      : 0

    return NextResponse.json({
      success: true,
      statistiche_generali: {
        totale_azioni: logs.length,
        per_azione: perAzione,
        totale_con_consiglio: consigliPresenti,
        consigli_seguiti: consigliSeguiti,
        accuratezza_consigli: accuratezza,
      },
      pattern_anomalie_azioni: patternAnomalieAzioni,
    })
  } catch (err) {
    logger.error('Errore learning API', err)
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 })
  }
}
