import { NextResponse } from 'next/server'
import { getRequestAuth } from '@/utils/supabase/server'
import { getBollaForViewer, getFattureRowsForBollaAuthorized } from '@/lib/supabase-detail-for-viewer'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const { user, supabase } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bolla = await getBollaForViewer(id)
  if (!bolla) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [fatture, rekkiRes] = await Promise.all([
    getFattureRowsForBollaAuthorized(id),
    supabase.rpc('bolla_has_rekki_prezzo_flag', { p_bolla_id: id }),
  ])
  const rekkiPrezzoFlag = !rekkiRes.error && Boolean(rekkiRes.data)

  const fornitoreRekkiId = bolla.fornitore?.rekki_supplier_id?.trim()
  let listinoRows: { prodotto: string; prezzo: number; data_prezzo: string }[] = []
  if (fornitoreRekkiId) {
    const { data } = await supabase
      .from('listino_prezzi')
      .select('prodotto, prezzo, data_prezzo')
      .eq('fornitore_id', bolla.fornitore_id)
      .order('data_prezzo', { ascending: false })
      .limit(24)
    listinoRows = (data ?? []) as typeof listinoRows
  }

  return NextResponse.json({ bolla, fatture, rekkiPrezzoFlag, listinoRows })
}
