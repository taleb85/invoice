import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { safeDate } from '@/lib/safe-date'
import {
  isSuspiciousDocumentDate,
  resolvedContentTypeFromFetch,
  inferContentTypeFromBuffer,
  bollaNeedsOcrPass,
  fatturaNeedsOcrPass,
  shouldMigrateBollaRowToFattura,
} from '@/lib/fix-ocr-dates-helpers'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'

export const dynamic = 'force-dynamic'

const FATTURE_LIST_COLUMNS = 'id, fornitore_id, bolla_id, sede_id, data, file_url, importo, numero_fattura' as const

/**
 * Carica fatture “sospette” per data. Doppio passaggio se PostgREST segnala colonne
 * assenti nello schema cache (raro) o in ambienti ibridi.
 */
async function loadSuspiciousFatture(
  service: SupabaseClient,
  sedeFilter: string | null,
  orFilter: string,
  fornitoreId: string | null = null,
): Promise<{ data: FatturaRow[] | null; error: { message: string } | null }> {
  const build = () => {
    let q = service
      .from('fatture')
      .select(FATTURE_LIST_COLUMNS)
      .not('file_url', 'is', null)
    if (sedeFilter) q = q.eq('sede_id', sedeFilter)
    if (fornitoreId) q = q.eq('fornitore_id', fornitoreId) as typeof q
    return q.or(orFilter)
  }

  const first = await build()
  if (!first.error) {
    return { data: (first.data as FatturaRow[]) ?? [], error: null }
  }
  const msg = first.error.message ?? ''
  if (!/analizzata|verificata|does not exist|42703|schema cache/i.test(msg)) {
    return { data: null, error: first.error }
  }

  let idQ = service.from('fatture').select('id').not('file_url', 'is', null)
  if (sedeFilter) idQ = idQ.eq('sede_id', sedeFilter)
  if (fornitoreId) idQ = idQ.eq('fornitore_id', fornitoreId) as typeof idQ
  const idRes = await idQ.or(orFilter)
  if (idRes.error) return { data: null, error: idRes.error }

  const idList = (idRes.data as { id: string }[] | null)?.map((r) => r.id) ?? []
  if (idList.length === 0) return { data: [], error: null }

  const out: FatturaRow[] = []
  for (let i = 0; i < idList.length; i += 120) {
    const chunk = idList.slice(i, i + 120)
    const { data: rows, error: fullErr } = await service
      .from('fatture')
      .select(FATTURE_LIST_COLUMNS)
      .in('id', chunk)
    if (fullErr) return { data: null, error: fullErr }
    for (const r of (rows as FatturaRow[]) ?? []) out.push(r)
  }
  return { data: out, error: null }
}

type BollaRow = {
  id: string
  fornitore_id: string
  sede_id: string | null
  data: string
  file_url: string | null
  importo: number | null
  numero_bolla: string | null
  stato: string
}

type FatturaRow = {
  id: string
  fornitore_id: string
  bolla_id: string | null
  sede_id: string | null
  data: string
  file_url: string | null
  importo: number | null
  numero_fattura: string | null
}

