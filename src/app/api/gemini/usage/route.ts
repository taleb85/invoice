import { NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'
import { GEMINI_MODEL, GEMINI_PRICING } from '@/lib/gemini-vision'

export const dynamic = 'force-dynamic'

interface LogRow {
  created_at: string
  user_id: string
  sede_id: string | null
  metadata: Record<string, unknown> | null
}

interface SedeAgg {
  calls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
}

export async function GET() {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  if (!isMaster) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data, error } = await service
    .from('activity_log')
    .select('created_at, metadata, user_id, sede_id')
    .eq('action', 'gemini.ocr')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as LogRow[]

  // ── Global aggregates ──────────────────────────────────────────────────────
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0
  const dailyMap: Record<string, { calls: number; tokens: number; costUsd: number }> = {}
  const sedeMap: Record<string, SedeAgg> = {}

  for (const row of rows) {
    const meta = row.metadata
    if (!meta) continue

    const input = Number(meta.inputTokens ?? 0)
    const output = Number(meta.outputTokens ?? 0)
    const cost = Number(meta.estimatedCostUsd ?? 0)

    totalInputTokens += input
    totalOutputTokens += output
    totalCostUsd += cost

    // Daily buckets
    const day = row.created_at.slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { calls: 0, tokens: 0, costUsd: 0 }
    dailyMap[day].calls++
    dailyMap[day].tokens += input + output
    dailyMap[day].costUsd += cost

    // Per-sede: prefer the activity_log.sede_id column; fall back to metadata.sedeId
    const sedeId =
      row.sede_id?.trim() ||
      (typeof meta.sedeId === 'string' ? meta.sedeId.trim() : null) ||
      '__unknown__'
    if (!sedeMap[sedeId]) {
      sedeMap[sedeId] = { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 }
    }
    sedeMap[sedeId].calls++
    sedeMap[sedeId].inputTokens += input
    sedeMap[sedeId].outputTokens += output
    sedeMap[sedeId].totalTokens += input + output
    sedeMap[sedeId].costUsd += cost
  }

  const totalCalls = rows.length
  const avgCostPerScan = totalCalls > 0 ? totalCostUsd / totalCalls : 0

  const daily = Object.entries(dailyMap)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  const recent = rows.slice(0, 50).map((r) => ({
    created_at: r.created_at,
    user_id: r.user_id,
    sede_id: r.sede_id,
    operation: String(r.metadata?.operation ?? 'ocr'),
    intent: String(r.metadata?.intent ?? ''),
    inputTokens: Number(r.metadata?.inputTokens ?? 0),
    outputTokens: Number(r.metadata?.outputTokens ?? 0),
    estimatedCostUsd: Number(r.metadata?.estimatedCostUsd ?? 0),
  }))

  // ── Per-sede breakdown ─────────────────────────────────────────────────────
  const knownSedeIds = Object.keys(sedeMap).filter((id) => id !== '__unknown__')

  let sedeNomi: Record<string, string> = {}
  if (knownSedeIds.length > 0) {
    const { data: sedi } = await service
      .from('sedi')
      .select('id, nome')
      .in('id', knownSedeIds)
    if (sedi) {
      for (const s of sedi) sedeNomi[s.id] = s.nome
    }
  }

  const perSede = Object.entries(sedeMap)
    .map(([sedeId, agg]) => ({
      sedeId: sedeId === '__unknown__' ? null : sedeId,
      nome:
        sedeId === '__unknown__'
          ? 'Sede non identificata'
          : (sedeNomi[sedeId] ?? sedeId),
      calls: agg.calls,
      inputTokens: agg.inputTokens,
      outputTokens: agg.outputTokens,
      totalTokens: agg.totalTokens,
      costUsd: Math.round(agg.costUsd * 1_000_000) / 1_000_000,
    }))
    .sort((a, b) => b.calls - a.calls)

  return NextResponse.json({
    ok: true,
    model: GEMINI_MODEL,
    pricing: GEMINI_PRICING,
    totalCalls,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
    avgCostPerScan: Math.round(avgCostPerScan * 1_000_000) / 1_000_000,
    daily,
    recent,
    perSede,
  })
}
