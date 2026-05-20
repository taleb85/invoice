import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { recordFornitorePendingKindHint } from '@/lib/fornitore-doc-type-hints'

export const dynamic = 'force-dynamic'

/**
 * POST /api/fornitori/[id]/converti-ordini-in-bolle
 *
 * Converts conferme_ordine records to bolle for a supplier.
 * Optionally updates the learned hint so future documents are classified as bolle.
 *
 * Body: { ids: string[], sede_id: string | null, update_hint: boolean }
 *   ids          — IDs from conferme_ordine to convert (if empty, converts ALL)
 *   sede_id      — sede for new bolla rows
 *   update_hint  — if true, saves pending_kind='bolla' for ocr_tipo_key='ordine' for this supplier
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { id: fornitoreId } = await params
    if (!fornitoreId) return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })

    const body = await req.json() as { ids?: string[]; sede_id?: string | null; update_hint?: boolean }
    const sedeId = body.sede_id ?? null
    const updateHint = body.update_hint !== false

    const supabase = createServiceClient()

    // Fetch the records to convert
    let query = supabase
      .from('conferme_ordine')
      .select('id, file_url, file_name, titolo, data_ordine, sede_id')
      .eq('fornitore_id', fornitoreId)

    const ids = body.ids ?? []
    if (ids.length > 0) query = query.in('id', ids)

    const { data: conferme, error: fetchErr } = await query
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!conferme?.length) return NextResponse.json({ converted: 0 })

    // Insert into bolle
    const bolleRows = conferme.map((c) => ({
      fornitore_id: fornitoreId,
      sede_id: c.sede_id ?? sedeId,
      file_url: c.file_url,
      numero_bolla: c.titolo ?? null,
      data: c.data_ordine ?? null,
    }))

    const { error: insErr } = await supabase.from('bolle').insert(bolleRows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    // Delete from conferme_ordine
    const convertedIds = conferme.map((c) => c.id)
    const { error: delErr } = await supabase
      .from('conferme_ordine')
      .delete()
      .in('id', convertedIds)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // Update learned hint so future docs are also classified as bolle
    if (updateHint) {
      await recordFornitorePendingKindHint(supabase, {
        fornitoreId,
        ocrTipoKey: 'ordine',
        pendingKind: 'bolla',
      })
    }

    return NextResponse.json({ converted: convertedIds.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
