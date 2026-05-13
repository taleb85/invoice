import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

type KindStats = {
  kind: string
  label: string
  icon: string
  table: string
  count: number
}

export async function GET(req: NextRequest) {
  const service = createServiceClient()
  const { searchParams } = new URL(req.url)
  const sedeId = searchParams.get('sede_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  const dateFrom = year && month
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : null
  const dateTo = dateFrom
    ? new Date(Number(year), Number(month), 1).toISOString().split('T')[0]
    : null

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const scope = <T>(q: T, field: string): T => {
    if (!sedeId) return q
    return (q as any).eq(field, sedeId) as T
  }

  const dateFilter = <T>(q: T, field: string): T => {
    if (!dateFrom) return q
    let qq = (q as any).gte(field, dateFrom) as T
    if (dateTo) qq = (qq as any).lt(field, dateTo) as T
    return qq
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const [
    fattureRes,
    noteCreditoRes,
    bolleRes,
    ordiniRes,
    potenzialiRes,
  ] = await Promise.all([
    dateFilter(scope(service.from('fatture').select('*', { count: 'exact', head: true }).eq('is_credit_note', false), 'sede_id'), 'data'),
    dateFilter(scope(service.from('fatture').select('*', { count: 'exact', head: true }).eq('is_credit_note', true), 'sede_id'), 'data'),
    dateFilter(scope(service.from('bolle').select('*', { count: 'exact', head: true }), 'sede_id'), 'data'),
    dateFilter(scope(service.from('conferme_ordine').select('*', { count: 'exact', head: true }), 'sede_id'), 'data_ordine'),
    scope(service.from('comunicazioni_fornitori_potenziali').select('*', { count: 'exact', head: true }), 'sede_id'),
  ])

  const CodaKinds = ['fattura', 'bolla', 'statement', 'ordine', 'nota_credito', 'comunicazione', 'listino']
  const codaKindCounts: Record<string, number> = {}

  for (const kind of CodaKinds) {
    let q = service.from('documenti_da_processare').select('*', { count: 'exact', head: true })
      .filter('metadata->>pending_kind', 'eq', kind)
    if (sedeId) q = q.eq('sede_id', sedeId)
    const { count } = await q
    codaKindCounts[kind] = count ?? 0
  }

  // Coda totale (qualsiasi pending_kind) in tutta la tabella
  let codaAllQ = service.from('documenti_da_processare').select('*', { count: 'exact', head: true })
  if (sedeId) codaAllQ = codaAllQ.eq('sede_id', sedeId)
  const { count: codaAll } = await codaAllQ

  const stats: KindStats[] = [
    { kind: 'fattura', label: 'Fatture', icon: '🧾', table: 'fatture', count: fattureRes.count ?? 0 },
    { kind: 'nota_credito', label: 'Note credito', icon: '💳', table: 'fatture (is_credit_note=true)', count: noteCreditoRes.count ?? 0 },
    { kind: 'bolla', label: 'Bolle', icon: '📦', table: 'bolle', count: bolleRes.count ?? 0 },
    { kind: 'ordine', label: 'Conferme ordine', icon: '📋', table: 'conferme_ordine', count: ordiniRes.count ?? 0 },
    { kind: 'potenziale', label: 'Fornitori potenziali', icon: '🤝', table: 'comunicazioni_fornitori_potenziali', count: potenzialiRes.count ?? 0 },
  ]

  for (const kind of CodaKinds) {
    stats.push({
      kind: `coda_${kind}`,
      label: kind === 'fattura' ? 'In coda → Fattura' :
             kind === 'bolla' ? 'In coda → Bolla' :
             kind === 'statement' ? 'In coda → Statement' :
             kind === 'ordine' ? 'In coda → Ordine' :
             kind === 'nota_credito' ? 'In coda → Nota credito' :
             kind === 'comunicazione' ? 'In coda → Comunicazione' :
             'In coda → Listino',
      icon: '⏳',
      table: 'documenti_da_processare',
      count: codaKindCounts[kind] ?? 0,
    })
  }

  const codaTotal = Object.values(codaKindCounts).reduce((a, b) => a + b, 0)
  stats.push({
    kind: 'coda_altro',
    label: 'In coda → Altro/senza categoria',
    icon: '⏳',
    table: 'documenti_da_processare',
    count: Math.max(0, (codaAll ?? 0) - codaTotal),
  })

  const total = stats.reduce((s, st) => s + st.count, 0)
  return NextResponse.json({ stats, total })
}
