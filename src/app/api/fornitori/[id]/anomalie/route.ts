import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import {
  analyzeBolleDuplicatesForDeletion,
  analyzeFatturaDuplicatesForDeletion,
  type FatturaDuplicateDeletionAnalysis,
} from '@/lib/check-duplicates'
import {
  countBolleImportOverPrezzoRekki,
  countRekkiUnitAnomaliesFromStatements,
  statementMatchesCalendarWindow,
} from '@/lib/rekki-price-anomalies'
import { statementOfficialDateIso } from '@/lib/statement-official-date'

export const dynamic = 'force-dynamic'

export type SupplierAnomalieApiRow = {
  id: string
  kind:
    | 'prezzo_listino'
    | 'fattura_duplicata'
    | 'bolla_duplicata'
    | 'estratto_conto'
    | 'bolla_aperta'
    | 'documento_coda'
  title: string
  subtitle: string | null
  severity: 'high' | 'medium' | 'low'
  /** Data documento (YYYY-MM-DD) per ordinamento e colonna tabella. */
  data: string | null
  numero: string | null
  importo: number | null
  fileUrl: string | null
  meta?: {
    fatturaId?: string
    bollaId?: string
    statementId?: string
    documentoId?: string
    resolved?: boolean
    differenzaPercent?: number
    /** In gruppi duplicati: copia consigliata da tenere vs copia in eccesso. */
    duplicateRole?: 'canonical' | 'excess'
    duplicateGroupKey?: string
    /** Se la data in anagrafica differisce da quella del documento originale nel gruppo. */
    registeredData?: string
  }
}

function duplicateDisplayDate(
  memberId: string,
  analysis: FatturaDuplicateDeletionAnalysis,
  dataById: Map<string, string>,
): { displayDate: string; registeredData?: string } {
  const groupKey = duplicateGroupKeyForId(memberId, analysis.groupMembers)
  const canonId = analysis.canonicalIdByGroupKey.get(groupKey)
  const memberDate = dataById.get(memberId) ?? ''
  const canonDate = canonId ? dataById.get(canonId) : null
  const displayDate = canonDate ?? memberDate
  if (memberDate && memberDate !== displayDate) {
    return { displayDate, registeredData: memberDate }
  }
  return { displayDate }
}

function duplicateGroupKeyForId(id: string, groupMembers: Map<string, string[]>): string {
  for (const [k, ids] of groupMembers) {
    if (ids.includes(id)) return k
  }
  return id
}

