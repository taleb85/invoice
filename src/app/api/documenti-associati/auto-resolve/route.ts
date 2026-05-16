import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { logger } from '@/lib/logger'
import { ocrTipoHintKey } from '@/lib/fornitore-doc-type-hints'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createServiceClient()

    const { data: allDocs, error } = await supabase
      .from('documenti_da_processare')
      .select('id, fornitore_id, sede_id, data_documento, file_url, file_name, fattura_id, bolla_id, created_at, metadata')
      .eq('stato', 'associato')

    if (error || !allDocs?.length) {
      return NextResponse.json({ success: false, error: error?.message || 'Nessun documento' }, { status: 400 })
    }

    const docs = allDocs as Record<string, unknown>[]

    const seenUrl = new Set<string>()
    const docsUnici = docs.filter(d => {
      const url = d.file_url as string | undefined
      if (!url) return true
      if (seenUrl.has(url)) return false
      seenUrl.add(url)
      return true
    })

    // Pre-carica riferimenti fatture e bolle
    const fatturaIds = [...new Set(docs.map(d => d.fattura_id as string).filter(Boolean))]
    const bollaIds = [...new Set(docs.map(d => d.bolla_id as string).filter(Boolean))]

    const [fattureRes, bolleRes] = await Promise.all([
      fatturaIds.length
        ? supabase.from('fatture').select('id').in('id', fatturaIds)
        : { data: [] as { id: string }[] },
      bollaIds.length
        ? supabase.from('bolle').select('id').in('id', bollaIds)
        : { data: [] as { id: string }[] },
    ])

    const fattureEsistenti = new Set((fattureRes.data ?? []).map((r: { id: string }) => r.id))
    const bolleEsistenti = new Set((bolleRes.data ?? []).map((r: { id: string }) => r.id))

    // Verifica esistenza file su storage: raggruppa tutti i file_url unici
    const allFileUrls = [...new Set(docsUnici.map(d => d.file_url as string).filter(Boolean))]
    const storageExists = new Set<string>()

    const batchSize = 20
    for (let i = 0; i < allFileUrls.length; i += batchSize) {
      const batch = allFileUrls.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
            if (res.ok || res.status === 200) return url
          } catch { /* file non raggiungibile */ }
          return null
        })
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) storageExists.add(r.value)
      }
    }

    // Pre-carica TUTTI gli hint di apprendimento per tutti i fornitori coinvolti
    const fornitoreIds = [...new Set(docsUnici.map(d => d.fornitore_id as string).filter(Boolean))]
    const hintsMap = new Map<string, string>() // key: `${fornitore_id}::${ocr_tipo_key}` → pending_kind

    if (fornitoreIds.length) {
      const { data: hints } = await supabase
        .from('fornitore_ocr_tipo_pending_kind_hints')
        .select('fornitore_id, ocr_tipo_key, pending_kind')
        .in('fornitore_id', fornitoreIds)

      for (const h of (hints ?? []) as { fornitore_id: string; ocr_tipo_key: string; pending_kind: string }[]) {
        hintsMap.set(`${h.fornitore_id}::${h.ocr_tipo_key}`, h.pending_kind)
      }
    }

    // Applica hint di apprendimento
    const hintApplicati: { id: string; kind: string }[] = []

    for (const doc of docsUnici) {
      const fornitoreId = doc.fornitore_id as string | null
      const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
        ? (doc.metadata as Record<string, unknown>)
        : null
      const tipoDoc = meta?.tipo_documento ?? null
      const ocrKey = fornitoreId && tipoDoc ? ocrTipoHintKey(tipoDoc) : null
      const hintKey = fornitoreId && ocrKey ? `${fornitoreId}::${ocrKey}` : null
      const learnedKind = hintKey ? hintsMap.get(hintKey) : null

      if (learnedKind && meta) {
        meta.pending_kind = learnedKind
        const { error: updErr } = await supabase
          .from('documenti_da_processare')
          .update({ metadata: meta, stato: 'associato' })
          .eq('id', doc.id as string)

        if (!updErr) {
          hintApplicati.push({ id: doc.id as string, kind: learnedKind })
        }
      }
    }

    // Ora le anomalie strutturali solo sui documenti rimanenti (senza hint)
    const docsConHint = new Set(hintApplicati.map(h => h.id))
    let scartati = 0
    let resettati = 0
    let saltati = 0
    const batchId = crypto.randomUUID()
    const risultati: { id: string; action: string }[] = []

    for (const doc of docsUnici) {
      if (docsConHint.has(doc.id as string)) continue

      const anomalie = buildAnomalie(doc, storageExists, fattureEsistenti, bolleEsistenti)
      if (anomalie.length === 0) { saltati++; continue }

      const consiglio = anomalie.some(a => a.tipo === 'file_mancante' || a.tipo === 'file_inesistente') ? 'scarta' : 'resetta'

      const updateData = consiglio === 'scarta'
        ? { stato: 'scartato' as const, fattura_id: null, bolla_id: null, note: `Auto-risolto: scartato (batch ${batchId.slice(0, 8)})` }
        : { stato: 'da_associare' as const, fattura_id: null, bolla_id: null, note: `Auto-risolto: riassegnato (batch ${batchId.slice(0, 8)})` }

      const { error: updErr } = await supabase
        .from('documenti_da_processare')
        .update(updateData)
        .eq('id', doc.id as string)

      if (!updErr) {
        risultati.push({ id: doc.id as string, action: consiglio })
        if (consiglio === 'scarta') scartati++
        else resettati++
      }
    }

    return NextResponse.json({
      success: true,
      batch_id: batchId,
      processati: risultati.length,
      scartati,
      resettati,
      hint_applicati: hintApplicati.length,
      saltati,
      message: [
        risultati.length ? `${risultati.length} risolti (${scartati} scartati, ${resettati} riassegnati)` : '',
        hintApplicati.length ? `${hintApplicati.length} categorizzati da apprendimento AI` : '',
        saltati ? `${saltati} già OK` : '',
      ].filter(Boolean).join(', ') || 'Nessuna modifica',
    })
  } catch (err) {
    logger.error('Errore auto-resolve', err)
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 })
  }
}

