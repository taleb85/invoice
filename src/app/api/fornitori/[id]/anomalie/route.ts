import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import {
  analyzeBolleDuplicatesForDeletion,
  analyzeFatturaDuplicatesForDeletion,
} from '@/lib/check-duplicates'
import {
  countBolleImportOverPrezzoRekki,
  countRekkiUnitAnomaliesFromStatements,
  statementMatchesCalendarWindow,
} from '@/lib/rekki-price-anomalies'

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
  meta?: {
    fatturaId?: string
    bollaId?: string
    statementId?: string
    documentoId?: string
    resolved?: boolean
    differenzaPercent?: number
  }
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
        .select('id, missing_rows, received_at, extracted_pdf_dates')
        .eq('fornitore_id', fornitoreId)
        .order('received_at', { ascending: false })
        .limit(400),
      service
        .from('documenti_da_processare')
        .select('id, file_name, created_at, stato')
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
    }[]
    const bolle = (bolleRes.data ?? []) as {
      id: string
      data: string
      importo: number | null
      numero_bolla: string | null
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
      rows.push({
        id: `pl-${row.id}`,
        kind: 'prezzo_listino',
        title: row.prodotto,
        subtitle: `Pagato ${row.prezzo_pagato} · listino ${row.prezzo_listino} (+${(row.differenza_percent * 100).toFixed(1)}%)`,
        severity: row.differenza_percent >= 0.15 ? 'high' : 'medium',
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
        meta: {},
      })
    }

    for (const excessId of fattDup.excessIds) {
      const f = fattureById.get(excessId)
      if (!f) continue
      rows.push({
        id: `fd-${excessId}`,
        kind: 'fattura_duplicata',
        title: f.numero_fattura?.trim() ? `#${f.numero_fattura.trim()}` : 'Fattura duplicata',
        subtitle: [f.data, f.importo != null ? `£${Number(f.importo).toFixed(2)}` : null]
          .filter(Boolean)
          .join(' · '),
        severity: 'high',
        meta: { fatturaId: excessId },
      })
    }

    for (const excessId of bollaDup.excessIds) {
      const b = bolleById.get(excessId)
      if (!b) continue
      rows.push({
        id: `bd-${excessId}`,
        kind: 'bolla_duplicata',
        title: b.numero_bolla?.trim() ? `DDT ${b.numero_bolla.trim()}` : 'Bolla duplicata',
        subtitle: b.data,
        severity: 'high',
        meta: { bollaId: excessId },
      })
    }

    const stmtData = (stmtsRes.data ?? []) as {
      id: string
      missing_rows: number | null
      received_at: string
      extracted_pdf_dates: unknown
    }[]
    for (const s of stmtData) {
      if (!statementMatchesCalendarWindow(s, from, to)) continue
      const missing = s.missing_rows ?? 0
      if (missing <= 0) continue
      rows.push({
        id: `st-${s.id}`,
        kind: 'estratto_conto',
        title: 'Estratto conto con righe mancanti',
        subtitle: `${missing} anomalia/e · ricevuto ${s.received_at.slice(0, 10)}`,
        severity: missing >= 3 ? 'high' : 'medium',
        meta: { statementId: s.id },
      })
    }

    const bolleAperte = bolle.filter((b) => b.stato === 'in attesa')
    for (const b of bolleAperte) {
      rows.push({
        id: `ba-${b.id}`,
        kind: 'bolla_aperta',
        title: b.numero_bolla?.trim() ? `DDT ${b.numero_bolla.trim()} in attesa` : 'Bolla in attesa',
        subtitle: b.data,
        severity: 'low',
        meta: { bollaId: b.id },
      })
    }

    for (const d of pendingRes.data ?? []) {
      const doc = d as { id: string; file_name: string | null; created_at: string; stato: string }
      rows.push({
        id: `doc-${doc.id}`,
        kind: 'documento_coda',
        title: doc.file_name?.trim() || 'Documento in coda',
        subtitle: `${doc.stato.replace(/_/g, ' ')} · ${doc.created_at.slice(0, 10)}`,
        severity: 'medium',
        meta: { documentoId: doc.id },
      })
    }

    const fattureDuplicati = fattDup.excessIds.size
    const bolleDuplicati = bollaDup.excessIds.size
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
