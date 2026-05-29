import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { syncListinoFromFattureForFornitore } from '@/lib/sync-listino-from-fatture'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type FornitoreRow = {
  id: string
  nome: string
  sede_id: string | null
  escluso_da_analisi_prezzi: boolean | null
}

async function fornitoreIdsWithPendingFatture(
  service: ReturnType<typeof createServiceClient>,
  sedeId: string | null,
  master: boolean,
): Promise<FornitoreRow[]> {
  let fq = service
    .from('fornitori')
    .select('id, nome, sede_id, escluso_da_analisi_prezzi')
    .eq('escluso_da_analisi_prezzi', false)

  if (!master && sedeId) {
    fq = fq.eq('sede_id', sedeId)
  }

  const { data: fornitori } = await fq
  const allowed = new Map(
    ((fornitori ?? []) as FornitoreRow[]).map((f) => [f.id, f]),
  )
  if (allowed.size === 0) return []

  const { data: fatture } = await service
    .from('fatture')
    .select('fornitore_id')
    .eq('analizzata', false)
    .not('file_url', 'is', null)

  const ids = new Set<string>()
  for (const row of fatture ?? []) {
    const fid = (row as { fornitore_id: string }).fornitore_id
    if (allowed.has(fid)) ids.add(fid)
  }

  return [...ids].map((id) => allowed.get(id)!)
}

export async function GET() {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const service = createServiceClient()
  const master = isMasterAdminRole(profile.role)
  const fornitori = await fornitoreIdsWithPendingFatture(service, profile.sede_id, master)

  const pendingByFornitore = new Map<string, number>()
  if (fornitori.length > 0) {
    const { data: counts } = await service
      .from('fatture')
      .select('fornitore_id')
      .eq('analizzata', false)
      .not('file_url', 'is', null)
      .in(
        'fornitore_id',
        fornitori.map((f) => f.id),
      )

    for (const row of counts ?? []) {
      const fid = (row as { fornitore_id: string }).fornitore_id
      pendingByFornitore.set(fid, (pendingByFornitore.get(fid) ?? 0) + 1)
    }
  }

  return NextResponse.json({
    fornitori: fornitori.map((f) => ({
      id: f.id,
      nome: f.nome,
      pending_fatture: pendingByFornitore.get(f.id) ?? 0,
    })),
    total_pending_fatture: [...pendingByFornitore.values()].reduce((a, b) => a + b, 0),
  })
}

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    fornitore_id?: string
    all?: boolean
    max_fatture_per_fornitore?: number
  }

  const service = createServiceClient()
  const master = isMasterAdminRole(profile.role)
  const origin = new URL(req.url)
  const base = `${origin.protocol}//${origin.host}`
  const cookie = req.headers.get('cookie') ?? ''
  const maxFatture = typeof body.max_fatture_per_fornitore === 'number' ? body.max_fatture_per_fornitore : 40

  const runOne = async (fornitoreId: string, nome: string) => {
    if (!master && profile.sede_id) {
      const { data: f } = await service
        .from('fornitori')
        .select('sede_id')
        .eq('id', fornitoreId)
        .maybeSingle()
      if (!f || f.sede_id !== profile.sede_id) {
        return {
          fornitore_id: fornitoreId,
          fornitore_nome: nome,
          fatture_scanned: 0,
          righe_inserite: 0,
          errors: ['Non autorizzato su questo fornitore'],
        }
      }
    }

    const result = await syncListinoFromFattureForFornitore(service, {
      fornitoreId,
      baseUrl: base,
      cookie,
      maxFatture,
    })
    return {
      fornitore_id: fornitoreId,
      fornitore_nome: nome,
      fatture_scanned: result.fattureScanned,
      righe_inserite: result.righeInserite,
      skipped: result.skipped,
      reason: result.reason,
      errors: result.errors,
    }
  }

  if (body.fornitore_id) {
    const { data: f } = await service
      .from('fornitori')
      .select('id, nome')
      .eq('id', body.fornitore_id)
      .maybeSingle()
    if (!f?.id) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
    const dettaglio = await runOne(f.id, f.nome as string)
    return NextResponse.json({
      ok: true,
      fornitori_elaborati: 1,
      fatture_scanned: dettaglio.fatture_scanned,
      righe_inserite: dettaglio.righe_inserite,
      dettaglio: [dettaglio],
      errors: dettaglio.errors,
    })
  }

  if (!body.all) {
    return NextResponse.json({ error: 'Specificare fornitore_id o all: true' }, { status: 400 })
  }

  const fornitori = await fornitoreIdsWithPendingFatture(service, profile.sede_id, master)
  if (fornitori.length === 0) {
    return NextResponse.json({
      ok: true,
      fornitori_elaborati: 0,
      fatture_scanned: 0,
      righe_inserite: 0,
      dettaglio: [],
      errors: [],
      message: 'Nessuna fattura da importare nel listino',
    })
  }

  const dettaglio = []
  const errors: string[] = []
  let fattureScanned = 0
  let righeInserite = 0

  for (const f of fornitori) {
    const row = await runOne(f.id, f.nome)
    dettaglio.push(row)
    fattureScanned += row.fatture_scanned
    righeInserite += row.righe_inserite
    errors.push(...row.errors)
  }

  return NextResponse.json({
    ok: true,
    fornitori_elaborati: dettaglio.length,
    fatture_scanned: fattureScanned,
    righe_inserite: righeInserite,
    dettaglio,
    errors,
  })
}
