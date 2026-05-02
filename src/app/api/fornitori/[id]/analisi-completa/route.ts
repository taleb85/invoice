import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { detectAllDuplicates, type AllDuplicatesReport } from '@/lib/duplicate-detector'
import { compareIsoDateStrings, isDocumentDateAtLeastLatestListino } from '@/lib/listino-document-date'
import { LISTINO_SRC_FATTURA_MARK } from '@/lib/listino-display'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function maxDateForProducts(
  rows: Array<{ prodotto: string; data_prezzo: string }>,
  products: Set<string>,
): Map<string, string> {
  const m = new Map<string, string>()
  for (const row of rows) {
    const p = String(row.prodotto).trim()
    if (!products.has(p)) continue
    const d = String(row.data_prezzo).slice(0, 10)
    const cur = m.get(p)
    if (!cur || compareIsoDateStrings(d, cur) > 0) m.set(p, d)
  }
  return m
}

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: fornitoreId } = await params
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

  // 3 Duplicates (sede-scoped)
  try {
    const dupReport = await detectAllDuplicates(fornitoreSedeId, service)
    const hits = duplicateHitsForFornitore(dupReport, fornitoreId)
    report.duplicates = { totalReported: dupReport.total, itemsTouchingFornitore: hits }
  } catch (e) {
    ;(report.errors as string[]).push(`Duplicati: ${e instanceof Error ? e.message : String(e)}`)
  }

  // 4–5 Listino: importa da fatture non analizzate (stessa logica della scheda fornitore)
  let listinoInserted = 0
  let listinoFattureScanned = 0
  try {
    if (!process.env.GEMINI_API_KEY) {
      report.listino = { skipped: true, reason: 'GEMINI_API_KEY non configurata' }
    } else {
      const { data: fattureData } = await service
        .from('fatture')
        .select('id, data, numero_fattura, file_url, analizzata')
        .eq('fornitore_id', fornitoreId)
        .not('file_url', 'is', null)
        .order('data', { ascending: false })

      const fattureToProcess = (fattureData ?? []).filter(
        (f: { analizzata?: boolean | null }) => !f.analizzata,
      ) as { id: string; data: string; numero_fattura: string | null; file_url: string | null }[]

      const { data: listinoFresh } = await service
        .from('listino_prezzi')
        .select('prodotto, data_prezzo')
        .eq('fornitore_id', fornitoreId)

      const listinoRows = (listinoFresh ?? []) as Array<{ prodotto: string; data_prezzo: string }>

      for (const fattura of fattureToProcess) {
        const imp = await fetch(`${base}/api/listino/importa-da-fattura`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ fattura_id: fattura.id }),
        })
        const json = (await imp.json().catch(() => ({}))) as {
          items?: Array<{
            prodotto: string
            prezzo: number
            codice_prodotto?: string | null
            unita: string | null
            note: string | null
          }>
          data_fattura?: string | null
        }
        if (!imp.ok || !Array.isArray(json.items) || json.items.length === 0) {
          await service.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
          listinoFattureScanned++
          continue
        }

        const docDate =
          String(json.data_fattura ?? fattura.data ?? '').slice(0, 10) ||
          new Date().toISOString().split('T')[0]

        const products = new Set(json.items.map((i) => String(i.prodotto).trim()).filter(Boolean))
        const maxByProduct = maxDateForProducts(listinoRows, products)

        const rowsOut: Array<{
          prodotto: string
          prezzo: number
          data_prezzo: string
          note: string | null
        }> = []

        const fatturaLabel = fattura.numero_fattura
          ? `Fattura ${fattura.numero_fattura} — ${fattura.data}`
          : `Fattura · ${fattura.data}`

        for (const item of json.items) {
          const prodotto = String(item.prodotto ?? '').trim()
          if (!prodotto || typeof item.prezzo !== 'number' || item.prezzo <= 0) continue
          const latest = maxByProduct.get(prodotto) ?? null
          if (latest != null && !isDocumentDateAtLeastLatestListino(docDate, latest)) continue

          const baseNote = [
            item.codice_prodotto ? `Codice: ${item.codice_prodotto}` : null,
            item.unita ? `Unità: ${item.unita}` : null,
            item.note,
          ]
            .filter(Boolean)
            .join(' — ') || null
          const note = baseNote
            ? `${baseNote} — Origine: ${fatturaLabel}${LISTINO_SRC_FATTURA_MARK}${fattura.id}|`
            : `Origine listino — Origine: ${fatturaLabel}${LISTINO_SRC_FATTURA_MARK}${fattura.id}|`

          rowsOut.push({ prodotto, prezzo: item.prezzo, data_prezzo: docDate, note })
        }

        if (rowsOut.length === 0) {
          await service.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
          listinoFattureScanned++
          continue
        }

        const save = await fetch(`${base}/api/listino/prezzi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ fornitore_id: fornitoreId, rows: rowsOut }),
        })
        const saveJson = (await save.json().catch(() => ({}))) as { inserted?: number; error?: string }
        if (save.ok) {
          listinoInserted += saveJson.inserted ?? rowsOut.length
          await service.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
          for (const r of rowsOut) {
            const p = r.prodotto.trim()
            const d = r.data_prezzo.slice(0, 10)
            const cur = maxByProduct.get(p)
            if (!cur || compareIsoDateStrings(d, cur) > 0) maxByProduct.set(p, d)
            listinoRows.push({ prodotto: p, data_prezzo: d })
          }
        } else {
          ;(report.errors as string[]).push(
            `Listino salvataggio fattura ${fattura.id}: ${saveJson.error ?? save.status}`,
          )
        }
        listinoFattureScanned++
      }

      report.listino = { fattureScanned: listinoFattureScanned, righeInserite: listinoInserted }
    }
  } catch (e) {
    ;(report.errors as string[]).push(`Listino: ${e instanceof Error ? e.message : String(e)}`)
  }

  return NextResponse.json({
    ok: true,
    fornitore: { id: fornitoreId, nome: fornitoreRow.nome },
    ...report,
  })
}
