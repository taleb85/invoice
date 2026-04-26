import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { safeDate } from '@/lib/safe-date'
import {
  isSuspiciousDocumentDate,
  resolvedContentTypeFromFetch,
} from '@/lib/fix-ocr-dates-helpers'

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
  verificata_estratto_conto: boolean | null
  analizzata: boolean | null
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
 * Rianalizza con Gemini (prompt aggiornato) i documenti con `data` sospetta
 * e corregge data e tipo (tabella) dove possibile.
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
  if (!isMasterAdminRole(profile.role) && !isAdminSedeRole(profile.role)) {
    return NextResponse.json({ error: 'Solo amministratore o responsabile sede' }, { status: 403 })
  }

  /** Proprietario per nuove righe in migrazione: diversi DB non espongono più `user_id` su bolle. */
  const ownerUserId = profile.id

  let body: { limit?: number; sede_id?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const limit = Math.min(150, Math.max(1, Number(body?.limit) || 40))
  const sedeFromBody = typeof body.sede_id === 'string' ? body.sede_id.trim() : ''

  if (isAdminSedeRole(profile.role)) {
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

  let fattureQ = service
    .from('fatture')
    .select(
      'id, fornitore_id, bolla_id, sede_id, data, file_url, importo, numero_fattura, verificata_estratto_conto, analizzata',
    )
    .not('file_url', 'is', null)
  if (sedeFilter) fattureQ = fattureQ.eq('sede_id', sedeFilter)
  const { data: fattureAll, error: fErr } = await fattureQ.or(orFilter)

  if (fErr) {
    console.error('[fix-ocr-dates] fatture query', fErr)
    return NextResponse.json({ error: fErr.message }, { status: 500 })
  }

  const bolle: BollaRow[] = (bolleAll as BollaRow[] | null)?.filter((r) => isSuspiciousDocumentDate(r.data)) ?? []
  const fatture: FatturaRow[] =
    (fattureAll as FatturaRow[] | null)?.filter((r) => isSuspiciousDocumentDate(r.data)) ?? []

  type QueueItem = { kind: 'bolla' | 'fattura'; row: BollaRow | FatturaRow }
  const queue: QueueItem[] = [
    ...bolle.map((row) => ({ kind: 'bolla' as const, row })),
    ...fatture.map((row) => ({ kind: 'fattura' as const, row })),
  ]

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
    details: [] as {
      id: string
      table: string
      action: 'date_only' | 'migrated_to_fattura' | 'migrated_to_bolla' | 'unchanged' | 'error'
      previousData: string
      newData: string | null
      ocrTipo: string | null
    }[],
  }

  for (const item of queue) {
    if (report.scanned >= limit) break
    report.scanned++

    const table = item.kind === 'bolla' ? 'bolle' : 'fatture'
    const id = item.row.id

    try {
      const url = item.row.file_url
      if (!url?.trim()) {
        report.skipped++
        continue
      }
      const res = await fetch(url)
      if (!res.ok) {
        report.errors.push({ id, table, message: `Download HTTP ${res.status}` })
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
      const buf = Buffer.from(await res.arrayBuffer())
      let contentType = resolvedContentTypeFromFetch(url, res.headers.get('content-type'))
      if (contentType === 'application/octet-stream' && url.toLowerCase().includes('.pdf')) {
        contentType = 'application/pdf'
      }
      if (contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
        report.errors.push({ id, table, message: `Tipo non supportato: ${contentType}` })
        continue
      }

      const ocr = await ocrInvoice(new Uint8Array(buf), contentType)
      const ocrTipo = ocr.tipo_documento
      const newData = pickDocDate(ocr, item.row.data)

      if (item.kind === 'bolla') {
        const b = item.row as BollaRow
        const toFattura = ocrTipo === 'fattura' && (await canMigrateBollaToFattura(service, b.id))
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
            verificata_estratto_conto: false,
            analizzata: false,
          }
          let insRes = await service.from('fatture').insert([payload]).select('id').single()
          if (insRes.error && isMissingColumnError(insRes.error, 'user_id')) {
            const { user_id: _u, ...rest } = payload
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
          if (newData && newData !== b.data) {
            const { error: u } = await service.from('bolle').update({ data: newData }).eq('id', b.id)
            if (u) {
              report.errors.push({ id, table, message: u.message })
            } else {
              report.dateOnlyFixes++
              report.details.push({
                id,
                table,
                action: 'date_only',
                previousData: b.data,
                newData,
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
        const toBolla = ocrTipo === 'bolla' && (await canMigrateFatturaToBolla(service, f))
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
            const { user_id: _u, ...rest } = bollaPayload
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
          if (newData && newData !== f.data) {
            const { error: u } = await service.from('fatture').update({ data: newData }).eq('id', f.id)
            if (u) {
              report.errors.push({ id, table, message: u.message })
            } else {
              report.dateOnlyFixes++
              report.details.push({
                id,
                table,
                action: 'date_only',
                previousData: f.data,
                newData,
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
    report.dateOnlyFixes + report.tipoMigratedToFattura + report.tipoMigratedToBolla

  return NextResponse.json({
    ...report,
    sede_id: sedeFilter,
    /** Documenti per cui è stata applicata almeno una correzione (data e/o migrazione tabella) */
    corrected,
    remaining: Math.max(0, queue.length - report.scanned),
    details: report.details.slice(0, 80),
    detailsTruncated: report.details.length > 80,
  })
}