export type SupplierAnomalieApiResponse = {
  summary: {
    total: number
    prezzoListino: number
    rekki: number
    fattureDuplicati: number
    bolleDuplicati: number
    estrattiConto: number
    bolleAperte: number
    documentiInCoda: number
  }
  rows: SupplierAnomalieApiRow[]
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { id: fornitoreId } = await context.params
    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    if (!from || !to) {
      return NextResponse.json({ error: 'from e to richiesti' }, { status: 400 })
    }

    const dateBounds = { dateFrom: from, dateToExclusive: to }
    const service = createServiceClient()

    const [
      fattureRes,
      bolleRes,
      priceAnomaliesRes,
      stmtsRes,
      pendingRes,
      rekkiStmt,
      rekkiBolle,
    ] = await Promise.all([
      service
        .from('fatture')
        .select('id, data, importo, numero_fattura, file_url')
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to),
      service
        .from('bolle')
        .select('id, data, importo, numero_bolla, file_url, sede_id, email_sync_auto_saved_at, stato')
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to),
      service
        .from('price_anomalies')
        .select(
          'id, prodotto, prezzo_pagato, prezzo_listino, differenza_percent, fattura_id, resolved, created_at',
        )
        .eq('fornitore_id', fornitoreId)
        .eq('resolved', false)
        .order('differenza_percent', { ascending: false })
        .limit(100),
      service
        .from('statements')
        .select('id, missing_rows, received_at, document_date, extracted_pdf_dates, file_url')
        .eq('fornitore_id', fornitoreId)
        .order('received_at', { ascending: false })
        .limit(400),
      service
        .from('documenti_da_processare')
        .select('id, file_name, file_url, created_at, stato')
        .eq('fornitore_id', fornitoreId)
        .in('stato', ['in_attesa', 'da_processare', 'da_associare'])
        .gte('created_at', from)
        .lt('created_at', to)
        .order('created_at', { ascending: false })
        .limit(80),
      countRekkiUnitAnomaliesFromStatements(service, {
        sedeId: null,
        fornitoreIds: [fornitoreId],
        fiscalBounds: null,
        bollaDateBounds: dateBounds,
      }),
      countBolleImportOverPrezzoRekki(service, {
        fornitoreIds: [fornitoreId],
        bounds: dateBounds,
        sedeId: null,
      }),
    ])

    const fatture = (fattureRes.data ?? []) as {
      id: string
      data: string
      importo: number | null
      numero_fattura: string | null
      file_url: string | null
    }[]
    const bolle = (bolleRes.data ?? []) as {
      id: string
      data: string
      importo: number | null
      numero_bolla: string | null
      file_url: string | null
      stato: string
    }[]

    const fattDup = analyzeFatturaDuplicatesForDeletion(
      fatture.map((f) => ({
        id: f.id,
        data: f.data,
        importo: f.importo,
        fornitore_id: fornitoreId,
        numero_fattura: f.numero_fattura,
      })),
    )
    const bollaDup = analyzeBolleDuplicatesForDeletion(
      bolle.map((b) => ({
        id: b.id,
        data: b.data,
        fornitore_id: fornitoreId,
        numero_bolla: b.numero_bolla,
        file_url: (b as { file_url?: string | null }).file_url ?? null,
        sede_id: (b as { sede_id?: string | null }).sede_id ?? null,
        email_sync_auto_saved_at:
          (b as { email_sync_auto_saved_at?: string | null }).email_sync_auto_saved_at ?? null,
      })),
    )

    const fattureById = new Map(fatture.map((f) => [f.id, f]))
    const bolleById = new Map(bolle.map((b) => [b.id, b]))

    const rows: SupplierAnomalieApiRow[] = []

    for (const a of priceAnomaliesRes.data ?? []) {
      const row = a as {
        id: string
        prodotto: string
        prezzo_pagato: number
        prezzo_listino: number
        differenza_percent: number
        fattura_id: string | null
      }
      const linkedFattura = row.fattura_id ? fattureById.get(row.fattura_id) : null
      rows.push({
        id: `pl-${row.id}`,
        kind: 'prezzo_listino',
        title: row.prodotto,
        subtitle: `Pagato ${row.prezzo_pagato} · listino ${row.prezzo_listino} (+${(row.differenza_percent * 100).toFixed(1)}%)`,
        severity: row.differenza_percent >= 0.15 ? 'high' : 'medium',
        data: linkedFattura?.data ?? null,
        numero: linkedFattura?.numero_fattura ?? null,
        importo: row.prezzo_pagato,
        fileUrl: linkedFattura?.file_url?.trim() || null,
        meta: {
          fatturaId: row.fattura_id ?? undefined,
          differenzaPercent: row.differenza_percent,
          resolved: false,
        },
      })
    }

    if (rekkiStmt + rekkiBolle > 0) {
      rows.push({
        id: 'rekki-summary',
        kind: 'prezzo_listino',
        title: 'Prezzo consegna vs Rekki',
        subtitle: `${rekkiStmt + rekkiBolle} voce/i con importo superiore al riferimento ordine`,
        severity: 'high',
        data: null,
        numero: null,
        importo: null,
        fileUrl: null,
        meta: {},
      })
    }

    const fatturaDataById = new Map(fatture.map((f) => [f.id, f.data]))
    for (const memberId of fattDup.memberIds) {
      const f = fattureById.get(memberId)
      if (!f) continue
      const isExcess = fattDup.excessIds.has(memberId)
      const { displayDate, registeredData } = duplicateDisplayDate(memberId, fattDup, fatturaDataById)
      rows.push({
        id: `fd-${memberId}`,
        kind: 'fattura_duplicata',
        title: f.numero_fattura?.trim() ? `#${f.numero_fattura.trim()}` : 'Fattura duplicata',
        subtitle: null,
        severity: 'high',
        data: displayDate,
        numero: f.numero_fattura,
        importo: f.importo,
        fileUrl: f.file_url?.trim() || null,
        meta: {
          fatturaId: memberId,
          duplicateRole: isExcess ? 'excess' : 'canonical',
          duplicateGroupKey: duplicateGroupKeyForId(memberId, fattDup.groupMembers),
          registeredData,
        },
      })
    }

    const bollaDataById = new Map(bolle.map((b) => [b.id, b.data]))
    for (const memberId of bollaDup.memberIds) {
      const b = bolleById.get(memberId)
      if (!b) continue
      const isExcess = bollaDup.excessIds.has(memberId)
      const { displayDate, registeredData } = duplicateDisplayDate(memberId, bollaDup, bollaDataById)
      rows.push({
        id: `bd-${memberId}`,
        kind: 'bolla_duplicata',
        title: b.numero_bolla?.trim() ? `DDT ${b.numero_bolla.trim()}` : 'Bolla duplicata',
        subtitle: null,
        severity: 'high',
        data: displayDate,
        numero: b.numero_bolla,
        importo: b.importo,
        fileUrl: b.file_url?.trim() || null,
        meta: {
          bollaId: memberId,
          duplicateRole: isExcess ? 'excess' : 'canonical',
          duplicateGroupKey: duplicateGroupKeyForId(memberId, bollaDup.groupMembers),
          registeredData,
        },
      })
    }

    const stmtData = (stmtsRes.data ?? []) as {
      id: string
      missing_rows: number | null
      received_at: string
      document_date: string | null
      extracted_pdf_dates: unknown
      file_url: string | null
    }[]
    for (const s of stmtData) {
      if (!statementMatchesCalendarWindow(s, from, to)) continue
      const missing = s.missing_rows ?? 0
      if (missing <= 0) continue
      const officialDate = statementOfficialDateIso({
        document_date: s.document_date,
        extracted_pdf_dates: s.extracted_pdf_dates,
      })
      const receivedIso = s.received_at.slice(0, 10)
      const displayDate = officialDate ?? receivedIso
      const subtitle =
        missing === 1
          ? `1 riga da verificare${officialDate ? '' : ' · data di ricezione nell\'app'}`
          : `${missing} righe da verificare${officialDate ? '' : ' · data di ricezione nell\'app'}`
      rows.push({
        id: `st-${s.id}`,
        kind: 'estratto_conto',
        title: 'Estratto conto',
        subtitle,
        severity: missing >= 3 ? 'high' : 'medium',
        data: displayDate,
        numero: null,
        importo: null,
        fileUrl: s.file_url?.trim() || null,
        meta: { statementId: s.id },
      })
    }

    const bolleAperte = bolle.filter((b) => b.stato === 'in attesa')
    for (const b of bolleAperte) {
      rows.push({
        id: `ba-${b.id}`,
        kind: 'bolla_aperta',
        title: b.numero_bolla?.trim() ? `DDT ${b.numero_bolla.trim()}` : 'Bolla',
        subtitle: null,
        severity: 'low',
        data: b.data,
        numero: b.numero_bolla,
        importo: b.importo,
        fileUrl: b.file_url?.trim() || null,
        meta: { bollaId: b.id },
      })
    }

    for (const d of pendingRes.data ?? []) {
      const doc = d as {
        id: string
        file_name: string | null
        file_url: string | null
        created_at: string
        stato: string
      }
      rows.push({
        id: `doc-${doc.id}`,
        kind: 'documento_coda',
        title: doc.file_name?.trim() || 'Documento in coda',
        subtitle: doc.stato.replace(/_/g, ' '),
        severity: 'medium',
        data: doc.created_at.slice(0, 10),
        numero: null,
        importo: null,
        fileUrl: doc.file_url?.trim() || null,
        meta: { documentoId: doc.id },
      })
    }

    rows.sort((a, b) => {
      const aGrp = a.meta?.duplicateGroupKey
      const bGrp = b.meta?.duplicateGroupKey
      if (aGrp && bGrp && aGrp === bGrp) {
        const aCanon = a.meta?.duplicateRole === 'canonical' ? 0 : 1
        const bCanon = b.meta?.duplicateRole === 'canonical' ? 0 : 1
        if (aCanon !== bCanon) return aCanon - bCanon
        return (b.data ?? '').localeCompare(a.data ?? '')
      }
      return (b.data ?? '').localeCompare(a.data ?? '')
    })

    const fattureDuplicati = fattDup.memberIds.size
    const bolleDuplicati = bollaDup.memberIds.size
    const estrattiConto = rows.filter((r) => r.kind === 'estratto_conto').length
    const bolleAperteCount = bolleAperte.length
    const documentiInCoda = pendingRes.data?.length ?? 0
    const rekkiTotal = rekkiStmt + rekkiBolle

    const summary = {
      prezzoListino: priceAnomaliesRes.data?.length ?? 0,
      rekki: rekkiTotal,
      fattureDuplicati,
      bolleDuplicati,
      estrattiConto,
      bolleAperte: bolleAperteCount,
      documentiInCoda,
      total: rows.length,
    }

    return NextResponse.json({ summary, rows } satisfies SupplierAnomalieApiResponse)
  } catch (err) {
    console.error('[GET /api/fornitori/anomalie]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Errore recupero anomalie' }, { status: 500 })
  }
}
