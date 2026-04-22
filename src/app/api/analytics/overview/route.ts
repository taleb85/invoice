import { NextRequest, NextResponse } from 'next/server'
import { createClient, getProfile } from '@/utils/supabase/server'
import { fiscalYearRangeUtc } from '@/lib/fiscal-year'

export type SpesaMensileItem = { mese: string; importo: number; fatture: number }
export type TopFornitoreItem = { nome: string; importo: number; fatture: number }
export type AndamentoBolleItem = { mese: string; bolle: number; fatture: number }

export type AnalyticsOverview = {
  spesaMensile: SpesaMensileItem[]
  topFornitori: TopFornitoreItem[]
  riconciliazione: { completate: number; inAttesa: number; percentuale: number }
  tempoMedioRiconciliazione: number
  anomaliePrezzi: { totale: number; risolte: number; percentuale: number }
  documentiPendenti: number
  andamentoBolle: AndamentoBolleItem[]
}

function monthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // YYYY-MM
}

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile || !['admin', 'admin_sede'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  try {
  const { searchParams } = new URL(req.url)
  const sedeId = searchParams.get('sede_id') || null
  const monthsCount = Math.min(24, Math.max(1, parseInt(searchParams.get('months') ?? '6', 10)))
  const fyParam = searchParams.get('fy')
  const fyYear = fyParam ? parseInt(fyParam, 10) : null

  const supabase = await createClient()
  const now = new Date()

  // Date range: FY-anchored when fy is set, rolling window otherwise
  let dateFromStr: string
  let dateToStr: string

  if (fyYear && Number.isFinite(fyYear) && sedeId) {
    const { data: sedeRow } = await supabase
      .from('sedi')
      .select('country_code')
      .eq('id', sedeId)
      .maybeSingle()
    const countryCode = (sedeRow?.country_code ?? 'IT').trim() || 'IT'
    const { start: fyStart, endExclusive: fyEnd } = fiscalYearRangeUtc(countryCode, fyYear)
    // Offset end = FY start + monthsCount months
    const periodEnd = new Date(
      fyStart.getUTCFullYear(),
      fyStart.getUTCMonth() + monthsCount,
      fyStart.getUTCDate(),
    )
    // Cap at FY end (exclusive → subtract 1 day) and today
    const fyEndInclusive = new Date(fyEnd.getTime() - 86_400_000)
    const today = new Date()
    const actualEnd = new Date(Math.min(periodEnd.getTime() - 86_400_000, fyEndInclusive.getTime(), today.getTime()))
    dateFromStr = fyStart.toISOString().split('T')[0]!
    dateToStr = actualEnd.toISOString().split('T')[0]!
  } else {
    // Rolling: last N full months up to today
    const dateFrom = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1)
    dateFromStr = dateFrom.toISOString().split('T')[0]!
    dateToStr = now.toISOString().split('T')[0]!
  }

  // Run all queries in parallel
  const [fattureRes, bolleRes, anomalieTotaleRes, anomalieRisolteRes, documentiRes] =
    await Promise.all([
      (() => {
        let q = supabase
          .from('fatture')
          .select('id, data, importo, fornitore_id, bolla_id, fornitori(nome, display_name)')
          .gte('data', dateFromStr)
          .lte('data', dateToStr)
          .limit(5000)
        if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
        return q
      })(),
      (() => {
        let q = supabase
          .from('bolle')
          .select('id, data, importo, fornitore_id, stato')
          .gte('data', dateFromStr)
          .lte('data', dateToStr)
          .limit(5000)
        if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
        return q
      })(),
      (() => {
        let q = supabase
          .from('price_anomalies')
          .select('id', { count: 'exact', head: true })
        if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
        return q
      })(),
      (() => {
        let q = supabase
          .from('price_anomalies')
          .select('id', { count: 'exact', head: true })
          .eq('resolved', true)
        if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
        return q
      })(),
      (() => {
        let q = supabase
          .from('documenti_da_processare')
          .select('id', { count: 'exact', head: true })
          .in('stato', ['in_attesa', 'da_associare'])
        if (sedeId) q = q.eq('sede_id', sedeId) as typeof q
        return q
      })(),
    ])

    // Log Supabase errors (non-fatal — fall back to empty data)
    const errors = [
      fattureRes.error && `fatture: ${fattureRes.error.message}`,
      bolleRes.error && `bolle: ${bolleRes.error.message}`,
      anomalieTotaleRes.error && `anomalie_tot: ${anomalieTotaleRes.error.message}`,
      anomalieRisolteRes.error && `anomalie_ris: ${anomalieRisolteRes.error.message}`,
      documentiRes.error && `documenti: ${documentiRes.error.message}`,
    ].filter(Boolean)
    if (errors.length) console.error('[analytics/overview] Supabase errors:', errors.join(' | '))


    id: string
    data: string
    importo: number | null
    fornitore_id: string | null
    bolla_id: string | null
    fornitori: { nome?: string | null; display_name?: string | null } | null
  }
  type BollaRow = {
    id: string
    data: string
    importo: number | null
    fornitore_id: string | null
    stato: string | null
  }

  const fatture = (fattureRes.data ?? []) as FatturaRow[]
  const bolle = (bolleRes.data ?? []) as BollaRow[]

  // ── spesaMensile ──────────────────────────────────────────────────
  const spesaMap = new Map<string, { importo: number; fatture: number; label: string }>()
  for (const f of fatture) {
    if (!f.data) continue
    const key = monthKey(f.data)
    const entry = spesaMap.get(key) ?? { importo: 0, fatture: 0, label: monthLabel(f.data) }
    entry.importo += f.importo ?? 0
    entry.fatture += 1
    spesaMap.set(key, entry)
  }

  // Fill months with no data — use dateFromStr as anchor (works for both rolling and FY mode)
  const fillBase = new Date(dateFromStr + 'T00:00:00Z')
  for (let i = 0; i < monthsCount; i++) {
    const d = new Date(fillBase.getUTCFullYear(), fillBase.getUTCMonth() + i, 1)
    const key = d.toISOString().slice(0, 7)
    if (!spesaMap.has(key)) {
      spesaMap.set(key, {
        importo: 0,
        fatture: 0,
        label: d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
      })
    }
  }

  const spesaMensile: SpesaMensileItem[] = [...spesaMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ mese: v.label, importo: Math.round(v.importo * 100) / 100, fatture: v.fatture }))

  // ── topFornitori ──────────────────────────────────────────────────
  const fornitoriMap = new Map<string, { nome: string; importo: number; fatture: number }>()
  for (const f of fatture) {
    if (!f.fornitore_id) continue
    const fn = f.fornitori
    const nome =
      (typeof fn === 'object' && fn !== null
        ? ((fn as { display_name?: string | null; nome?: string | null }).display_name?.trim() ||
          (fn as { nome?: string | null }).nome?.trim())
        : null) ?? f.fornitore_id
    const entry = fornitoriMap.get(f.fornitore_id) ?? { nome, importo: 0, fatture: 0 }
    entry.importo += f.importo ?? 0
    entry.fatture += 1
    fornitoriMap.set(f.fornitore_id, entry)
  }

  const topFornitori: TopFornitoreItem[] = [...fornitoriMap.values()]
    .sort((a, b) => b.importo - a.importo)
    .slice(0, 8)
    .map((v) => ({ nome: v.nome, importo: Math.round(v.importo * 100) / 100, fatture: v.fatture }))

  // ── riconciliazione ──────────────────────────────────────────────
  const bolleCompletate = bolle.filter((b) => b.stato === 'completato').length
  const bolleInAttesa = bolle.filter((b) => b.stato === 'in attesa').length
  const totaleBolle = bolle.length
  const percentualeRic = totaleBolle > 0 ? Math.round((bolleCompletate / totaleBolle) * 100) : 0

  // ── tempoMedioRiconciliazione ─────────────────────────────────────
  const fattureConBolla = fatture.filter((f) => f.bolla_id && f.data)
  let tempoMedioRiconciliazione = 0
  if (fattureConBolla.length > 0) {
    const bollaIds = [...new Set(fattureConBolla.map((f) => f.bolla_id!))]
    const { data: bolleLinked } = await supabase
      .from('bolle')
      .select('id, data')
      .in('id', bollaIds.slice(0, 500))

    if (bolleLinked?.length) {
      const bollaDateMap = new Map((bolleLinked as { id: string; data: string }[]).map((b) => [b.id, b.data]))
      let totalDays = 0
      let count = 0
      for (const f of fattureConBolla) {
        const bollaData = bollaDateMap.get(f.bolla_id!)
        if (!bollaData || !f.data) continue
        const diffMs =
          new Date(f.data + 'T00:00:00').getTime() - new Date(bollaData + 'T00:00:00').getTime()
        const diffDays = Math.abs(diffMs / (1000 * 60 * 60 * 24))
        if (Number.isFinite(diffDays)) {
          totalDays += diffDays
          count++
        }
      }
      tempoMedioRiconciliazione = count > 0 ? Math.round(totalDays / count) : 0
    }
  }

  // ── anomaliePrezzi ────────────────────────────────────────────────
  const anomalieTotale = anomalieTotaleRes.count ?? 0
  const anomalieRisolte = anomalieRisolteRes.count ?? 0
  const anomaliePercentuale =
    anomalieTotale > 0 ? Math.round((anomalieRisolte / anomalieTotale) * 100) : 100

  // ── andamentoBolle ────────────────────────────────────────────────
  const bollePerMese = new Map<string, { bolle: number; label: string }>()
  const fatturePerMese = new Map<string, { fatture: number; label: string }>()

  for (const b of bolle) {
    if (!b.data) continue
    const key = monthKey(b.data)
    const entry = bollePerMese.get(key) ?? { bolle: 0, label: monthLabel(b.data) }
    entry.bolle += 1
    bollePerMese.set(key, entry)
  }
  for (const f of fatture) {
    if (!f.data) continue
    const key = monthKey(f.data)
    const entry = fatturePerMese.get(key) ?? { fatture: 0, label: monthLabel(f.data) }
    entry.fatture += 1
    fatturePerMese.set(key, entry)
  }

  const allMonthKeys = new Set([...bollePerMese.keys(), ...fatturePerMese.keys()])
  for (let i = 0; i < monthsCount; i++) {
    const d = new Date(fillBase.getUTCFullYear(), fillBase.getUTCMonth() + i, 1)
    allMonthKeys.add(d.toISOString().slice(0, 7))
  }

  const andamentoBolle: AndamentoBolleItem[] = [...allMonthKeys]
    .sort()
    .filter((k) => k >= dateFromStr.slice(0, 7))
    .map((key) => {
      const bEntry = bollePerMese.get(key)
      const fEntry = fatturePerMese.get(key)
      const label =
        bEntry?.label ??
        fEntry?.label ??
        new Date(key + '-01T00:00:00').toLocaleDateString('it-IT', {
          month: 'short',
          year: '2-digit',
        })
      return { mese: label, bolle: bEntry?.bolle ?? 0, fatture: fEntry?.fatture ?? 0 }
    })

  const result: AnalyticsOverview = {
    spesaMensile,
    topFornitori,
    riconciliazione: {
      completate: bolleCompletate,
      inAttesa: bolleInAttesa,
      percentuale: percentualeRic,
    },
    tempoMedioRiconciliazione,
    anomaliePrezzi: {
      totale: anomalieTotale,
      risolte: anomalieRisolte,
      percentuale: anomaliePercentuale,
    },
    documentiPendenti: documentiRes.count ?? 0,
    andamentoBolle,
  }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[analytics/overview] Unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
