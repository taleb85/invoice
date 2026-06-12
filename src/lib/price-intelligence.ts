import type { SupabaseClient } from '@supabase/supabase-js'
import { filterOutliersForTrend, isListinoCatalogRow } from '@/lib/listino-display'

export type PriceTrend = {
  prodotto: string
  fornitore_id: string
  fornitore_nome: string
  prezzo_attuale: number
  prezzo_precedente: number | null
  variazione_percent: number | null
  direzione: 'up' | 'down' | 'stable' | null
  data_ultimo: string
  data_precedente: string | null
  num_rilevazioni: number
  volatilita: number
}

export type PriceAnomalia = {
  prodotto: string
  fornitore_id: string
  fornitore_nome: string
  tipo: 'spike' | 'drop' | 'inflazione' | 'sotto_costo' | 'margine_ridotto'
  gravita: 'alta' | 'media' | 'bassa'
  prezzo_attuale: number
  prezzo_riferimento: number
  delta_percent: number
  data: string
  descrizione: string
}

export type Raccomandazione = {
  tipo: 'rinnovo' | 'rinnovo_urgente' | 'ricontrattazione' | 'approfondimento' | 'opportunita' | 'alert'
  prodotto: string
  fornitore_id: string
  fornitore_nome: string | null
  titolo: string
  descrizione: string
  priorita: 'alta' | 'media' | 'bassa'
  impatto_stimato: number | null
}

export type SupplierPriceHealth = {
  fornitore_id: string
  fornitore_nome: string
  prodotti_analizzati: number
  trend_complessivo: number
  volatilita_media: number
  anomalie_attive: number
  raccomandazioni_attive: number
  punteggio_salute: number
  data_ultimo_aggiornamento: string | null
}

export type PriceIntelligenceReport = {
  fornitore_id: string
  fornitore_nome: string
  data_analisi: string
  trends: PriceTrend[]
  anomalie: PriceAnomalia[]
  raccomandazioni: Raccomandazione[]
  salute: SupplierPriceHealth
  riepilogo: {
    totale_prodotti: number
    in_aumento: number
    in_calo: number
    stabili: number
    anomalie_critiche: number
    raccomandazioni_alte: number
    risparmio_potenziale: number
  }
}

type PriceRow = {
  id: string
  fornitore_id: string
  prodotto: string
  prezzo: number
  data_prezzo: string
  note: string | null
  fornitori?: { nome: string; display_name?: string | null } | { nome: string; display_name?: string | null }[]
}

function calcVolatility(prices: number[]): number {
  if (prices.length < 3) return 0
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length
  if (!Number.isFinite(mean) || Math.abs(mean) < 1e-9) return 0
  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / prices.length
  const cv = Math.sqrt(variance) / mean
  return Number.isFinite(cv) ? cv : 0
}

/**
 * Variazione percentuale sicura: ritorna null se il riferimento è 0 o non
 * finito (evita Infinity/NaN che inquinano il punteggio salute e fanno cadere
 * il fornitore fuori dai bucket KPI).
 */
function safePctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (Math.abs(previous) < 1e-9) return null
  const pct = (current - previous) / previous
  return Number.isFinite(pct) ? pct : null
}

function detectDirection(variazioni: number[]): 'up' | 'down' | 'stable' | null {
  if (variazioni.length === 0) return null
  const avg = variazioni.reduce((a, b) => a + b, 0) / variazioni.length
  if (avg > 0.03) return 'up'
  if (avg < -0.03) return 'down'
  return 'stable'
}