async function countTable(
  supabase: SupabaseClient,
  table: string,
  match: Record<string, string>,
): Promise<number> {
  const col = Object.keys(match)[0]!
  const val = match[col]!
  const { count, error } = await supabase.from(table).select(col, { count: 'exact', head: true }).eq(col, val)
  if (error) {
    const msg = (error.message ?? '').toLowerCase()
    if (error.code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache')) return 0
    return 0
  }
  return count ?? 0
}

async function canMigrateBollaToFattura(supabase: SupabaseClient, bollaId: string): Promise<boolean> {
  const linkedFatture = await countTable(supabase, 'fatture', { bolla_id: bollaId })
  if (linkedFatture > 0) return false
  const junction = await countTable(supabase, 'fattura_bolle', { bolla_id: bollaId })
  if (junction > 0) return false
  return true
}

async function canMigrateFatturaToBolla(supabase: SupabaseClient, f: FatturaRow): Promise<boolean> {
  if (f.bolla_id) return false
  const junction = await countTable(supabase, 'fattura_bolle', { fattura_id: f.id })
  if (junction > 0) return false
  return true
}

function pickDocDate(ocr: { data_fattura: string | null; data: string | null }, fallback: string): string {
  const raw = ocr.data_fattura ?? ocr.data
  const n = raw != null && String(raw).trim() ? safeDate(String(raw)) : null
  return n ?? fallback
}

/** Alcuni database non hanno `user_id` su bolle/fatture: ritenta insert senza colonna. */
function isMissingColumnError(err: { message?: string } | null, col: string): boolean {
  const m = (err?.message ?? '').toLowerCase()
  return m.includes(col.toLowerCase()) && m.includes('does not exist')
}

/**
 * Rianalizza con Gemini (prompt aggiornato) i documenti in coda e corregge data / numero / importo.
 * Con `allow_tipo_migrate: true` (fornitore / Rianalizza / Impostazioni) può spostare la riga tra `bolle` e `fatture`.
 * Con `fornitore_id` + flag: in coda entrano **anche** bolle con numero/importo già presenti (riclassifica), non solo quelle in `bollaNeedsOcrPass`.
 * Senza flag, si aggiornano solo i campi sulla riga corrente (niente bolla → fattura).
 *
 * - `role === admin'`: senza `sede_id` elabora tutto il database; con `sede_id` filtra.
 * - `admin_sede`: obbliga `sede_id` uguale al profilo.
 * - `operatore`: negato.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const role = String(profile.role ?? '').toLowerCase()
  if (role === 'operatore') {
    return NextResponse.json({ error: 'Operatore: non autorizzato' }, { status: 403 })
  }
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Solo amministratore o responsabile sede' }, { status: 403 })
  }

  /** Proprietario per nuove righe in migrazione: diversi DB non espongono più `user_id` su bolle. */
  const ownerUserId = profile.id

  type FixBody = {
    limit?: number
    sede_id?: string
    bolla_id?: string
    fattura_id?: string
    fornitore_id?: string
    /**
     * Se true, l’OCR può spostare una riga tra `bolle` e `fatture` in base a `tipo_documento`.
     * Default false: su fornitore / riga bolla si aggiornano solo data, numero e importo sulla riga esistente
     * (niente cancellazione bolla → fattura).
     */
    allow_tipo_migrate?: boolean
  }
  let body: FixBody
  try {
    body = (await req.json()) as FixBody
  } catch {
    body = {}
  }
  const allowTipoMigrate = body.allow_tipo_migrate === true
  const bollaIdForce = typeof body.bolla_id === 'string' ? body.bolla_id.trim() : ''
  const fatturaIdForce = typeof body.fattura_id === 'string' ? body.fattura_id.trim() : ''
  const fornitoreIdBatch = typeof body.fornitore_id === 'string' ? body.fornitore_id.trim() : ''
  if (bollaIdForce && fatturaIdForce) {
    return NextResponse.json({ error: 'Specificare solo bolla_id oppure fattura_id' }, { status: 400 })
  }
  if (fornitoreIdBatch && (bollaIdForce || fatturaIdForce)) {
    return NextResponse.json(
      { error: 'Non combinare fornitore_id con bolla_id o fattura_id' },
      { status: 400 },
    )
  }

  const limit = Math.min(150, Math.max(1, Number(body?.limit) || 40))
  const sedeFromBody = typeof body.sede_id === 'string' ? body.sede_id.trim() : ''

  if (isSedePrivilegedRole(profile.role)) {
    if (!sedeFromBody) {
      return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
    }
    if (profile.sede_id !== sedeFromBody) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
  }

  /** Filtro opzionale: solo per admin master passa o si omette per tutte le sedi. */
  const sedeFilter = sedeFromBody || null
  if (sedeFilter && !isMasterAdminRole(profile.role) && profile.sede_id !== sedeFilter) {
    return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
  }

  const service = createServiceClient()
  const todayIso = new Date().toISOString().slice(0, 10)
  const orFilter = `data.gt.${todayIso},data.lt.1990-01-01,data.gt.2035-12-31`

  type QueueItem = { kind: 'bolla' | 'fattura'; row: BollaRow | FatturaRow }
  let queue: QueueItem[] = []

  if (fornitoreIdBatch) {
    const { data: fr, error: fErr0 } = await service
      .from('fornitori')
      .select('id, sede_id')
      .eq('id', fornitoreIdBatch)
      .single()
    if (fErr0 || !fr) {
      return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
    }
    const fSede = (fr as { sede_id?: string | null }).sede_id
    if (sedeFilter && fSede !== sedeFilter) {
      return NextResponse.json({ error: 'Sede non consentita per questo fornitore' }, { status: 403 })
    }
    if (!sedeFilter && isSedePrivilegedRole(profile.role) && fSede !== profile.sede_id) {
      return NextResponse.json({ error: 'Sede non consentita per questo fornitore' }, { status: 403 })
    }

    let bolleSuspQ = service
      .from('bolle')
      .select('id, fornitore_id, sede_id, data, file_url, importo, numero_bolla, stato')
      .not('file_url', 'is', null)
      .eq('fornitore_id', fornitoreIdBatch)
    if (sedeFilter) bolleSuspQ = bolleSuspQ.eq('sede_id', sedeFilter) as typeof bolleSuspQ
    const { data: bolleByDate, error: bErr } = await bolleSuspQ.or(orFilter)

    let bolleAllQ = service
      .from('bolle')
      .select('id, fornitore_id, sede_id, data, file_url, importo, numero_bolla, stato')
      .not('file_url', 'is', null)
      .eq('fornitore_id', fornitoreIdBatch)
    if (sedeFilter) bolleAllQ = bolleAllQ.eq('sede_id', sedeFilter) as typeof bolleAllQ
    const { data: bolleAllRows, error: bAllErr } = await bolleAllQ

    if (bErr || bAllErr) {
      console.error('[fix-ocr-dates] bolle (fornitore) query', bErr ?? bAllErr)
      return NextResponse.json({ error: (bErr ?? bAllErr)!.message }, { status: 500 })
    }

    const bollaById = new Map<string, BollaRow>()
    for (const r of (bolleByDate as BollaRow[] | null) ?? []) bollaById.set(r.id, r)
    for (const r of (bolleAllRows as BollaRow[] | null) ?? []) bollaById.set(r.id, r)
    /** Con `allow_tipo_migrate` servono anche righe con numero/importo già piene (riclassifica bolla→fattura). */
    const bolle: BollaRow[] = [...bollaById.values()].filter(
      (r) =>
        bollaNeedsOcrPass(r) || (allowTipoMigrate && Boolean(r.file_url?.trim())),
    )

    const { data: fattureByDate, error: fErr } = await loadSuspiciousFatture(
      service,
      sedeFilter,
      orFilter,
      fornitoreIdBatch,
    )
    if (fErr) {
      console.error('[fix-ocr-dates] fatture (fornitore) query', fErr)
      return NextResponse.json(
        {
          error: `${fErr.message} — Esegui nel SQL Editor Supabase: ALTER TABLE public.fatture ADD COLUMN IF NOT EXISTS analizzata boolean NOT NULL DEFAULT false;`,
        },
        { status: 500 },
      )
    }

    let fattureAllQ = service
      .from('fatture')
      .select(FATTURE_LIST_COLUMNS)
      .not('file_url', 'is', null)
      .eq('fornitore_id', fornitoreIdBatch)
    if (sedeFilter) fattureAllQ = fattureAllQ.eq('sede_id', sedeFilter) as typeof fattureAllQ
    const { data: fattureAllRows, error: fAllErr } = await fattureAllQ
    if (fAllErr) {
      console.error('[fix-ocr-dates] fatture all (fornitore) query', fAllErr)
      return NextResponse.json({ error: fAllErr.message }, { status: 500 })
    }

    const fatturaById = new Map<string, FatturaRow>()
    for (const r of (fattureByDate as FatturaRow[] | null) ?? []) fatturaById.set(r.id, r)
    for (const r of (fattureAllRows as FatturaRow[] | null) ?? []) fatturaById.set(r.id, r)
    const fatture: FatturaRow[] = [...fatturaById.values()].filter((r) => fatturaNeedsOcrPass(r))

    /**
     * Priorità coda: 0 date sospette, 1 campi mancanti (numero/importo), 2 righe “piene” (solo bolla→fattura con allow_tipo_migrate).
     */
    const bollaPrio = (r: BollaRow) => {
      if (isSuspiciousDocumentDate(r.data)) return 0
      if (bollaNeedsOcrPass(r)) return 1
      return 2
    }
    const fatturaPrio = (r: FatturaRow) => (isSuspiciousDocumentDate(r.data) ? 0 : 1)
    bolle.sort((a, b) => bollaPrio(a) - bollaPrio(b) || b.data.localeCompare(a.data))
    fatture.sort((a, b) => fatturaPrio(a) - fatturaPrio(b) || b.data.localeCompare(a.data))

    queue = [
      ...bolle.map((row) => ({ kind: 'bolla' as const, row })),
      ...fatture.map((row) => ({ kind: 'fattura' as const, row })),
    ]
  } else if (bollaIdForce) {
    const { data: oneBolla, error: oErr } = await service
      .from('bolle')
      .select('id, fornitore_id, sede_id, data, file_url, importo, numero_bolla, stato')
      .eq('id', bollaIdForce)
      .single()
    if (oErr || !oneBolla) {
      return NextResponse.json({ error: 'Bolla non trovata' }, { status: 404 })
    }
    const br = oneBolla as BollaRow
    if (!br.file_url?.trim()) {
      return NextResponse.json({ error: 'Bolla senza allegato' }, { status: 400 })
    }
    if (sedeFilter && br.sede_id !== sedeFilter) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
    if (!sedeFilter && isSedePrivilegedRole(profile.role) && br.sede_id !== profile.sede_id) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
    queue = [{ kind: 'bolla', row: br }]
  } else if (fatturaIdForce) {
    const { data: oneFa, error: fOneErr } = await service
      .from('fatture')
      .select('id, fornitore_id, bolla_id, sede_id, data, file_url, importo, numero_fattura')
      .eq('id', fatturaIdForce)
      .single()
    if (fOneErr || !oneFa) {
      return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
    }
    const fr = oneFa as FatturaRow
    if (!fr.file_url?.trim()) {
      return NextResponse.json({ error: 'Fattura senza allegato' }, { status: 400 })
    }
    if (sedeFilter && fr.sede_id !== sedeFilter) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
    if (!sedeFilter && isSedePrivilegedRole(profile.role) && fr.sede_id !== profile.sede_id) {
      return NextResponse.json({ error: 'Sede non consentita' }, { status: 403 })
    }
    queue = [{ kind: 'fattura', row: fr }]
  } else {
    let bolleQ = service
      .from('bolle')
      .select('id, fornitore_id, sede_id, data, file_url, importo, numero_bolla, stato')
      .not('file_url', 'is', null)
    if (sedeFilter) bolleQ = bolleQ.eq('sede_id', sedeFilter)
    const { data: bolleAll, error: bErr } = await bolleQ.or(orFilter)

    if (bErr) {
      console.error('[fix-ocr-dates] bolle query', bErr)
      return NextResponse.json({ error: bErr.message }, { status: 500 })
    }

    const { data: fattureAll, error: fErr } = await loadSuspiciousFatture(
      service,
      sedeFilter,
      orFilter,
      null,
    )
    if (fErr) {
      console.error('[fix-ocr-dates] fatture query', fErr)
      return NextResponse.json(
        {
          error: `${fErr.message} — Esegui nel SQL Editor Supabase: ALTER TABLE public.fatture ADD COLUMN IF NOT EXISTS analizzata boolean NOT NULL DEFAULT false;`,
        },
        { status: 500 },
      )
    }

    const bolle: BollaRow[] = (bolleAll as BollaRow[] | null)?.filter((r) => isSuspiciousDocumentDate(r.data)) ?? []
    const fatture: FatturaRow[] =
      (fattureAll as FatturaRow[] | null)?.filter((r) => isSuspiciousDocumentDate(r.data)) ?? []

    queue = [
      ...bolle.map((row) => ({ kind: 'bolla' as const, row })),
      ...fatture.map((row) => ({ kind: 'fattura' as const, row })),
    ]
  }

  const report = {
    ok: true as const,
    totalSuspicious: queue.length,
    limit,
    scanned: 0,
    /** Solo aggiornamenti `data` senza cambio tabella */
    dateOnlyFixes: 0,
    tipoMigratedToFattura: 0,
    tipoMigratedToBolla: 0,
    skipped: 0,
    errors: [] as { id: string; table: string; message: string }[],
    bollaOcrEnriched: 0,
    fatturaOcrEnriched: 0,
    details: [] as {
      id: string
      table: string
      action:
        | 'date_only'
        | 'migrated_to_fattura'
        | 'migrated_to_bolla'
        | 'unchanged'
        | 'error'
        | 'bolla_enriched'
        | 'fattura_enriched'
      previousData: string
      newData: string | null
      ocrTipo: string | null
    }[],
  }

  /** In dev, ultima riga bolla elaborata: perché non è migrata (localhost / Network tab). */
  let lastBollaMigrationDebug: {
    bollaId: string
    wantsFattura: boolean
    canMigrate: boolean
    ocrTipo: string | null
    numero_bolla: string | null
    importo: number | null
  } | null = null

  for (const item of queue) {
    if (report.scanned >= limit) break
    report.scanned++

    const table = item.kind === 'bolla' ? 'bolle' : 'fatture'
    const id = item.row.id

    try {
      const url = (item.row.file_url ?? '').trim()
      if (!url) {
        report.skipped++
        continue
      }
      let buf: Buffer
      let contentType: string
      const dl = await downloadStorageObjectByFileUrl(service, url)
      if ('error' in dl) {
        const res = await fetch(url)
        if (!res.ok) {
          report.errors.push({ id, table, message: `Download: ${dl.error}` })
          report.details.push({
            id,
            table,
            action: 'error',
            previousData: item.row.data,
            newData: null,
            ocrTipo: null,
          })
          continue
        }
        buf = Buffer.from(await res.arrayBuffer())
        contentType = resolvedContentTypeFromFetch(url, res.headers.get('content-type'))
      } else {
        buf = dl.data
        contentType = resolvedContentTypeFromFetch(url, dl.contentType)
      }
      if (contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
        const sniffed = inferContentTypeFromBuffer(buf)
        if (sniffed) contentType = sniffed
      }
      if (contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
        report.errors.push({ id, table, message: `Tipo non supportato: ${contentType}` })
        continue
      }

      /**
       * • bolla_id / fattura_id: rianalizza riga
       * • fornitore + allow_tipo_migrate + bolla: stessa qualità (PDF in vision) per bolla→fattura
       */
      const preferVisionForPdf =
        (Boolean(bollaIdForce) && item.kind === 'bolla') ||
        (Boolean(fatturaIdForce) && item.kind === 'fattura') ||
        (allowTipoMigrate && Boolean(fornitoreIdBatch) && item.kind === 'bolla')

      const ocr = await ocrInvoice(new Uint8Array(buf), contentType, undefined, {
        preferVisionForPdf,
      })
      const ocrTipo = ocr.tipo_documento
      const newData = pickDocDate(ocr, item.row.data)

      if (item.kind === 'bolla') {
        const b = item.row as BollaRow
        /** Come «Rianalizza» su riga: con batch fornitore le euristiche bolla→fattura sono abilitate su ogni bolla. */
        const bollaIdForMigration = Boolean(bollaIdForce) || Boolean(fornitoreIdBatch)
        const wantsFattura = shouldMigrateBollaRowToFattura({
          ocr: {
            tipo_documento: ocr.tipo_documento,
            numero_fattura: ocr.numero_fattura,
            totale_iva_inclusa: ocr.totale_iva_inclusa,
          },
          fileUrl: url,
          bollaIdForce: bollaIdForMigration,
          allowTipoMigrate,
          existingNumeroBolla: b.numero_bolla,
          existingImporto: b.importo,
        })
        const canMig = await canMigrateBollaToFattura(service, b.id)
        if (process.env.NODE_ENV === 'development') {
          lastBollaMigrationDebug = {
            bollaId: b.id,
            wantsFattura,
            canMigrate: canMig,
            ocrTipo,
            numero_bolla: b.numero_bolla,
            importo: b.importo,
          }
        }
        if (wantsFattura && !canMig) {
          report.errors.push({
            id,
            table: 'bolle',
            message:
              'Spostamento in Fatture non possibile: esiste già una fattura collegata a questa bolla o un collegamento in fattura_bolle. Scollega o elimina i collegamenti e riprova.',
          })
        }
        const toFattura = wantsFattura && canMig
        if (toFattura) {
          const payload = {
            user_id: ownerUserId,
            fornitore_id: b.fornitore_id,
            bolla_id: null as string | null,
            sede_id: b.sede_id,
            data: newData,
            file_url: b.file_url,
            importo: b.importo,
            numero_fattura: ocr.numero_fattura ?? b.numero_bolla,
          }
          let insRes = await service.from('fatture').insert([payload]).select('id').single()
          if (insRes.error && isMissingColumnError(insRes.error, 'user_id')) {
            const rest = { ...payload }
            delete (rest as { user_id?: unknown }).user_id
            insRes = await service.from('fatture').insert([rest]).select('id').single()
          }
          if (insRes.error) {
            report.errors.push({ id, table: 'bolle', message: insRes.error.message })
            continue
          }
          const ins = insRes.data as { id: string }
          const { error: delErr } = await service.from('bolle').delete().eq('id', b.id)
          if (delErr) {
            await service.from('fatture').delete().eq('id', ins.id)
            report.errors.push({ id, table: 'bolle', message: delErr.message })
            continue
          }
          report.tipoMigratedToFattura++
          report.details.push({
            id: ins.id,
            table: 'fatture',
            action: 'migrated_to_fattura',
            previousData: b.data,
            newData,
            ocrTipo,
          })
        } else {
          /** Rianalizza su singola bolla: applica di nuovo numero/importo da OCR (non solo se vuoti). */
          const isForcedBolla = Boolean(bollaIdForce && b.id === bollaIdForce)
          const numRaw = ocr.numero_fattura?.trim() ?? ''
          const ocrNum = numRaw ? (numRaw.length > 200 ? numRaw.slice(0, 200) : numRaw) : null
          const hasNum = Boolean(b.numero_bolla?.trim())
          const hasImp = b.importo != null && !Number.isNaN(Number(b.importo))
          const ocrImporto = ocr.totale_iva_inclusa

          const upd: Record<string, unknown> = {}
          if (newData && newData !== b.data) upd.data = newData
          if (isForcedBolla) {
            if (ocrNum && ocrNum !== (b.numero_bolla?.trim() ?? '')) upd.numero_bolla = ocrNum
            if (ocrImporto != null) {
              const cur = b.importo != null ? Number(b.importo) : null
              if (cur == null || Number.isNaN(cur) || ocrImporto !== cur) upd.importo = ocrImporto
            }
          } else {
            if (!hasNum && ocrNum) upd.numero_bolla = ocrNum
            if (!hasImp && ocrImporto != null) upd.importo = ocrImporto
          }

          if (Object.keys(upd).length) {
            const { error: u } = await service.from('bolle').update(upd).eq('id', b.id)
            if (u) {
              report.errors.push({ id, table, message: u.message })
            } else {
              const hadData = 'data' in upd
              const hadFields = 'numero_bolla' in upd || 'importo' in upd
              if (hadFields) report.bollaOcrEnriched++
              else if (hadData) report.dateOnlyFixes++
              const action: (typeof report.details)[number]['action'] =
                hadFields ? 'bolla_enriched' : 'date_only'
              report.details.push({
                id,
                table,
                action,
                previousData: b.data,
                newData: (upd.data as string | undefined) ?? b.data,
                ocrTipo,
              })
            }
          } else {
            report.details.push({
              id,
              table,
              action: 'unchanged',
              previousData: b.data,
              newData: b.data,
              ocrTipo,
            })
          }
        }
      } else {
        const f = item.row as FatturaRow
        const toBolla =
          allowTipoMigrate && ocrTipo === 'bolla' && (await canMigrateFatturaToBolla(service, f))
        if (toBolla) {
          const bollaPayload = {
            user_id: ownerUserId,
            fornitore_id: f.fornitore_id,
            sede_id: f.sede_id,
            data: newData,
            file_url: f.file_url,
            importo: f.importo,
            numero_bolla: ocr.numero_fattura ?? f.numero_fattura,
            stato: 'in attesa' as const,
          }
          let bIns = await service.from('bolle').insert([bollaPayload]).select('id').single()
          if (bIns.error && isMissingColumnError(bIns.error, 'user_id')) {
            const rest = { ...bollaPayload }
            delete (rest as { user_id?: unknown }).user_id
            bIns = await service.from('bolle').insert([rest]).select('id').single()
          }
          if (bIns.error) {
            report.errors.push({ id, table: 'fatture', message: bIns.error.message })
            continue
          }
          const ins = bIns.data as { id: string }
          const { error: delErr } = await service.from('fatture').delete().eq('id', f.id)
          if (delErr) {
            await service.from('bolle').delete().eq('id', ins.id)
            report.errors.push({ id, table: 'fatture', message: delErr.message })
            continue
          }
          report.tipoMigratedToBolla++
          report.details.push({
            id: ins.id,
            table: 'bolle',
            action: 'migrated_to_bolla',
            previousData: f.data,
            newData,
            ocrTipo,
          })
        } else {
          const isForcedFattura = Boolean(fatturaIdForce && f.id === fatturaIdForce)
          const numRaw = ocr.numero_fattura?.trim() ?? ''
          const ocrNum = numRaw ? (numRaw.length > 200 ? numRaw.slice(0, 200) : numRaw) : null
          const hasNum = Boolean(f.numero_fattura?.trim())
          const hasImp = f.importo != null && !Number.isNaN(Number(f.importo))
          const ocrImporto = ocr.totale_iva_inclusa

          const upd: Record<string, unknown> = {}
          if (newData && newData !== f.data) upd.data = newData
          if (isForcedFattura) {
            if (ocrNum && ocrNum !== (f.numero_fattura?.trim() ?? '')) upd.numero_fattura = ocrNum
            if (ocrImporto != null) {
              const cur = f.importo != null ? Number(f.importo) : null
              if (cur == null || Number.isNaN(cur) || ocrImporto !== cur) upd.importo = ocrImporto
            }
          } else {
            if (!hasNum && ocrNum) upd.numero_fattura = ocrNum
            if (!hasImp && ocrImporto != null) upd.importo = ocrImporto
          }

          if (Object.keys(upd).length) {
            const { error: u } = await service.from('fatture').update(upd).eq('id', f.id)
            if (u) {
              report.errors.push({ id, table, message: u.message })
            } else {
              const hadData = 'data' in upd
              const hadFields = 'numero_fattura' in upd || 'importo' in upd
              if (hadFields) report.fatturaOcrEnriched++
              else if (hadData) report.dateOnlyFixes++
              const action: (typeof report.details)[number]['action'] =
                hadFields ? 'fattura_enriched' : 'date_only'
              report.details.push({
                id,
                table,
                action,
                previousData: f.data,
                newData: (upd.data as string | undefined) ?? f.data,
                ocrTipo,
              })
            }
          } else {
            report.details.push({
              id,
              table,
              action: 'unchanged',
              previousData: f.data,
              newData: f.data,
              ocrTipo,
            })
          }
        }
      }
    } catch (e) {
      if (e instanceof OcrInvoiceConfigurationError) {
        return NextResponse.json({ error: e.message }, { status: 503 })
      }
      const msg = e instanceof Error ? e.message : 'Errore'
      report.errors.push({ id, table, message: msg })
    }
  }

  const corrected =
    report.dateOnlyFixes +
    report.tipoMigratedToFattura +
    report.tipoMigratedToBolla +
    report.bollaOcrEnriched +
    report.fatturaOcrEnriched

  return NextResponse.json({
    ...report,
    sede_id: sedeFilter,
    fornitore_id: fornitoreIdBatch || undefined,
    /** Documenti per cui è stata applicata almeno una correzione (data e/o migrazione tabella) */
    corrected,
    remaining: Math.max(0, queue.length - report.scanned),
    details: report.details.slice(0, 80),
    detailsTruncated: report.details.length > 80,
    ...(process.env.NODE_ENV === 'development' && lastBollaMigrationDebug
      ? { migrationDebug: lastBollaMigrationDebug }
      : {}),
  })
}
