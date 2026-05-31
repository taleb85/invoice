import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { detectAllDuplicates, type AllDuplicatesReport } from '@/lib/duplicate-detector'
import { cleanupDuplicateBolle } from '@/lib/check-duplicates'
import { syncListinoFromFattureForFornitore } from '@/lib/sync-listino-from-fatture'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function duplicateHitsForFornitore(report: AllDuplicatesReport, fornitoreId: string): number {
  let n = 0
  for (const ent of [report.fatture, report.bolle]) {
    for (const g of ent.groups) {
      const touches = g.items.some(
        (it) => (it.metadata as { fornitore_id?: string | null })?.fornitore_id === fornitoreId,
      )
      if (touches) n += g.items.length
    }
  }
  for (const g of report.fornitori.groups) {
    const touches = g.items.some((it) => it.id === fornitoreId)
    if (touches) n += g.items.length
  }
  return n
}

export async function POST(req: NextRequest, segmentCtx: { params: Promise<{ id: string }> }) {
  const { id: fornitoreId } = await segmentCtx.params
  if (!fornitoreId) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const master = isMasterAdminRole(profile.role)
  const sedeAdmin = isSedePrivilegedRole(profile.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: fornitoreRow, error: fe } = await service
    .from('fornitori')
    .select('id, sede_id, nome')
    .eq('id', fornitoreId)
    .maybeSingle()
  if (fe || !fornitoreRow?.id) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  const fornitoreSedeId = fornitoreRow.sede_id as string | null
  if (!fornitoreSedeId) {
    return NextResponse.json({ error: 'Assegna una sede al fornitore' }, { status: 400 })
  }
  if (!master && profile.sede_id !== fornitoreSedeId) {
    return NextResponse.json({ error: 'Non autorizzato su questo fornitore' }, { status: 403 })
  }

  const origin = new URL(req.url)
  const base = `${origin.protocol}//${origin.host}`
  const cookie = req.headers.get('cookie') ?? ''

  const report: Record<string, unknown> = {
    fixOcr: null as unknown,
    duplicates: null as unknown,
    listino: null as unknown,
    errors: [] as string[],
  }

  // 1–2 OCR + date fixes (reuse admin batch)
  try {
    const fixPayload: Record<string, unknown> = {
      fornitore_id: fornitoreId,
      limit: 120,
      allow_tipo_migrate: false,
      sede_id: fornitoreSedeId,
    }
    const fx = await fetch(`${base}/api/admin/fix-ocr-dates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(fixPayload),
    })
    report.fixOcr = await fx.json().catch(() => ({}))
    if (!fx.ok) {
      ;(report.errors as string[]).push(`Fix OCR/date: HTTP ${fx.status}`)
    }
  } catch (e) {
    ;(report.errors as string[]).push(`Fix OCR/date: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 3 Duplicates: rilevazione sede + pulizia copie bolle per questo fornitore
  try {
    const dupReport = await detectAllDuplicates(fornitoreSedeId, service)
    const hits = duplicateHitsForFornitore(dupReport, fornitoreId)
    const bollaCleanup = await cleanupDuplicateBolle(service, {
      sedeId: fornitoreSedeId,
      fornitoreId,
    })
    report.duplicates = {
      totalReported: dupReport.total,
      itemsTouchingFornitore: hits,
      bolleDeleted: bollaCleanup.deleted,
      bolleExcessFound: bollaCleanup.excessFound,
    }
  } catch (e) {
    ;(report.errors as string[]).push(`Duplicati: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 4–5 Listino: importa da fatture non analizzate
  try {
    const listino = await syncListinoFromFattureForFornitore(service, {
      fornitoreId,
      baseUrl: base,
      cookie,
    })
    if (listino.skipped) {
      report.listino = { skipped: true, reason: listino.reason }
    } else {
      report.listino = {
        fattureScanned: listino.fattureScanned,
        righeInserite: listino.righeInserite,
      }
    }
    ;(report.errors as string[]).push(...listino.errors)
  } catch (e) {
    ;(report.errors as string[]).push(`Listino: ${e instanceof Error ? e.message : String(e)}`)
  }

  return NextResponse.json({
    ok: true,
    fornitore: { id: fornitoreId, nome: fornitoreRow.nome },
    ...report,
  })
}