export async function analyzeSupplierPriceTrends(
  supabase: SupabaseClient,
  fornitoreId: string,
): Promise<PriceIntelligenceReport> {
  /*
   * Filtri difensivi sul listino: ignora prezzi non positivi (omaggi, sconti
   * di "deal" come `Menabrea 6+1 = -35.66`, articoli `FREE OF CHARGE`,
   * `tomorrow morning` letti dall'OCR sul corpo email) e date nel futuro
   * (errori OCR sulla data). Tutti questi inquinano il calcolo di
   * variazione percentuale e volatilità — basta una riga con prezzo 0 perché
   * `(p[i] - 0) / 0 = Infinity`, e il punteggio salute diventa NaN
   * facendo cadere il fornitore fuori dai bucket KPI Critici/Attenzione/OK.
   * NB: cleanup retroattivo già eseguito in DB (vedi `listino_prezzi`),
   * questi filtri sono la seconda linea di difesa per nuove righe.
   */
  const todayIso = new Date().toISOString().slice(0, 10)
  const { data: rows, error } = await supabase
    .from('listino_prezzi')
    .select('id, fornitore_id, prodotto, prezzo, data_prezzo, note, fornitori(nome, display_name)')
    .eq('fornitore_id', fornitoreId)
    .gt('prezzo', 0)
    .lte('data_prezzo', todayIso)
    .order('data_prezzo', { ascending: true })

  if (error || !rows?.length) {
    const { data: f } = await supabase.from('fornitori').select('nome').eq('id', fornitoreId).maybeSingle()
    return {
      fornitore_id: fornitoreId,
      fornitore_nome: (f as { nome?: string } | null)?.nome ?? 'Sconosciuto',
      data_analisi: new Date().toISOString().slice(0, 10),
      trends: [],
      anomalie: [],
      raccomandazioni: [],
      salute: {
        fornitore_id: fornitoreId,
        fornitore_nome: (f as { nome?: string } | null)?.nome ?? 'Sconosciuto',
        prodotti_analizzati: 0,
        trend_complessivo: 0,
        volatilita_media: 0,
        anomalie_attive: 0,
        raccomandazioni_attive: 0,
        punteggio_salute: 50,
        data_ultimo_aggiornamento: null,
      },
      riepilogo: {
        totale_prodotti: 0, in_aumento: 0, in_calo: 0, stabili: 0,
        anomalie_critiche: 0, raccomandazioni_alte: 0, risparmio_potenziale: 0,
      },
    }
  }

  const rawRowsAll = rows as PriceRow[]
  /*
   * Esclude righe-promo (Menabrea Deal, codici FOC/DEAL/PROMO): non sono
   * prodotti comparabili, sono sconti bundle che falsano il trend.
   */
  const rawRows = rawRowsAll.filter((r) => isListinoCatalogRow({ prodotto: r.prodotto, note: r.note }))

  const fornitoreJoin = (rawRows[0] ?? rawRowsAll[0])?.fornitori
  const fornitoreNome = fornitoreJoin
    ? Array.isArray(fornitoreJoin)
      ? (fornitoreJoin[0]?.nome ?? 'Sconosciuto')
      : fornitoreJoin.nome
    : 'Sconosciuto'

  const prodotti = new Map<string, PriceRow[]>()
  for (const row of rawRows) {
    const p = row.prodotto.trim()
    if (!prodotti.has(p)) prodotti.set(p, [])
    prodotti.get(p)!.push(row)
  }

  const trends: PriceTrend[] = []
  const anomalie: PriceAnomalia[] = []
  const raccomandazioni: Raccomandazione[] = []

  let totaleTrend = 0
  let countTrend = 0
  let inAumento = 0
  let inCalo = 0
  let stabili = 0

  for (const [prodotto, entries] of prodotti) {
    const sortedAll = entries.sort((a, b) => a.data_prezzo.localeCompare(b.data_prezzo))
    /*
     * Filtra outlier prima di calcolare trend/anomalie: l'OCR estrae
     * prezzi diversi dalla stessa fattura (lordo riga vs unitario vs
     * sconto) — vedi Beer Menabrea Blonde con serie £1.48/£7/£35.66.
     * `sortedAll` resta usato per nomi/last-update display.
     */
    const sorted = filterOutliersForTrend(sortedAll)
    const prices = sorted.map((r) => r.prezzo)
    const ultimo = sorted[sorted.length - 1]!
    const precedente = sorted.length >= 2 ? sorted[sorted.length - 2] : null

    const variazioni: number[] = []
    for (let i = 1; i < prices.length; i++) {
      const v = safePctChange(prices[i]!, prices[i - 1]!)
      if (v != null) variazioni.push(v)
    }

    const ultimaVariazione = precedente
      ? safePctChange(ultimo.prezzo, precedente.prezzo)
      : null

    const direzione = detectDirection(variazioni)
    const volatilita = calcVolatility(prices)

    const trend: PriceTrend = {
      prodotto,
      fornitore_id: fornitoreId,
      fornitore_nome: fornitoreNome,
      prezzo_attuale: ultimo.prezzo,
      prezzo_precedente: precedente?.prezzo ?? null,
      variazione_percent: ultimaVariazione != null ? Math.round(ultimaVariazione * 10000) / 100 : null,
      direzione,
      data_ultimo: ultimo.data_prezzo,
      data_precedente: precedente?.data_prezzo ?? null,
      num_rilevazioni: prices.length,
      volatilita: Math.round(volatilita * 100) / 100,
    }
    trends.push(trend)

    if (direzione === 'up') inAumento++
    else if (direzione === 'down') inCalo++
    else stabili++

    totaleTrend += ultimaVariazione ?? 0
    if (ultimaVariazione != null) countTrend++

    const ultimoDelta = ultimaVariazione ?? 0

    if (ultimoDelta > 0.10) {
      anomalie.push({
        prodotto, fornitore_id: fornitoreId, fornitore_nome: fornitoreNome,
        tipo: 'spike', gravita: ultimoDelta > 0.20 ? 'alta' : 'media',
        prezzo_attuale: ultimo.prezzo,
        prezzo_riferimento: precedente?.prezzo ?? ultimo.prezzo,
        delta_percent: Math.round(ultimoDelta * 10000) / 100,
        data: ultimo.data_prezzo,
        descrizione: `Prezzo aumentato del ${(ultimoDelta * 100).toFixed(1)}% rispetto alla rilevazione precedente`,
      })
    } else if (ultimoDelta < -0.10) {
      anomalie.push({
        prodotto, fornitore_id: fornitoreId, fornitore_nome: fornitoreNome,
        tipo: 'sotto_costo', gravita: ultimoDelta < -0.20 ? 'alta' : 'media',
        prezzo_attuale: ultimo.prezzo,
        prezzo_riferimento: precedente?.prezzo ?? ultimo.prezzo,
        delta_percent: Math.round(ultimoDelta * 10000) / 100,
        data: ultimo.data_prezzo,
        descrizione: `Prezzo calato del ${Math.abs(ultimoDelta * 100).toFixed(1)}% rispetto alla rilevazione precedente`,
      })
    }

    if (volatilita > 0.15 && prices.length >= 4) {
      const deltaInflPct = safePctChange(ultimo.prezzo, prices[0]!)
      anomalie.push({
        prodotto, fornitore_id: fornitoreId, fornitore_nome: fornitoreNome,
        tipo: 'inflazione', gravita: volatilita > 0.25 ? 'alta' : 'media',
        prezzo_attuale: ultimo.prezzo,
        prezzo_riferimento: prices[0]!,
        delta_percent: deltaInflPct != null ? Math.round(deltaInflPct * 10000) / 100 : 0,
        data: ultimo.data_prezzo,
        descrizione: `Alta volatilità sui prezzi (${(volatilita * 100).toFixed(1)}%) — il costo oscilla frequentemente`,
      })
    }

    const giorniDaUltimo = Math.round(
      (Date.now() - new Date(ultimo.data_prezzo).getTime()) / (1000 * 60 * 60 * 24),
    )
    if (giorniDaUltimo > 90 && prices.length >= 2) {
      raccomandazioni.push({
        tipo: 'rinnovo', prodotto, fornitore_id: fornitoreId, fornitore_nome: fornitoreNome,
        titolo: `Listino da verificare: ${prodotto}`,
        descrizione: `Ultimo aggiornamento del prezzo per "${prodotto}" risale a ${giorniDaUltimo} giorni fa. Richiedere listino aggiornato al fornitore.`,
        priorita: giorniDaUltimo > 180 ? 'alta' : 'media',
        impatto_stimato: ultimo.prezzo * 0.03,
      })
    }

    if (ultimoDelta > 0.05) {
      raccomandazioni.push({
        tipo: 'ricontrattazione', prodotto, fornitore_id: fornitoreId, fornitore_nome: fornitoreNome,
        titolo: `Rinegoziazione consigliata: ${prodotto}`,
        descrizione: `Aumento del ${(ultimoDelta * 100).toFixed(1)}% rilevato. Valutare rinegoziazione con il fornitore o cercare alternative.`,
        priorita: ultimoDelta > 0.10 ? 'alta' : 'media',
        impatto_stimato: Math.round(ultimo.prezzo * ultimoDelta * 0.5 * 100) / 100,
      })
    }
  }

  const anomalieCritiche = anomalie.filter((a) => a.gravita === 'alta').length
  const raccomandazioniAlte = raccomandazioni.filter((r) => r.priorita === 'alta').length
  const risparmioPotenziale = raccomandazioni
    .filter((r) => r.impatto_stimato != null && r.priorita === 'alta')
    .reduce((a, r) => a + (r.impatto_stimato ?? 0), 0)

  const trendComplessivoRaw =
    countTrend > 0 ? Math.round((totaleTrend / countTrend) * 10000) / 100 : 0
  const trendComplessivo = Number.isFinite(trendComplessivoRaw) ? trendComplessivoRaw : 0
  const volatilitaMediaRaw =
    trends.length > 0
      ? Math.round((trends.reduce((a, t) => a + (Number.isFinite(t.volatilita) ? t.volatilita : 0), 0) / trends.length) * 100) / 100
      : 0
  const volatilitaMedia = Number.isFinite(volatilitaMediaRaw) ? volatilitaMediaRaw : 0

  const punteggioBase = 70
  const penalitaTrend = trendComplessivo > 0 ? Math.min(trendComplessivo * 50, 20) : 0
  const penalitaVolatilita = Math.min(volatilitaMedia * 100, 15)
  const penalitaAnomalie = Math.min(anomalieCritiche * 15, 30)
  const punteggioSaluteRaw = punteggioBase - penalitaTrend - penalitaVolatilita - penalitaAnomalie
  const punteggioSalute = Number.isFinite(punteggioSaluteRaw)
    ? Math.max(0, Math.min(100, punteggioSaluteRaw))
    : 50

  const salute: SupplierPriceHealth = {
    fornitore_id: fornitoreId,
    fornitore_nome: fornitoreNome,
    prodotti_analizzati: prodotti.size,
    trend_complessivo: trendComplessivo,
    volatilita_media: volatilitaMedia,
    anomalie_attive: anomalie.length,
    raccomandazioni_attive: raccomandazioni.length,
    punteggio_salute: Math.round(punteggioSalute),
    data_ultimo_aggiornamento: rawRows.reduce(
      (latest, r) => (r.data_prezzo > latest ? r.data_prezzo : latest),
      '',
    ) || null,
  }

  return {
    fornitore_id: fornitoreId,
    fornitore_nome: fornitoreNome,
    data_analisi: new Date().toISOString().slice(0, 10),
    trends,
    anomalie,
    raccomandazioni,
    salute,
    riepilogo: {
      totale_prodotti: prodotti.size,
      in_aumento: inAumento,
      in_calo: inCalo,
      stabili: stabili,
      anomalie_critiche: anomalieCritiche,
      raccomandazioni_alte: raccomandazioniAlte,
      risparmio_potenziale: Math.round(risparmioPotenziale * 100) / 100,
    },
  }
}

