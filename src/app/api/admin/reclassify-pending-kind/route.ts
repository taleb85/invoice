import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { inferPendingDocumentKindForQueueRow } from '@/lib/document-bozza-routing'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'

export const dynamic = 'force-dynamic'

const BATCH = 1000

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { profile } = auth
  const service = createServiceClient()

  let body: { sede_id?: string; limit?: number; pending_kind?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const limit = Math.min(body.limit ?? BATCH, 5000)

  let query = service
    .from('documenti_da_processare')
    .select('id, sede_id, fornitore_id, oggetto_mail, file_name, metadata, stato')
    .not('metadata', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (body.sede_id) {
    query = query.eq('sede_id', body.sede_id)
  }

  if (body.pending_kind) {
    query = query.filter('metadata->>pending_kind', 'eq', body.pending_kind)
  }

  const { data: docs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!docs?.length) return NextResponse.json({ ok: true, checked: 0, updated: 0, message: 'Nessun documento da riclassificare' })

  type DocRow = {
    id: string
    sede_id: string | null
    fornitore_id: string | null
    oggetto_mail: string | null
    file_name: string | null
    metadata: Record<string, unknown> | null
  }

  let updated = 0
  let skipped = 0
  const results: { id: string; from: string | null; to: string | null }[] = []

  for (const doc of docs as DocRow[]) {
    if (!doc.metadata) { skipped++; continue }

    const currentKind = (doc.metadata.pending_kind as string | undefined) ?? null

    const newKind = inferPendingDocumentKindForQueueRow({
      oggetto_mail: doc.oggetto_mail,
      file_name: doc.file_name,
      metadata: doc.metadata as Record<string, unknown>,
    })

    if (!newKind || newKind === currentKind) { skipped++; continue }

    const prevMeta = { ...doc.metadata }
    prevMeta.pending_kind = newKind
    prevMeta.pending_kind_reclassified_at = new Date().toISOString()
    prevMeta.pending_kind_reclassified_from = currentKind

    const { error: uErr } = await service
      .from('documenti_da_processare')
      .update({ metadata: prevMeta })
      .eq('id', doc.id)

    if (uErr) {
      results.push({ id: doc.id, from: currentKind, to: null })
      continue
    }

    results.push({ id: doc.id, from: currentKind, to: newKind })
    updated++
  }

  const fornitoreIds = [...new Set(docs.map(d => d.fornitore_id).filter(Boolean) as string[])]
  let fornitoreNames: string[] = []
  if (fornitoreIds.length > 0) {
    const { data: fornitori } = await service
      .from('fornitori')
      .select('nome')
      .in('id', fornitoreIds)
    if (fornitori) fornitoreNames = fornitori.map(f => f.nome).filter(Boolean)
  }
  const tipi = [...new Set(results.map(r => r.to).filter(Boolean) as string[])]

  await logActivity(service, {
    userId: profile.id,
    sedeId: body.sede_id ?? null,
    action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
    entityType: 'documenti_da_processare',
    metadata: {
      reclassified: true,
      checked: docs.length,
      updated,
      skipped,
      fornitori: fornitoreNames,
      tipi,
    },
  })

  return NextResponse.json({ ok: true, checked: docs.length, updated, skipped, results })
}
