import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'
import { tokenOverlapRatio, normalizeRagioneSocialeForComparison } from '@/lib/fornitore-cross-check'
import { extractStatementFromSupplierName } from '@/lib/statement-supplier-subject'
import { logger } from '@/lib/logger'

/**
 * Catena di fiducia a 3 segnali per ogni campo critico.
 * Non serve intervento manuale: se 2/3 segnali concordano, il dato è accettato.
 * Se solo 1/3, il documento viene posticipato (riprova al ciclo successivo).
 */

// ─── Tipi ──────────────────────────────────────────────────────────────────────

export type SignalStrength = 0 | 1 | 2 | 3
export type QualityDecision<T> = {
  value: T | null
  confidence: SignalStrength
  signals: string[]
}

// ─── FORNITORE: catena di fiducia ──────────────────────────────────────────────

/**
 * Valuta la confidenza dell'abbinamento fornitore usando 3 segnali indipendenti.
 * Ritorna il fornitore solo se almeno 2 segnali su 3 concordano.
 */
export async function qualitySupplierMatch(
  supabase: SupabaseClient,
  mittente: string | null | undefined,
  ocrRagioneSociale: string | null | undefined,
  ocrPiva: string | null | undefined,
  sedeId: string | null | undefined,
  emailSubject?: string | null | undefined,
): Promise<{
  fornitoreId: string | null
  confidence: SignalStrength
  source: string | null
}> {
  const signals: { id: string; source: string }[] = []
  const sedeFilter = sedeId?.trim() || null

  // Segnale 0: oggetto «Statement from …» (inoltri — il mittente è spesso il cliente)
  const statementFrom = extractStatementFromSupplierName(emailSubject)
  if (statementFrom && sedeFilter) {
    const { resolveFornitoreByPartialNameEnhanced } = await import('@/lib/fornitore-infer-from-document')
    const bySubject = await resolveFornitoreByPartialNameEnhanced(supabase, statementFrom, sedeFilter)
    if (bySubject?.id) signals.push({ id: bySubject.id, source: 'statement_subject' })
  }

  // Segnale 1: Email mittente
  if (mittente?.includes('@')) {
    const { resolveFornitoreFromScanEmail } = await import('@/lib/fornitore-resolve-scan-email')
    const byEmail = await resolveFornitoreFromScanEmail(supabase, mittente, sedeFilter)
    if (byEmail?.id) signals.push({ id: byEmail.id, source: 'email' })
  }

  // Segnale 2: P.IVA
  const pivaDig = String(ocrPiva ?? '').replace(/\D/g, '')
  if (pivaDig.length >= 9) {
    let q = supabase
      .from('fornitori')
      .select('id')
      .limit(500)
    if (sedeFilter) q = q.eq('sede_id', sedeFilter) as typeof q
    const { data: all } = await q
    for (const r of all ?? []) {
      const fr = r as { id: string; piva?: string | null }
      const dbPiva = String(fr.piva ?? '').replace(/\D/g, '')
      if (dbPiva === pivaDig || (dbPiva.length >= 9 && dbPiva.slice(-9) === pivaDig.slice(-9))) {
        signals.push({ id: fr.id, source: 'piva' })
        break
      }
    }
  }

  // Segnale 3: Ragione sociale (con apprendimento)
  const rsNorm = normalizeRagioneSocialeForComparison(ocrRagioneSociale)
  if (rsNorm.length >= 4) {
    const learnedId = await lookupLearnedSupplier(supabase, mittente, rsNorm)
    if (learnedId) {
      signals.push({ id: learnedId, source: 'apprendimento' })
    } else {
      const { resolveFornitoreByPartialNameEnhanced } = await import('@/lib/fornitore-infer-from-document')
      const byName = await resolveFornitoreByPartialNameEnhanced(supabase, ocrRagioneSociale, sedeFilter)
      if (byName?.id) signals.push({ id: byName.id, source: 'ragione_sociale' })
    }
  }

  // Voto: serve almeno 2 segnali sullo STESSO fornitore
  const counts = new Map<string, { count: number; sources: string[] }>()
  for (const s of signals) {
    const entry = counts.get(s.id) ?? { count: 0, sources: [] }
    entry.count++
    entry.sources.push(s.source)
    counts.set(s.id, entry)
  }

  let bestId: string | null = null
  let bestCount = 0
  let bestSources: string[] = []
  for (const [id, entry] of counts) {
    if (entry.count > bestCount) {
      bestId = id
      bestCount = entry.count
      bestSources = entry.sources
    }
  }

  return {
    fornitoreId: bestCount >= 2 ? bestId : null,
    confidence: bestCount as SignalStrength,
    source: bestSources.length > 0 ? bestSources.join('+') : null,
  }
}

