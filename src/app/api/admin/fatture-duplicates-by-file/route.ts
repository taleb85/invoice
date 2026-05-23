/**
 * GET  /api/admin/fatture-duplicates-by-file?sede_id=...&fornitore_id=...
 *      → Restituisce gruppi di fatture che condividono lo stesso file_url
 *        (chiari duplicati di registrazione automatica andata male).
 *
 * POST /api/admin/fatture-duplicates-by-file
 *      body: { action: 'delete-extras', sede_id, fornitore_id?, dry_run?: boolean }
 *      → Per ogni gruppo, mantiene la fattura più «forte» (con bolla collegata,
 *        importo non-null, numero_fattura non-null; in caso di parità: più
 *        vecchia per created_at) ed elimina le altre.
 *      → Se dry_run=true, restituisce solo cosa eliminerebbe senza modificare il DB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { cookies } from 'next/headers'
import { logActivity } from '@/lib/activity-logger'

export const dynamic = 'force-dynamic'

type FRow = {
  id: string
  file_url: string | null
  fornitore_id: string | null
  sede_id: string | null
  data: string | null
  importo: number | null
  numero_fattura: string | null
  bolla_id: string | null
  created_at: string
  approval_status: string | null
}

type DupGroup = {
  group_key: string
  group_kind: 'same_file_url' | 'shell_fatture'
  file_url: string | null
  fornitore_id: string | null
  fornitore_nome: string | null
  data_doc: string | null
  count: number
  keep_id: string
  keep_reason: string
  delete_ids: string[]
  fatture: Array<{
    id: string
    file_url: string | null
    data: string | null
    importo: number | null
    numero_fattura: string | null
    bolla_id: string | null
    created_at: string
    approval_status: string | null
    keep: boolean
  }>
}

/** Restituisce un punteggio: più alto = più "forte" (candidato a essere mantenuto). */
function strength(f: FRow): number {
  let s = 0
  if (f.bolla_id) s += 1000
  if (f.numero_fattura && f.numero_fattura.trim()) s += 100
  if (f.importo != null) s += 10
  if (f.approval_status === 'approved') s += 5
  return s
}

function pickKeep(group: FRow[]): { keep: FRow; reason: string } {
  const sorted = [...group].sort((a, b) => {
    const ds = strength(b) - strength(a)
    if (ds !== 0) return ds
    return a.created_at.localeCompare(b.created_at) // più vecchia prima a parità
  })
  const keep = sorted[0]!
  const reasons: string[] = []
  if (keep.bolla_id) reasons.push('bolla collegata')
  if (keep.numero_fattura?.trim()) reasons.push('numero fattura presente')
  if (keep.importo != null) reasons.push('importo presente')
  if (!reasons.length) reasons.push('più vecchia per created_at')
  return { keep, reason: reasons.join(' + ') }
}

async function resolveSedeId(profile: { role: string; sede_id: string | null }, urlSedeId: string | null): Promise<string | null> {
  const isMaster = isMasterAdminRole(profile.role)
  const isAdminSede = isSedePrivilegedRole(profile.role)

  if (isAdminSede && profile.sede_id) {
    if (urlSedeId && urlSedeId !== profile.sede_id) return null // forbidden
    return profile.sede_id
  }
  if (isMaster) {
    if (urlSedeId) return urlSedeId
    const cookieStore = await cookies()
    return cookieStore.get('admin-sede-id')?.value?.trim() || null
  }
  return null
}

