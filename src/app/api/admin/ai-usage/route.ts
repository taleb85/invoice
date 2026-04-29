import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { GEMINI_PRICING, getGeminiModelId } from '@/lib/gemini-vision'

export const dynamic = 'force-dynamic'

type UsageRow = {
  id: string
  sede_id: string | null
  documento_id: string | null
  model: string | null
  tokens_input: number | null
  tokens_output: number | null
  costo_usd: number | string | null
  tipo: string | null
  created_at: string
}

function parseFlexibleInstant(raw: string | null): Date | null {
  const s = raw?.trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Inclusive UTC day bounds from YYYY-MM-DD strings. */
function boundsFromDates(fromRaw: string | null, toRaw: string | null): { fromTs: string; toInclusive: string } {
  const now = new Date()
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const from =
    fromRaw?.trim().slice(0, 10) && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw!.trim())
      ? fromRaw!.trim().slice(0, 10)
      : `${ym}-01`
  const toDefault = now.toISOString().slice(0, 10)
  const to =
    toRaw?.trim().slice(0, 10) && /^\d{4}-\d{2}-\d{2}$/.test(toRaw!.trim())
      ? toRaw!.trim().slice(0, 10)
      : toDefault

  const fromTs = `${from}T00:00:00.000Z`
  let toDay = to
  if (toDay < from) toDay = from
  const toInclusive = `${toDay}T23:59:59.999Z`

  return { fromTs, toInclusive }
}

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile || String(profile.role ?? '').toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const sedeRequested = sp.get('sede_id')?.trim() || ''

  /** Preciso (es. "Oggi" = inizio giornata locale → ora) */
  const afterInst = parseFlexibleInstant(sp.get('after'))
  const beforeInst = parseFlexibleInstant(sp.get('before'))

  let fromTs: string
  let toUpper: string /** upper bound inclusivo per lte */
  let rangeMode: 'instant' | 'day' = 'day'

  if (afterInst && beforeInst && beforeInst.getTime() >= afterInst.getTime()) {
    fromTs = afterInst.toISOString()
    toUpper = beforeInst.toISOString()
    rangeMode = 'instant'
  } else {
    const b = boundsFromDates(sp.get('from'), sp.get('to'))
    fromTs = b.fromTs
    toUpper = b.toInclusive
  }

  const service = createServiceClient()
  let query = service
    .from('ai_usage_log')
    .select(
      'id, sede_id, documento_id, model, tokens_input, tokens_output, costo_usd, tipo, created_at',
    )
    .gte('created_at', fromTs)
    .lte('created_at', toUpper)
    .order('created_at', { ascending: false })
    .limit(8000)

  if (sedeRequested) {
    query = query.eq('sede_id', sedeRequested)
  }

  const { data, error } = await query

  if (error) {
    console.error('[ai-usage]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as UsageRow[]
  let tokensInput = 0
  let tokensOutput = 0
  let costoTotaleUsd = 0
  const dailyMap: Record<
    string,
    {
      calls: number
      callsWithOutputTokens: number
      tokens: number
      tokensIn: number
      tokensOut: number
      costUsd: number
    }
  > = {}
  const sedeMap: Record<
    string,
    { calls: number; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number }
  > = {}

  for (const r of rows) {
    const ti = Number(r.tokens_input ?? 0)
    const to = Number(r.tokens_output ?? 0)
    const rowCost = typeof r.costo_usd === 'number' ? r.costo_usd : Number(r.costo_usd ?? 0)
    tokensInput += ti
    tokensOutput += to
    costoTotaleUsd += Number.isFinite(rowCost) ? rowCost : 0

    const day = r.created_at.slice(0, 10)
    if (!dailyMap[day]) {
      dailyMap[day] = {
        calls: 0,
        callsWithOutputTokens: 0,
        tokens: 0,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
      }
    }
    dailyMap[day].calls++
    if (to > 0) dailyMap[day].callsWithOutputTokens++
    dailyMap[day].tokens += ti + to
    dailyMap[day].tokensIn += ti
    dailyMap[day].tokensOut += to
    dailyMap[day].costUsd += Number.isFinite(rowCost) ? rowCost : 0

    const sedeKey = r.sede_id ?? '__unknown__'
    if (!sedeMap[sedeKey]) {
      sedeMap[sedeKey] = {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      }
    }
    sedeMap[sedeKey].calls++
    sedeMap[sedeKey].inputTokens += ti
    sedeMap[sedeKey].outputTokens += to
    sedeMap[sedeKey].totalTokens += ti + to
    sedeMap[sedeKey].costUsd += Number.isFinite(rowCost) ? rowCost : 0
  }

  const scansioni_totali = rows.length
  const costo_totale_usd = Math.round(costoTotaleUsd * 1_000_000) / 1_000_000
  const costo_per_scan = scansioni_totali > 0 ? Math.round((costoTotaleUsd / scansioni_totali) * 1_000_000) / 1_000_000 : 0

  const chronological = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const breakdown = chronological.map(r => ({
    id: r.id,
    data: r.created_at,
    tipo: r.tipo,
    sede_id: r.sede_id,
    tokens_input: Number(r.tokens_input ?? 0),
    tokens_output: Number(r.tokens_output ?? 0),
    costo_usd:
      typeof r.costo_usd === 'number'
        ? Math.round(Number(r.costo_usd) * 100_000_000) / 100_000_000
        : Number(r.costo_usd ?? 0),
  }))

  const daily = Object.entries(dailyMap)
    .map(([date, v]) => {
      const calls = v.calls
      const success_rate =
        calls > 0 ? Math.round((100 * v.callsWithOutputTokens) / calls * 100) / 100 : 0
      return {
        date,
        count: calls,
        calls,
        tokens: v.tokens,
        tokensInput: v.tokensIn,
        tokensOutput: v.tokensOut,
        success_rate,
        costUsd: Math.round(v.costUsd * 1_000_000) / 1_000_000,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const knownIds = Object.keys(sedeMap).filter(k => k !== '__unknown__')
  const nomeById: Record<string, string> = {}
  if (knownIds.length) {
    const { data: sedi } = await service.from('sedi').select('id, nome').in('id', knownIds)
    if (sedi) {
      for (const s of sedi) nomeById[s.id as string] = String((s as { nome?: string }).nome ?? s.id)
    }
  }

  const perSede = Object.entries(sedeMap)
    .map(([sedeId, agg]) => ({
      sedeId: sedeId === '__unknown__' ? null : sedeId,
      nome: sedeId === '__unknown__' ? 'Sede non attribuita' : (nomeById[sedeId] ?? sedeId),
      calls: agg.calls,
      inputTokens: agg.inputTokens,
      outputTokens: agg.outputTokens,
      totalTokens: agg.totalTokens,
      costUsd: Math.round(agg.costUsd * 1_000_000) / 1_000_000,
    }))
    .sort((a, b) => b.calls - a.calls)

  const recent = rows.slice(0, 80).map(r => ({
    created_at: r.created_at,
    user_id: '',
    operation: r.model ?? getGeminiModelId(),
    intent: r.tipo ?? '',
    inputTokens: Number(r.tokens_input ?? 0),
    outputTokens: Number(r.tokens_output ?? 0),
    estimatedCostUsd:
      typeof r.costo_usd === 'number' ? Number(r.costo_usd) : Number(r.costo_usd ?? 0),
  }))

  return NextResponse.json(
    {
      ok: true,
      period: {
        start: fromTs,
        end: toUpper,
        range_mode: rangeMode,
        label_from_date: fromTs.slice(0, 10),
        label_to_date: toUpper.slice(0, 10),
      },
      model: getGeminiModelId(),
      pricing: GEMINI_PRICING,
      scansioni_totali,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      tokens_totali: tokensInput + tokensOutput,
      costo_totale_usd,
      costo_per_scan,
      breakdown,
      daily,
      perSede,
      recent,
      totalCalls: scansioni_totali,
      totalInputTokens: tokensInput,
      totalOutputTokens: tokensOutput,
      totalTokens: tokensInput + tokensOutput,
      totalCostUsd: costo_totale_usd,
      avgCostPerScan: costo_per_scan,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

async function wipeAiUsageLogViaPostgrest(
  service: ReturnType<typeof createServiceClient>,
): Promise<{ deleted: number | null; mode: 'rpc' | 'filter' } | { error: string }> {
  const rpc = await service.rpc('delete_all_ai_usage_log')

  if (!rpc.error && rpc.data !== null && rpc.data !== undefined) {
    const raw = rpc.data
    const n =
      typeof raw === 'bigint'
        ? Number(raw)
        : typeof raw === 'string'
          ? Number(raw)
          : typeof raw === 'number'
            ? raw
            : null
    const deleted = n != null && Number.isFinite(n) ? Math.trunc(n) : 0
    return { deleted, mode: 'rpc' }
  }

  /** `tokens_input NOT NULL`; intero valido incluso anche con valori di default: match su tutta la tabella. */
  const { error: e1, count: c1 } = await service
    .from('ai_usage_log')
    .delete({ count: 'exact' })
    .gte('tokens_input', -1)

  if (!e1) {
    return { deleted: typeof c1 === 'number' ? c1 : null, mode: 'filter' }
  }

  console.error('[ai-usage-delete]', e1.message)

  const { error: e2, count: c2 } = await service
    .from('ai_usage_log')
    .delete({ count: 'exact' })
    .gte('tokens_output', -1)

  if (!e2) {
    return { deleted: typeof c2 === 'number' ? c2 : null, mode: 'filter' }
  }

  console.error('[ai-usage-delete] fallback', e2.message)
  return { error: e2.message ?? e1.message ?? 'Eliminazione non riuscita' }
}

/** Elimina tutte le righe di `ai_usage_log` (solo admin, service role). */
export async function DELETE() {
  const profile = await getProfile()
  if (!profile || String(profile.role ?? '').toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const service = createServiceClient()
  const result = await wipeAiUsageLogViaPostgrest(service)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(
    { ok: true, deleted: result.deleted, mode: result.mode },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