/**
 * Cerca apprendimenti precedenti: stesso mittente + stessa ragione sociale normalizzata
 * già abbinati a un fornitore in documenti processati con successo.
 */
async function lookupLearnedSupplier(
  supabase: SupabaseClient,
  mittente: string | null | undefined,
  ragioneSocialeNorm: string,
): Promise<string | null> {
  if (!mittente?.includes('@') && !ragioneSocialeNorm) return null

  let q = supabase
    .from('documenti_da_processare')
    .select('fornitore_id, mittente, metadata')
    .eq('stato', 'associato')
    .not('fornitore_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: docs } = await q
  if (!docs?.length) return null

  const counts = new Map<string, number>()
  for (const doc of docs) {
    const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? doc.metadata as Record<string, unknown>
      : {}
    const rs = normalizeRagioneSocialeForComparison(
      typeof meta.ragione_sociale === 'string' ? meta.ragione_sociale : null
    )

    let match = false
    if (ragioneSocialeNorm && rs && rs.length >= 4) {
      if (rs === ragioneSocialeNorm) match = true
      else if (tokenOverlapRatio(rs, ragioneSocialeNorm) >= 0.7) match = true
    }
    if (!match && mittente?.includes('@') && doc.mittente) {
      const emNorm = doc.mittente.toLowerCase().trim()
      if (emNorm === mittente.toLowerCase().trim()) match = true
    }

    if (match && doc.fornitore_id) {
      counts.set(doc.fornitore_id, (counts.get(doc.fornitore_id) ?? 0) + 1)
    }
  }

  let bestId: string | null = null
  let bestCount = 0
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestId = id
      bestCount = count
    }
  }

  return bestId
}

// ─── DATA: auto-validazione ────────────────────────────────────────────────────

/**
 * Valida la data del documento confrontando 3 segnali.
 * Se il segnale OCR è fuori range, lo corregge automaticamente.
 */
export function qualityValidateDate(
  ocrDate: string | null | undefined,
  receivedAt: string | null | undefined,
  fileName: string | null | undefined,
  emailSubject: string | null | undefined,
  rowDates?: (string | null)[],
): QualityDecision<string> {
  const signals: { value: string; source: string }[] = []

  // Segnale 1: OCR
  const dOcr = ocrDate?.trim()
  if (dOcr && /^\d{4}-\d{2}-\d{2}$/.test(dOcr)) {
    signals.push({ value: dOcr, source: 'ocr' })
  }

  // Segnale 2: Data da nome file (es. "Fattura_2026-03-31.pdf", "INV-20260415.pdf")
  const fnDate = extractDateFromText(fileName)
  if (fnDate) signals.push({ value: fnDate, source: 'nome_file' })

  // Segnale 3: Data da oggetto email
  const subjDate = extractDateFromText(emailSubject)
  if (subjDate) signals.push({ value: subjDate, source: 'oggetto_mail' })

  // Segnale 4 (fallback): Data righe (per estratti conto)
  if (rowDates?.length) {
    const validDates = rowDates.filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
    if (validDates.length > 0) {
      const dateCounts = new Map<string, number>()
      for (const d of validDates) dateCounts.set(d, (dateCounts.get(d) ?? 0) + 1)
      let mostFrequent = ''
      let maxCount = 0
      for (const [d, c] of dateCounts) {
        if (c > maxCount) { mostFrequent = d; maxCount = c }
      }
      if (mostFrequent) signals.push({ value: mostFrequent, source: 'righe_documento' })
    }
  }

  if (signals.length === 0) {
    // Nessun segnale disponibile: usa received_at
    const fallback = receivedAt?.slice(0, 10) ?? null
    return { value: fallback, confidence: 0, signals: ['fallback_received_at'] }
  }

  // Conta voti per ogni valore data
  const dateVotes = new Map<string, { count: number; sources: string[] }>()
  for (const s of signals) {
    const entry = dateVotes.get(s.value) ?? { count: 0, sources: [] }
    entry.count++
    entry.sources.push(s.source)
    dateVotes.set(s.value, entry)
  }

  let bestDate = ''
  let bestCount = 0
  let bestSources: string[] = []
  for (const [d, entry] of dateVotes) {
    if (entry.count > bestCount) {
      bestDate = d
      bestCount = entry.count
      bestSources = entry.sources
    }
  }

  // Validazione: data non può essere > 3 giorni dopo la ricezione
  if (receivedAt && bestDate && bestDate > receivedAt.slice(0, 10)) {
    const diffMs = new Date(bestDate).getTime() - new Date(receivedAt.slice(0, 10)).getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays > 3) {
      // Data sospetta: usa il secondo miglior segnale o received_at
      dateVotes.delete(bestDate)
      let secondDate = ''
      let secondCount = 0
      for (const [d, entry] of dateVotes) {
        if (entry.count > secondCount) { secondDate = d; secondCount = entry.count }
      }
      if (secondDate) {
        return { value: secondDate, confidence: Math.max(1, secondCount) as SignalStrength, signals: [`${bestDate}(rifiutata:${diffDays.toFixed(0)}gg)`] }
      }
      return { value: receivedAt.slice(0, 10), confidence: 1, signals: [`${bestDate}(rifiutata:${diffDays.toFixed(0)}gg)`, 'received_at' as string] }
    }
  }

  return {
    value: bestDate || null,
    confidence: bestCount as SignalStrength,
    signals: bestSources,
  }
}