async function buildGroups(
  supabase: ReturnType<typeof createServiceClient>,
  sedeId: string,
  fornitoreFilter: string | null,
): Promise<DupGroup[]> {
  // Includiamo anche righe con file_url null per intercettare "shell fatture"
  // create da auto-convert con allegato perso. La dedup per file_url ignora
  // i null comunque.
  let query = supabase
    .from('fatture')
    .select('id, file_url, fornitore_id, sede_id, data, importo, numero_fattura, bolla_id, created_at, approval_status')
    .eq('sede_id', sedeId)
    .order('created_at', { ascending: true })
    .limit(20_000)

  if (fornitoreFilter) query = query.eq('fornitore_id', fornitoreFilter)

  const { data: rows, error } = await query.returns<FRow[]>()
  if (error || !rows) return []

  // ── Gruppo 1: stesso file_url (chiari duplicati di registrazione automatica) ──
  const byFile = new Map<string, FRow[]>()
  for (const r of rows) {
    if (!r.file_url) continue
    const arr = byFile.get(r.file_url) ?? []
    arr.push(r)
    byFile.set(r.file_url, arr)
  }
  const fileGroups: { key: string; items: FRow[] }[] = []
  const usedInFileGroup = new Set<string>()
  for (const [file_url, items] of byFile.entries()) {
    if (items.length < 2) continue
    fileGroups.push({ key: `file:${file_url}`, items })
    items.forEach(i => usedInFileGroup.add(i.id))
  }

  // ── Gruppo 2: "shell fatture" — stesso (fornitore, data) con numero E importo nulli ──
  // È la firma esatta delle conversioni automatiche da autoConvertInvoiceStatements
  // (insert con importo:null e nessun numero_fattura). Catturate anche quando il
  // file_url cambia perché lo statement è stato ricevuto più volte (signed URL diverso).
  const shellCandidates = rows.filter(r =>
    !usedInFileGroup.has(r.id) &&
    r.fornitore_id &&
    r.data &&
    !(r.numero_fattura && r.numero_fattura.trim()) &&
    r.importo == null,
  )
  const byFornitoreData = new Map<string, FRow[]>()
  for (const r of shellCandidates) {
    const k = `${r.fornitore_id}|${r.data}`
    const arr = byFornitoreData.get(k) ?? []
    arr.push(r)
    byFornitoreData.set(k, arr)
  }
  const shellGroups: { key: string; items: FRow[] }[] = []
  for (const [k, items] of byFornitoreData.entries()) {
    if (items.length < 2) continue
    shellGroups.push({ key: `shell:${k}`, items })
  }

  if (!fileGroups.length && !shellGroups.length) return []

  // Risolvi nomi fornitori
  const allItems = [...fileGroups, ...shellGroups].flatMap(g => g.items)
  const fIds = [...new Set(allItems.map(i => i.fornitore_id).filter(Boolean) as string[])]
  const nameMap = new Map<string, string>()
  if (fIds.length) {
    const { data: fRows } = await supabase.from('fornitori').select('id, nome, display_name').in('id', fIds)
    for (const f of fRows ?? []) {
      const fr = f as { id: string; nome: string; display_name: string | null }
      nameMap.set(fr.id, fr.display_name || fr.nome)
    }
  }

  const fileGroupResults: DupGroup[] = fileGroups.map(({ key, items }) => {
    const { keep, reason } = pickKeep(items)
    const delete_ids = items.filter(x => x.id !== keep.id).map(x => x.id)
    const fornitore_id = items[0]!.fornitore_id
    return {
      group_key: key,
      group_kind: 'same_file_url',
      file_url: items[0]!.file_url,
      fornitore_id,
      fornitore_nome: fornitore_id ? (nameMap.get(fornitore_id) ?? null) : null,
      data_doc: items[0]!.data,
      count: items.length,
      keep_id: keep.id,
      keep_reason: reason,
      delete_ids,
      fatture: items.map(f => ({
        id: f.id,
        file_url: f.file_url,
        data: f.data,
        importo: f.importo,
        numero_fattura: f.numero_fattura,
        bolla_id: f.bolla_id,
        created_at: f.created_at,
        approval_status: f.approval_status,
        keep: f.id === keep.id,
      })),
    }
  })

  const shellGroupResults: DupGroup[] = shellGroups.map(({ key, items }) => {
    const { keep, reason } = pickKeep(items)
    const delete_ids = items.filter(x => x.id !== keep.id).map(x => x.id)
    const fornitore_id = items[0]!.fornitore_id
    const reasonFull = `${reason} · gruppo "shell fattura" (stesso fornitore + stessa data, senza numero né importo)`
    return {
      group_key: key,
      group_kind: 'shell_fatture',
      file_url: null,
      fornitore_id,
      fornitore_nome: fornitore_id ? (nameMap.get(fornitore_id) ?? null) : null,
      data_doc: items[0]!.data,
      count: items.length,
      keep_id: keep.id,
      keep_reason: reasonFull,
      delete_ids,
      fatture: items.map(f => ({
        id: f.id,
        file_url: f.file_url,
        data: f.data,
        importo: f.importo,
        numero_fattura: f.numero_fattura,
        bolla_id: f.bolla_id,
        created_at: f.created_at,
        approval_status: f.approval_status,
        keep: f.id === keep.id,
      })),
    }
  })

  return [...fileGroupResults, ...shellGroupResults]
}

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const url = new URL(req.url)
  const urlSedeId = url.searchParams.get('sede_id')?.trim() || null
  const fornitoreFilter = url.searchParams.get('fornitore_id')?.trim() || null
  const debug = url.searchParams.get('debug') === '1'

  const sedeId = await resolveSedeId({ role: profile.role, sede_id: profile.sede_id }, urlSedeId)
  if (sedeId === null) return NextResponse.json({ error: 'Sede non disponibile o non consentita' }, { status: 403 })

  const supabase = createServiceClient()
  const groups = await buildGroups(supabase, sedeId, fornitoreFilter)
  const totalExtras = groups.reduce((acc, g) => acc + g.delete_ids.length, 0)

  if (debug) {
    let query = supabase
      .from('fatture')
      .select('id, data, numero_fattura, importo, file_url, fornitore_id, bolla_id, created_at')
      .eq('sede_id', sedeId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    if (fornitoreFilter) query = query.eq('fornitore_id', fornitoreFilter)
    const { data: rawRows } = await query
    return NextResponse.json({
      ok: true,
      sede_id: sedeId,
      fornitore_filter: fornitoreFilter,
      groups,
      group_count: groups.length,
      extras_to_delete: totalExtras,
      debug: {
        total_rows: rawRows?.length ?? 0,
        rows: rawRows ?? [],
      },
    })
  }

  return NextResponse.json({ ok: true, sede_id: sedeId, groups, group_count: groups.length, extras_to_delete: totalExtras })
}