export type ProductSupplierPriceRow = {
  fornitore_id: string
  fornitore_nome: string
  prodotto: string
  prezzo_attuale: number
  data_prezzo: string
  num_rilevazioni: number
  variazione_percent: number | null
}

export type ProductPriceComparison = {
  query: string
  matches: ProductSupplierPriceRow[]
  prezzo_minimo: number | null
  fornitore_migliore_id: string | null
}

function escapeIlikeFragment(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function fornitoreNomeFromJoin(
  join: { nome: string; display_name?: string | null } | { nome: string; display_name?: string | null }[] | null | undefined,
): string {
  if (!join) return 'Sconosciuto'
  const row = Array.isArray(join) ? join[0] : join
  const display = row?.display_name?.trim()
  return display || row?.nome?.trim() || 'Sconosciuto'
}

/** Ultimo prezzo listino per fornitore su prodotti il cui nome contiene `query`. */
export async function compareProductPricesAcrossSuppliers(
  supabase: SupabaseClient,
  query: string,
  opts?: { sedeId?: string | null; limit?: number },
): Promise<ProductPriceComparison> {
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    return { query: trimmed, matches: [], prezzo_minimo: null, fornitore_migliore_id: null }
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const pattern = `%${escapeIlikeFragment(trimmed)}%`
  const rowLimit = Math.min(Math.max(opts?.limit ?? 400, 50), 800)

  const { data: rows, error } = await supabase
    .from('listino_prezzi')
    .select('id, fornitore_id, prodotto, prezzo, data_prezzo, note, fornitori(nome, display_name, sede_id)')
    .ilike('prodotto', pattern)
    .gt('prezzo', 0)
    .lte('data_prezzo', todayIso)
    .order('data_prezzo', { ascending: true })
    .limit(rowLimit)

  if (error || !rows?.length) {
    return { query: trimmed, matches: [], prezzo_minimo: null, fornitore_migliore_id: null }
  }

  type RawRow = PriceRow & {
    fornitori?: { nome: string; display_name?: string | null; sede_id?: string | null }
      | { nome: string; display_name?: string | null; sede_id?: string | null }[]
  }

  const byKey = new Map<string, { nome: string; prodotto: string; entries: RawRow[] }>()

  for (const row of rows as RawRow[]) {
    if (!isListinoCatalogRow({ prodotto: row.prodotto, note: row.note })) continue
    const join = row.fornitori
    const sedeId = Array.isArray(join) ? join[0]?.sede_id : join?.sede_id
    if (opts?.sedeId && sedeId !== opts.sedeId) continue

    const prodotto = row.prodotto.trim()
    const key = `${row.fornitore_id}|${prodotto.toLowerCase()}`
    const nome = fornitoreNomeFromJoin(join)
    const bucket = byKey.get(key)
    if (bucket) bucket.entries.push(row)
    else byKey.set(key, { nome, prodotto, entries: [row] })
  }

  const matches: ProductSupplierPriceRow[] = []

  for (const [key, bucket] of byKey) {
    const sorted = [...bucket.entries].sort((a, b) => a.data_prezzo.localeCompare(b.data_prezzo))
    const filtered = filterOutliersForTrend(sorted)
    const series = filtered.length >= 2 ? filtered : sorted
    const ultimo = series[series.length - 1]!
    const precedente = series.length >= 2 ? series[series.length - 2] : null
    const variazione = precedente
      ? safePctChange(ultimo.prezzo, precedente.prezzo)
      : null

    matches.push({
      fornitore_id: key.split('|')[0]!,
      fornitore_nome: bucket.nome,
      prodotto: bucket.prodotto,
      prezzo_attuale: ultimo.prezzo,
      data_prezzo: ultimo.data_prezzo,
      num_rilevazioni: series.length,
      variazione_percent: variazione != null ? Math.round(variazione * 10000) / 100 : null,
    })
  }

  matches.sort((a, b) => a.prezzo_attuale - b.prezzo_attuale)

  const prezzoMinimo = matches.length > 0 ? matches[0]!.prezzo_attuale : null
  const fornitoreMiglioreId = matches.length > 0 ? matches[0]!.fornitore_id : null

  return {
    query: trimmed,
    matches,
    prezzo_minimo: prezzoMinimo,
    fornitore_migliore_id: fornitoreMiglioreId,
  }
}

export async function analyzeAllSuppliers(
  supabase: SupabaseClient,
  fornitoreIds: string[],
): Promise<SupplierPriceHealth[]> {
  const results: SupplierPriceHealth[] = []
  for (const id of fornitoreIds) {
    try {
      const report = await analyzeSupplierPriceTrends(supabase, id)
      results.push(report.salute)
    } catch (err) {
      // Loggato: prima i fornitori sparivano silenziosamente dai conteggi
      // (visto: 41 fornitori in DB → 28 nei KPI per via di un catch silente
      // su divisioni-per-zero NaN). Ora il punteggio è sempre finito ma se
      // qualcosa esplode comunque vogliamo saperlo.
      console.warn('[price-intelligence] analyzeSupplierPriceTrends failed', { fornitoreId: id, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results.sort((a, b) => a.punteggio_salute - b.punteggio_salute)
}