/** Cerca pattern di data YYYY-MM-DD o YYYYMMDD in un testo. */
function extractDateFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null

  // Cerca YYYY-MM-DD (anche dopo _ o . nel nome file)
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const y = iso[1]!
    const m = iso[2]!
    const d = iso[3]!
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${m}-${d}`
    }
  }

  // Cerca DD/MM/YYYY o DD-MM-YYYY
  const eu = text.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/)
  if (eu) {
    const d = Number(eu[1]); const m = Number(eu[2]); const y = eu[3]
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // Cerca YYYYMMDD (es. "Fattura20260331.pdf")
  const compact = text.match(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`

  return null
}

// ─── TIPO DOCUMENTO: catena di fiducia ─────────────────────────────────────────

/**
 * Determina il tipo documento usando 3 segnali.
 * Se il fornitore ha una cronologia consolidata, usa quella.
 */
export async function qualityDocumentType(
  supabase: SupabaseClient,
  ocrTipo: string | null | undefined,
  fileName: string | null | undefined,
  emailSubject: string | null | undefined,
  fornitoreId: string | null | undefined,
): Promise<QualityDecision<string>> {
  const signals: { value: string; source: string }[] = []

  // Segnale 1: OCR
  const tipoNorm = normalizeTipoDocumento(ocrTipo)
  if (tipoNorm) {
    signals.push({ value: tipoNorm, source: 'ocr' })
  }

  // Segnale 2: Nome file
  const fnTipo = inferTypeFromText(fileName)
  if (fnTipo) signals.push({ value: fnTipo, source: 'nome_file' })

  // Segnale 3: Oggetto email
  const subjTipo = inferTypeFromText(emailSubject)
  if (subjTipo) signals.push({ value: subjTipo, source: 'oggetto_mail' })

  // Apprendimento: se il fornitore ha un tipo consolidato, usalo
  if (fornitoreId) {
    const learnedType = await lookupLearnedType(supabase, fornitoreId, signals.map(s => s.value))
    if (learnedType) {
      signals.push({ value: learnedType, source: 'apprendimento' })
    }
  }

  if (signals.length === 0) {
    return { value: 'comunicazione', confidence: 0, signals: ['default'] }
  }

  const votes = new Map<string, { count: number; sources: string[] }>()
  for (const s of signals) {
    const entry = votes.get(s.value) ?? { count: 0, sources: [] }
    entry.count++
    entry.sources.push(s.source)
    votes.set(s.value, entry)
  }

  let bestType = ''
  let bestCount = 0
  let bestSources: string[] = []
  for (const [t, entry] of votes) {
    if (entry.count > bestCount) {
      bestType = t
      bestCount = entry.count
      bestSources = entry.sources
    }
  }

  // Se solo 1 segnale e non è l'OCR, usa 'comunicazione' come default sicuro
  if (bestCount === 1 && !bestSources.includes('ocr')) {
    return { value: 'comunicazione', confidence: 1, signals: [...bestSources, 'default_sicuro'] }
  }

  return {
    value: bestType || 'comunicazione',
    confidence: bestCount as SignalStrength,
    signals: bestSources,
  }
}

function inferTypeFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const s = text.toLowerCase()
  if (/\bfattura\b/.test(s) || /\binvoice\b/.test(s) || /\bf[.]?\s*(?:no|#|:)/i.test(text)) return 'fattura'
  if (/\bnota\s+credito\b/.test(s) || /\bcredit\s+note\b/.test(s)) return 'nota_credito'
  if (/\bbolla\b/.test(s) || /\bddt\b/.test(s) || /\bdelivery\s+note\b/.test(s) || /\blieferschein\b/.test(s)) return 'bolla'
  if (/\border\s+confirmation\b/.test(s) || /\bconferma\s+ordine\b/.test(s)) return 'ordine'
  if (/\blistino\b/.test(s) || /\bprice\s*list\b/.test(s) || /\btariffa\b/.test(s)) return 'listino'
  if (/\bestratto\s+conto\b/.test(s) || /\bstatement\s+of\s+account\b/.test(s)) return 'comunicazione'
  if (/\bstatement\b/.test(s) || /\bestratto\b/.test(s)) return 'statement'
  return null
}

async function lookupLearnedType(
  supabase: SupabaseClient,
  fornitoreId: string,
  candidates: string[],
): Promise<string | null> {
  const { data: docs } = await supabase
    .from('documenti_da_processare')
    .select('metadata')
    .eq('fornitore_id', fornitoreId)
    .eq('stato', 'associato')
    .limit(100)

  if (!docs?.length) return null

  const counts = new Map<string, number>()
  for (const doc of docs) {
    const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? doc.metadata as Record<string, unknown>
      : {}
    const pk = typeof meta.pending_kind === 'string' ? meta.pending_kind : null
    if (pk && (candidates.length === 0 || candidates.includes(pk))) {
      counts.set(pk, (counts.get(pk) ?? 0) + 1)
    }
  }

  let bestType = ''
  let bestCount = 0
  for (const [t, c] of counts) {
    if (c > bestCount && c >= 3) {
      bestType = t
      bestCount = c
    }
  }

  return bestType || null
}

// ─── QUALITY CHAIN COMPLETA ────────────────────────────────────────────────────

export type QualityChainResult = {
  fornitoreId: string | null
  fornitoreConfidence: SignalStrength
  fornitoreSource: string | null
  documentDate: string | null
  dateConfidence: SignalStrength
  documentType: string | null
  typeConfidence: SignalStrength
  needsReview: boolean
}

/**
 * Esegue l'intera catena di qualità su un documento.
 * `needsReview` = true se uno o più campi hanno confidenza < 2.
 */
export async function runQualityChain(
  supabase: SupabaseClient,
  opts: {
    mittente: string | null | undefined
    sedeId: string | null | undefined
    ocrRagioneSociale: string | null | undefined
    ocrPiva: string | null | undefined
    ocrDate: string | null | undefined
    ocrTipo: string | null | undefined
    receivedAt: string | null | undefined
    fileName: string | null | undefined
    emailSubject: string | null | undefined
    fornitoreId?: string | null
    rowDates?: (string | null)[]
  },
): Promise<QualityChainResult> {
  const [supplierResult, dateResult, typeResult] = await Promise.all([
    opts.fornitoreId
      ? Promise.resolve({ fornitoreId: opts.fornitoreId, confidence: 3 as SignalStrength, source: 'esistente' })
      : qualitySupplierMatch(
          supabase,
          opts.mittente,
          opts.ocrRagioneSociale,
          opts.ocrPiva,
          opts.sedeId,
          opts.emailSubject,
        ),
    Promise.resolve(qualityValidateDate(opts.ocrDate, opts.receivedAt, opts.fileName, opts.emailSubject, opts.rowDates)),
    qualityDocumentType(supabase, opts.ocrTipo, opts.fileName, opts.emailSubject, opts.fornitoreId ?? null),
  ])

  const needsReview = supplierResult.confidence < 2 || dateResult.confidence < 2 || typeResult.confidence < 2

  return {
    fornitoreId: supplierResult.fornitoreId,
    fornitoreConfidence: supplierResult.confidence,
    fornitoreSource: supplierResult.source,
    documentDate: dateResult.value,
    dateConfidence: dateResult.confidence,
    documentType: typeResult.value,
    typeConfidence: typeResult.confidence,
    needsReview,
  }
}
