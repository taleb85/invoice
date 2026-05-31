import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import {
  analyzeBolleDuplicatesForDeletion,
  analyzeFatturaDuplicatesForDeletion,
} from '@/lib/check-duplicates'
import {
  countBolleImportOverPrezzoRekki,
  countRekkiUnitAnomaliesFromStatements,
} from '@/lib/rekki-price-anomalies'
import { findSameDomainPeersForFornitore } from '@/lib/fornitore-same-domain'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const fornitoreId = req.nextUrl.searchParams.get('fornitore_id')
    if (!fornitoreId) {
      return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
    }

    const from = req.nextUrl.searchParams.get('from')
    const to = req.nextUrl.searchParams.get('to')
    if (!from || !to) {
      return NextResponse.json({ error: 'from e to richiesti' }, { status: 400 })
    }

    const service = createServiceClient()

    const [
      bolleCountRes,
      bolleAperteRes,
      fattureRes,
      bolleRowsRes,
      listinoRes,
      stmtsRes,
      ordiniRes,
      anomalieRes,
      pendingRes,
    ] = await Promise.all([
      service.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).gte('data', from).lt('data', to),
      service.from('bolle').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).eq('stato', 'in attesa').gte('data', from).lt('data', to),
      service
        .from('fatture')
        .select('id, data, importo, numero_fattura, is_credit_note, file_url')
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to),
      service
        .from('bolle')
        .select('id, data, numero_bolla, file_url, sede_id, email_sync_auto_saved_at')
        .eq('fornitore_id', fornitoreId)
        .gte('data', from)
        .lt('data', to),
      service.from('listino_prezzi').select('prodotto').eq('fornitore_id', fornitoreId).gte('data_prezzo', from).lt('data_prezzo', to).limit(8000),
      service.from('statements').select('missing_rows, received_at, extracted_pdf_dates').eq('fornitore_id', fornitoreId).order('received_at', { ascending: false }).limit(800),
      service.from('conferme_ordine').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).gte('created_at', from).lt('created_at', to),
      service.from('price_anomalies').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).eq('resolved', false),
      service.from('documenti_da_processare').select('id', { count: 'exact', head: true }).eq('fornitore_id', fornitoreId).in('stato', ['in_attesa', 'da_processare', 'da_associare']).gte('created_at', from).lt('created_at', to),
    ])

    const fattureRows = (fattureRes.data ?? []) as { importo: number | null; is_credit_note?: boolean | null }[]
    const totaleSpesaLordo = fattureRows.reduce((s, f) => s + (f.importo ?? 0), 0)
    const creditNoteTotal = fattureRows
      .filter(f => f.is_credit_note === true)
      .reduce((s, f) => s + (f.importo ?? 0), 0)
    const dup = analyzeFatturaDuplicatesForDeletion(
      (fattureRes.data ?? []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        data: f.data as string,
        importo: f.importo as number | null,
        fornitore_id: fornitoreId,
        numero_fattura: f.numero_fattura as string | null,
        file_url: f.file_url as string | null,
      })),
    )
    const bollaDup = analyzeBolleDuplicatesForDeletion(
      (bolleRowsRes.data ?? []).map((b: Record<string, unknown>) => ({
        id: b.id as string,
        data: b.data as string,
        fornitore_id: fornitoreId,
        numero_bolla: b.numero_bolla as string | null,
        file_url: b.file_url as string | null,
        sede_id: b.sede_id as string | null,
        email_sync_auto_saved_at: b.email_sync_auto_saved_at as string | null,
      })),
    )
    const dateBounds = { dateFrom: from, dateToExclusive: to }
    const [rekkiStmt, rekkiBolle, sameDomainPeers] = await Promise.all([
      countRekkiUnitAnomaliesFromStatements(service, {
        sedeId: null,
        fornitoreIds: [fornitoreId],
        fiscalBounds: null,
        bollaDateBounds: dateBounds,
      }),
      countBolleImportOverPrezzoRekki(service, {
        fornitoreIds: [fornitoreId],
        bounds: dateBounds,
      }),
      findSameDomainPeersForFornitore(service, fornitoreId),
    ])
    const totaleSpesa = Math.max(0, totaleSpesaLordo - dup.surplusImporto - creditNoteTotal)

    const listinoRowsData = (listinoRes.data ?? []) as { prodotto: string }[]
    const listinoRows = listinoRowsData.length
    const listinoProdottiDistinti = new Set(listinoRowsData.map((r) => String(r.prodotto ?? '').trim()).filter(Boolean)).size

    const stmtData = (stmtsRes.data ?? []) as { missing_rows: number | null; received_at: string; extracted_pdf_dates: unknown }[]
    const statementsInPeriod = stmtData.filter((s) => {
      const d = s.received_at?.slice(0, 10)
      return d && d >= from && d < to
    }).length
    const statementsWithIssues = stmtData.filter((s) => (s.missing_rows ?? 0) > 0).length

    return NextResponse.json({
      bolleTotal: bolleCountRes.count ?? 0,
      bolleAperte: bolleAperteRes.count ?? 0,
      fattureTotal: fattureRes.data?.length ?? 0,
      ordiniNelPeriodo: ordiniRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      totaleSpesaLordo,
      totaleSpesa,
      listinoRows,
      listinoProdottiDistinti,
      statementsInPeriod,
      statementsWithIssues,
      rekkiPriceAnomalies: rekkiStmt + rekkiBolle,
      listinoAnomaliesCount: anomalieRes.count ?? 0,
      fattureDuplicateExcess: dup.excessIds.size,
      bolleDuplicateExcess: bollaDup.excessIds.size,
      sameDomainPeerCount: sameDomainPeers.length,
    })
  } catch (err) {
    console.error('[GET /api/fornitori/stats]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Errore recupero statistiche' }, { status: 500 })
  }
}