type Anomalia = { id: string; tipo: string; gravita: string; descrizione: string; documento_id: string }

function buildAnomalie(
  doc: Record<string, unknown>,
  storageExists: Set<string>,
  fattureEsistenti: Set<string>,
  bolleEsistenti: Set<string>,
): Anomalia[] {
  const anomalie: Anomalia[] = []
  const id = doc.id as string
  const fileUrl = doc.file_url as string | null

  if (fileUrl && !storageExists.has(fileUrl)) {
    anomalie.push({ id: `file-missing-${id}`, tipo: 'file_inesistente', gravita: 'alta', descrizione: 'File non trovato su storage.', documento_id: id })
  }
  if (!fileUrl) {
    anomalie.push({ id: `file-${id}`, tipo: 'file_mancante', gravita: 'alta', descrizione: 'Nessun file_url associato.', documento_id: id })
  }
  if (!doc.fornitore_id) {
    anomalie.push({ id: `forn-${id}`, tipo: 'fornitore_mancante', gravita: 'alta', descrizione: 'Fornitore mancante.', documento_id: id })
  }
  if (!doc.sede_id) {
    anomalie.push({ id: `sede-${id}`, tipo: 'sede_mancante', gravita: 'media', descrizione: 'Sede mancante.', documento_id: id })
  }
  if (!doc.fattura_id && !doc.bolla_id) {
    anomalie.push({ id: `rif-${id}`, tipo: 'riferimento_assente', gravita: 'alta', descrizione: 'Nessun riferimento.', documento_id: id })
  }

  const fattId = doc.fattura_id as string | null
  if (fattId && !fattureEsistenti.has(fattId)) {
    anomalie.push({ id: `fk-fatt-${id}`, tipo: 'riferimento_inesistente', gravita: 'alta', descrizione: 'Fattura non esiste.', documento_id: id })
  }
  const bollId = doc.bolla_id as string | null
  if (bollId && !bolleEsistenti.has(bollId)) {
    anomalie.push({ id: `fk-boll-${id}`, tipo: 'riferimento_inesistente', gravita: 'alta', descrizione: 'Bolla non esiste.', documento_id: id })
  }

  return anomalie
}
