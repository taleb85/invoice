import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'

const ORIGINI = [
  'documento_da_processare',
  'fattura',
  'errore_sincronizzazione',
  'bolla_aperta',
  'riga_statement',
] as const

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

async function countCoda(
  supabase: ReturnType<typeof createServiceClient>,
  sedeId: string | null,
  origine?: string | null,
): Promise<number> {
  let q = supabase.from('v_coda_unificata').select('*', { count: 'exact', head: true })
  if (sedeId) q = q.eq('sede_id', sedeId)
  if (origine) q = q.eq('origine', origine)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getRequestAuth()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const sedeId = searchParams.get('sede_id')
    const origine = searchParams.get('origine')
    const prioritaMax = searchParams.get('priorita_max')
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

    let query = supabase
      .from('v_coda_unificata')
      .select('*')
      .order('priorita', { ascending: true })
      .order('data_inserimento', { ascending: false })

    if (sedeId) query = query.eq('sede_id', sedeId)
    if (origine) query = query.eq('origine', origine)
    if (prioritaMax) query = query.lte('priorita', parseInt(prioritaMax))

    const [pageResult, total, ...originCounts] = await Promise.all([
      query.range(offset, offset + limit - 1),
      countCoda(supabase, sedeId, origine),
      ...ORIGINI.map((o) => countCoda(supabase, sedeId, o)),
    ])

    const { data: items, error } = pageResult

    if (error) {
      console.error('[CentroControllo] Errore query v_coda_unificata:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtered = items ?? []

    const conteggiPerOrigine = Object.fromEntries(
      ORIGINI.map((o, i) => [o, originCounts[i]]),
    ) as Record<(typeof ORIGINI)[number], number>

    const conteggi = {
      documenti_da_processare: conteggiPerOrigine.documento_da_processare,
      fatture_pending: conteggiPerOrigine.fattura,
      errori_sincronizzazione: conteggiPerOrigine.errore_sincronizzazione,
      bolle_aperte: conteggiPerOrigine.bolla_aperta,
      righe_statement: conteggiPerOrigine.riga_statement,
      totale: ORIGINI.reduce((sum, o) => sum + conteggiPerOrigine[o], 0),
    }

    return NextResponse.json({
      items: filtered,
      conteggi,
      total,
      limit,
      offset,
      hasMore: offset + filtered.length < total,
    })
  } catch (e) {
    console.error('[CentroControllo] Errore generico:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
