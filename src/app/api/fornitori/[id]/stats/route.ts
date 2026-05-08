import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { analyzeFatturaDuplicatesForDeletion } from '@/lib/check-duplicates'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const fornitoreId = req.nextUrl.searchParams.get('fornitore_id')
  if (!fornitoreId) {
    return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
  }

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from e to richiesti' }, { status: 400 })
  }

  const service = createServiceClient()

  const [
    bolleRes,
    bolleAperteRes,
    fattureRes,
    listinoRes,
    stmtsRes,
    ordiniRes,
    anomalieRes,
    pendingRes,
  ] = await Promise.all([
    service.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).gte('data', from).lt('data', to),
    service.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).eq('stato', 'in attesa').gte('data', from).lt('data', to),
    service.from('fatture').select('id, data, importo, numero_fattura').eq('fornitore_id', fornitoreId).gte('data', from).lt('data', to),
    service.from('listino_prezzi').select('prodotto').eq('fornitore_id', fornitoreId).gte('data_prezzo', from).lt('data_prezzo', to).limit(8000),
    service.from('statements').select('missing_rows, received_at, extracted_pdf_dates').eq('fornitore_id', fornitoreId).order('received_at', { ascending: false }).limit(800),
    service.from('conferme_ordine').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).gte('created_at', from).lt('created_at', to),
    service.from('price_anomalies').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).eq('resolved', false),
    service.from('documenti_da_processare').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).in('stato', ['in_attesa', 'da_processare', 'da_associare']).gte('created_at', from).lt('created_at', to),
  ])

  const fattureRows = (fattureRes.data ?? []) as { importo: number | null }[]
  const totaleSpesaLordo = fattureRows.reduce((s, f) => s + (f.importo ?? 0), 0)
  const dup = analyzeFatturaDuplicatesForDeletion(
    (fattureRes.data ?? []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      data: f.data as string,
      importo: f.importo as number | null,
      fornitore_id: fornitoreId,
      numero_fattura: f.numero_fattura as string | null,
    }))
  )
  const totaleSpesa = Math.max(0, totaleSpesaLordo - dup.surplusImporto)

  const listinoRowsData = (listinoRes.data ?? []) as { prodotto: string }[]
  const listinoRows = listinoRowsData.length
  const listinoProdottiDistinti = new Set(listinoRowsData.map((r) => String(r.prodotto ?? '').trim()).filter(Boolean)).size

  const stmtData = (stmtsRes.data ?? []) as { missing_rows: number | null; received_at: string; extracted_pdf_dates: unknown }[]
  const statementsInPeriod = stmtData.filter((s) => {
    const d = s.received_at?.slice(0, 10)
    return d && d >= from && d < to
  }).length
  const statementsWithIssues = stmtData.filter((s) => (s.missing_rows ?? 0) > 0).length

  return NextResponse.json({
    bolleTotal: bolleRes.count ?? 0,
    bolleAperte: bolleAperteRes.count ?? 0,
    fattureTotal: fattureRes.count ?? 0,
    ordiniNelPeriodo: ordiniRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    totaleSpesaLordo,
    totaleSpesa,
    listinoRows,
    listinoProdottiDistinti,
    statementsInPeriod,
    statementsWithIssues,
    rekkiPriceAnomalies: 0,
    listinoAnomaliesCount: anomalieRes.count ?? 0,
  })
}
