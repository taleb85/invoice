/**
 * POST /api/admin/fix-eden-springs
 *
 * Bonifica Eden Springs UK (e pattern Account No. UK):
 *  - azzera numero_fattura errato (316074277, …)
 *  - elimina duplicati (stesso file / stesso numero / cluster giornaliero)
 *
 * body: { sede_id?, fornitore_id?, dry_run?: boolean, reocr?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'
import {
  buildEdenSpringsFixPlan,
  findEdenSpringsFornitoreIds,
  type EdenFatturaRow,
} from '@/lib/eden-springs-fix'
import { supplierNameLooksLikeEdenSprings } from '@/lib/uk-account-invoice-guard'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { ocrInvoice } from '@/lib/ocr-invoice'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function resolveSedeId(
  profile: { role: string; sede_id: string | null },
  urlSedeId: string | null,
): Promise<string | null> {
  const isMaster = isMasterAdminRole(profile.role)
  const isAdminSede = isSedePrivilegedRole(profile.role)
  if (isAdminSede && profile.sede_id) {
    if (urlSedeId && urlSedeId !== profile.sede_id) return null
    return profile.sede_id
  }
  if (isMaster) {
    if (urlSedeId) return urlSedeId
    const cookieStore = await cookies()
    return cookieStore.get('admin-sede-id')?.value?.trim() || null
  }
  return null
}

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization')?.trim() ?? ''
  const cronAuthorized = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  let profile: Awaited<ReturnType<typeof getProfile>> = null
  if (!cronAuthorized) {
    profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }
  }

  let body: { sede_id?: string; fornitore_id?: string; dry_run?: boolean; reocr?: boolean }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const sedeId = await resolveSedeId(
    { role: profile?.role ?? 'admin', sede_id: profile?.sede_id ?? null },
    body.sede_id?.trim() || null,
  )
  if (!sedeId) return NextResponse.json({ error: 'Sede non disponibile' }, { status: 403 })

  const service = createServiceClient()
  const fornitoreFilter = body.fornitore_id?.trim() || null

  let fornitoreIds: string[] = []
  if (fornitoreFilter) {
    fornitoreIds = [fornitoreFilter]
  } else {
    const { data: allF } = await service.from('fornitori').select('id, nome, display_name')
    fornitoreIds = findEdenSpringsFornitoreIds(
      (allF ?? []) as Array<{ id: string; nome: string; display_name: string | null }>,
    )
  }

  if (!fornitoreIds.length) {
    return NextResponse.json({
      ok: true,
      message: 'Nessun fornitore Eden Springs trovato',
      plan: null,
    })
  }

  let fq = service
    .from('fatture')
    .select(
      'id, fornitore_id, sede_id, data, importo, numero_fattura, file_url, bolla_id, approval_status',
    )
    .eq('sede_id', sedeId)
    .in('fornitore_id', fornitoreIds)
    .order('data', { ascending: true })
    .order('id', { ascending: true })
    .limit(5000)

  const { data: fatture, error: fErr } = await fq.returns<EdenFatturaRow[]>()
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

  const rows = fatture ?? []
  const { data: fnRows } = await service
    .from('fornitori')
    .select('id, nome, display_name')
    .in('id', fornitoreIds)
  const nameMap = new Map<string, string>()
  for (const f of fnRows ?? []) {
    const r = f as { id: string; nome: string; display_name: string | null }
    nameMap.set(r.id, r.display_name || r.nome)
  }

  const plan = buildEdenSpringsFixPlan(rows, nameMap)

  const reocrUpdates: Array<{ id: string; numero_fattura: string | null; importo: number | null }> =
    []

  if (body.reocr && process.env.GEMINI_API_KEY?.trim()) {
    const candidates = rows.filter(
      (f) =>
        f.file_url &&
        (!f.numero_fattura?.trim() ||
          /^\d{8,10}$/.test(f.numero_fattura.replace(/\s/g, '')) ||
          supplierNameLooksLikeEdenSprings(nameMap.get(f.fornitore_id ?? '') ?? '')),
    )
    const seenUrls = new Set<string>()
    for (const f of candidates.slice(0, 15)) {
      const url = f.file_url!.trim()
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      try {
        const dl = await downloadStorageObjectByFileUrl(service, url)
        if ('error' in dl) continue
        const ct = dl.contentType?.includes('pdf') ? 'application/pdf' : dl.contentType
        const ocr = await ocrInvoice(dl.data, ct || 'application/pdf', 'en', {
          preferVisionForPdf: true,
        })
        const num =
          ocr.numero_fattura?.trim() ? normalizeNumeroFattura(ocr.numero_fattura) || null : null
        if (num && !/^\d{8,10}$/.test(num.replace(/\s/g, ''))) {
          for (const row of rows.filter((r) => r.file_url?.trim() === url)) {
            reocrUpdates.push({
              id: row.id,
              numero_fattura: num,
              importo: ocr.totale_iva_inclusa ?? row.importo,
            })
          }
        }
      } catch {
        /* skip single file */
      }
    }
  }

  if (body.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      sede_id: sedeId,
      fornitore_ids: fornitoreIds,
      fatture_analyzed: rows.length,
      plan,
      reocr_would_update: reocrUpdates,
    })
  }

  let cleared = 0
  for (const c of plan.clear_numero) {
    if (plan.delete_ids.includes(c.fattura_id)) continue
    const { error } = await service
      .from('fatture')
      .update({ numero_fattura: null })
      .eq('id', c.fattura_id)
    if (!error) cleared++
  }

  for (const u of reocrUpdates) {
    if (plan.delete_ids.includes(u.id)) continue
    await service
      .from('fatture')
      .update({
        numero_fattura: u.numero_fattura,
        ...(u.importo != null ? { importo: u.importo } : {}),
      })
      .eq('id', u.id)
  }

  if (plan.delete_ids.length) {
    await service
      .from('statement_rows')
      .update({ fattura_id: null, fattura_numero: null })
      .in('fattura_id', plan.delete_ids)
    await service
      .from('statements')
      .update({ linked_fattura_id: null })
      .in('linked_fattura_id', plan.delete_ids)
  }

  let deleted = 0
  const CHUNK = 200
  for (let i = 0; i < plan.delete_ids.length; i += CHUNK) {
    const slice = plan.delete_ids.slice(i, i + CHUNK)
    const { count } = await service.from('fatture').delete({ count: 'exact' }).in('id', slice)
    deleted += count ?? slice.length
  }

  await logActivity(service, {
    userId: profile?.id ?? null,
    sedeId,
    action: 'eden_springs.fix',
    details: {
      cleared,
      deleted,
      reocr_updated: reocrUpdates.length,
      fornitore_ids: fornitoreIds,
    },
  })

  return NextResponse.json({
    ok: true,
    sede_id: sedeId,
    fornitore_ids: fornitoreIds,
    cleared_numero: cleared,
    deleted_duplicates: deleted,
    reocr_updated: reocrUpdates.length,
    plan_summary: {
      clear_numero: plan.clear_numero.length,
      duplicate_groups: plan.duplicate_groups.length,
      delete_ids: plan.delete_ids.length,
    },
  })
}