export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: { action?: string; sede_id?: string; fornitore_id?: string; dry_run?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  if (body.action !== 'delete-extras') {
    return NextResponse.json({ error: 'azione non supportata' }, { status: 400 })
  }

  const sedeId = await resolveSedeId(
    { role: profile.role, sede_id: profile.sede_id },
    body.sede_id?.trim() || null,
  )
  if (sedeId === null) return NextResponse.json({ error: 'Sede non disponibile o non consentita' }, { status: 403 })

  const supabase = createServiceClient()
  const groups = await buildGroups(supabase, sedeId, body.fornitore_id?.trim() || null)
  const allIdsToDelete = groups.flatMap(g => g.delete_ids)

  if (body.dry_run) {
    return NextResponse.json({ ok: true, dry_run: true, would_delete: allIdsToDelete.length, groups })
  }

  if (!allIdsToDelete.length) {
    return NextResponse.json({ ok: true, deleted: 0, groups: [] })
  }

  // Sgancia eventuali statement_rows.fattura_id che puntano alle fatture da eliminare:
  // verranno ri-collegate al recheck successivo.
  await supabase
    .from('statement_rows')
    .update({ fattura_id: null, fattura_numero: null })
    .in('fattura_id', allIdsToDelete)

  // Sgancia eventuali statements.linked_fattura_id (no-op se la migration
  // non è ancora stata applicata: la colonna semplicemente non esiste).
  const unlinkRes = await supabase
    .from('statements')
    .update({ linked_fattura_id: null })
    .in('linked_fattura_id', allIdsToDelete)
  if (unlinkRes.error && unlinkRes.error.code !== '42703') {
    return NextResponse.json({ error: `Errore unlink statements: ${unlinkRes.error.message}` }, { status: 500 })
  }

  // Elimina a chunk (Supabase ha un limite pratico per IN)
  const CHUNK = 200
  let deleted = 0
  for (let i = 0; i < allIdsToDelete.length; i += CHUNK) {
    const slice = allIdsToDelete.slice(i, i + CHUNK)
    const { error: delErr, count } = await supabase
      .from('fatture')
      .delete({ count: 'exact' })
      .in('id', slice)
    if (delErr) {
      return NextResponse.json({ error: `Errore eliminazione: ${delErr.message}`, deleted_before_error: deleted }, { status: 500 })
    }
    deleted += count ?? slice.length
  }

  await logActivity(supabase, {
    userId: profile.id,
    sedeId,
    action: 'fattura.duplicate_cleanup',
    entityType: 'fattura',
    entityId: 'bulk',
    entityLabel: `Pulizia ${deleted} fatture duplicate (file_url)`,
    metadata: { sede_id: sedeId, fornitore_id: body.fornitore_id ?? null, deleted, groups: groups.length },
  })

  return NextResponse.json({ ok: true, deleted, groups })
}
