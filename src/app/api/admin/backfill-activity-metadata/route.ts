import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const service = createServiceClient()

  const { data: entries } = await service
    .from('activity_log')
    .select('id, created_at, metadata, sede_id, action')
    .eq('action', 'documento.processed')
    .order('created_at', { ascending: false })
    .limit(500)

  if (!entries?.length) {
    return NextResponse.json({ ok: true, message: 'Nessuna attività da elaborare.', backfilled: 0 })
  }

  let backfilled = 0
  const results: { id: string; fornitori: string[]; tipi: string[] }[] = []

  for (const entry of entries) {
    const meta = entry.metadata as Record<string, unknown> | null
    if (!meta) continue
    if (meta.fornitori) continue

    const entryTime = new Date(entry.created_at)
    const windowStart = new Date(entryTime.getTime() - 30_000).toISOString()
    const windowEnd = new Date(entryTime.getTime() + 30_000).toISOString()

    let fornitori: string[] = []
    let tipi: string[] = []

    if (meta.ai_reclassified === true) {
      let q = service
        .from('documenti_da_processare')
        .select('fornitore_id, metadata')
        .not('metadata->>ai_classified_at', 'is', null)
        .gte('metadata->>ai_classified_at', windowStart)
        .lte('metadata->>ai_classified_at', windowEnd)

      if (entry.sede_id) q = q.eq('sede_id', entry.sede_id)

      const { data: docs } = await q as { data: { fornitore_id: string | null; metadata: Record<string, unknown> | null }[] | null }

      if (docs?.length) {
        const fornitoreIds = [...new Set(docs.map(d => d.fornitore_id).filter(Boolean) as string[])]
        if (fornitoreIds.length > 0) {
          const { data: fData } = await service
            .from('fornitori')
            .select('nome')
            .in('id', fornitoreIds)
          if (fData) fornitori = fData.map(f => f.nome).filter(Boolean)
        }
        tipi = [...new Set(docs.map(d => (d.metadata?.pending_kind as string) ?? null).filter(Boolean) as string[])]
      }
    } else if (meta.reclassified === true) {
      let q = service
        .from('documenti_da_processare')
        .select('fornitore_id, metadata')
        .not('metadata->>pending_kind_reclassified_at', 'is', null)
        .gte('metadata->>pending_kind_reclassified_at', windowStart)
        .lte('metadata->>pending_kind_reclassified_at', windowEnd)

      if (entry.sede_id) q = q.eq('sede_id', entry.sede_id)

      const { data: docs } = await q as { data: { fornitore_id: string | null; metadata: Record<string, unknown> | null }[] | null }

      if (docs?.length) {
        const fornitoreIds = [...new Set(docs.map(d => d.fornitore_id).filter(Boolean) as string[])]
        if (fornitoreIds.length > 0) {
          const { data: fData } = await service
            .from('fornitori')
            .select('nome')
            .in('id', fornitoreIds)
          if (fData) fornitori = fData.map(f => f.nome).filter(Boolean)
        }
        tipi = [...new Set(docs.map(d => (d.metadata?.pending_kind as string) ?? null).filter(Boolean) as string[])]
      }
    }

    if (fornitori.length || tipi.length) {
      const { error: uErr } = await service
        .from('activity_log')
        .update({
          metadata: {
            ...meta,
            fornitori,
            tipi,
            backfilled: true,
          },
        })
        .eq('id', entry.id)

      if (!uErr) {
        backfilled++
        results.push({ id: entry.id, fornitori, tipi })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked: entries.length,
    backfilled,
    results,
  })
}
