import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { analyzeSupplierPriceTrends, analyzeAllSuppliers } from '@/lib/price-intelligence'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const service = createServiceClient()
  const { searchParams } = new URL(req.url)
  const fornitoreId = searchParams.get('fornitore_id')

  if (fornitoreId) {
    const report = await analyzeSupplierPriceTrends(service, fornitoreId)
    return NextResponse.json(report)
  }

  const { data: fornitori } = await service
    .from('listino_prezzi')
    .select('fornitore_id')
    .order('data_prezzo', { ascending: false })

  if (!fornitori?.length) {
    return NextResponse.json({ suppliers: [], totali: 0 })
  }

  const allFornitoreIds = [
    ...new Set(fornitori.map((r: { fornitore_id: string }) => r.fornitore_id)),
  ]

  /*
   * Escludi fornitori marcati come "non comparabili": canoni, manutenzioni,
   * lavanderie, servizi a chiamata. I loro "prodotti" sono interventi e i
   * prezzi non rappresentano un listino che evolve nel tempo — generano
   * falsa volatilità e gonfiano i bucket "critici". Lista gestita in
   * `fornitori.escluso_da_analisi_prezzi`.
   */
  const { data: esclusiRows } = await service
    .from('fornitori')
    .select('id')
    .eq('escluso_da_analisi_prezzi', true)
  const esclusiIds = new Set((esclusiRows ?? []).map((r) => r.id as string))
  const fornitoreIds = allFornitoreIds.filter((id) => !esclusiIds.has(id)).slice(0, 50)
  const results = await analyzeAllSuppliers(service, fornitoreIds)

  return NextResponse.json({
    suppliers: results,
    totali: results.length,
    critici: results.filter((s) => s.punteggio_salute < 50).length,
    attenzione: results.filter((s) => s.punteggio_salute >= 50 && s.punteggio_salute < 70).length,
    ok: results.filter((s) => s.punteggio_salute >= 70).length,
  })
}
