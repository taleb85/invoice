import {
  fatturaNumeroIsMisusedUkAccount,
  supplierNameLooksLikeEdenSprings,
} from '@/lib/uk-account-invoice-guard'

export type EdenFatturaRow = {
  id: string
  fornitore_id: string | null
  sede_id: string | null
  data: string | null
  importo: number | null
  numero_fattura: string | null
  file_url: string | null
  bolla_id: string | null
  /** Opzionale: non presente su tutti gli schema legacy. */
  created_at?: string | null
  approval_status: string | null
}

export type EdenFornitoreRow = {
  id: string
  nome: string
  display_name: string | null
}

export type EdenFixClearNumero = {
  fattura_id: string
  old_numero: string
  fornitore_nome: string | null
}

export type EdenFixDuplicateGroup = {
  group_key: string
  keep_id: string
  delete_ids: string[]
  count: number
}

export type EdenFixPlan = {
  fornitore_ids: string[]
  clear_numero: EdenFixClearNumero[]
  duplicate_groups: EdenFixDuplicateGroup[]
  delete_ids: string[]
}

export type EdenDocumentoRow = {
  id: string
  file_url: string | null
  file_name: string | null
  stato: string
  fornitore_id: string | null
  fattura_id: string | null
  metadata: Record<string, unknown> | null
  is_statement: boolean | null
}

export type EdenStatementRequeueItem = {
  doc_id: string
  file_url: string
  file_name: string | null
}

export type EdenStatementRequeuePlan = {
  fornitore_ids: string[]
  /** Fatture create per errore al posto dello statement (senza bolla / senza numero reale). */
  delete_fattura_ids: string[]
  requeue: EdenStatementRequeueItem[]
  /** Righe coda duplicate (stesso file_url). */
  skip_doc_ids: string[]
}

function strength(f: EdenFatturaRow): number {
  let s = 0
  if (f.bolla_id) s += 1000
  const num = f.numero_fattura?.trim()
  if (num && !fatturaNumeroIsMisusedUkAccount(num, null)) s += 100
  if (f.importo != null) s += 10
  if (f.approval_status === 'approved') s += 5
  return s
}

function pickKeep(group: EdenFatturaRow[]): EdenFatturaRow {
  return [...group].sort((a, b) => {
    const ds = strength(b) - strength(a)
    if (ds !== 0) return ds
    const ca = a.created_at ?? a.id
    const cb = b.created_at ?? b.id
    return ca.localeCompare(cb)
  })[0]!
}

export function findEdenSpringsFornitoreIds(fornitori: EdenFornitoreRow[]): string[] {
  return fornitori
    .filter((f) => supplierNameLooksLikeEdenSprings(f.display_name || f.nome))
    .map((f) => f.id)
}

export function buildEdenSpringsFixPlan(
  fatture: EdenFatturaRow[],
  fornitoreNames: Map<string, string>,
): EdenFixPlan {
  const fornitore_ids = [...new Set(fatture.map((f) => f.fornitore_id).filter(Boolean) as string[])]

  const clear_numero: EdenFixClearNumero[] = []
  for (const f of fatture) {
    const nome = f.fornitore_id ? fornitoreNames.get(f.fornitore_id) ?? null : null
    if (fatturaNumeroIsMisusedUkAccount(f.numero_fattura, nome)) {
      clear_numero.push({
        fattura_id: f.id,
        old_numero: f.numero_fattura!.trim(),
        fornitore_nome: nome,
      })
    }
  }

  const duplicate_groups: EdenFixDuplicateGroup[] = []
  const deleteIdSet = new Set<string>()

  const byFile = new Map<string, EdenFatturaRow[]>()
  for (const f of fatture) {
    if (!f.file_url) continue
    const arr = byFile.get(f.file_url) ?? []
    arr.push(f)
    byFile.set(f.file_url, arr)
  }
  for (const [file_url, items] of byFile) {
    if (items.length < 2) continue
    const keep = pickKeep(items)
    const delete_ids = items.filter((x) => x.id !== keep.id).map((x) => x.id)
    delete_ids.forEach((id) => deleteIdSet.add(id))
    duplicate_groups.push({
      group_key: `file:${file_url}`,
      keep_id: keep.id,
      delete_ids,
      count: items.length,
    })
  }

  const byNumero = new Map<string, EdenFatturaRow[]>()
  for (const f of fatture) {
    if (deleteIdSet.has(f.id)) continue
    const num = f.numero_fattura?.trim()
    if (!num || !f.fornitore_id || !f.data) continue
    const k = `${f.fornitore_id}|${f.data}|${num.toLowerCase()}`
    const arr = byNumero.get(k) ?? []
    arr.push(f)
    byNumero.set(k, arr)
  }
  for (const [k, items] of byNumero) {
    if (items.length < 2) continue
    const keep = pickKeep(items)
    const delete_ids = items.filter((x) => x.id !== keep.id).map((x) => x.id)
    if (delete_ids.every((id) => !deleteIdSet.has(id))) {
      delete_ids.forEach((id) => deleteIdSet.add(id))
      duplicate_groups.push({
        group_key: `numero:${k}`,
        keep_id: keep.id,
        delete_ids,
        count: items.length,
      })
    }
  }

  const byDay = new Map<string, EdenFatturaRow[]>()
  for (const f of fatture) {
    if (deleteIdSet.has(f.id)) continue
    if (!f.fornitore_id || !f.data) continue
    const k = `${f.fornitore_id}|${f.data}`
    const arr = byDay.get(k) ?? []
    arr.push(f)
    byDay.set(k, arr)
  }
  for (const [k, items] of byDay) {
    if (items.length < 3) continue
    const keep = pickKeep(items)
    const delete_ids = items.filter((x) => x.id !== keep.id).map((x) => x.id)
    const fresh = delete_ids.filter((id) => !deleteIdSet.has(id))
    if (fresh.length === 0) continue
    fresh.forEach((id) => deleteIdSet.add(id))
    duplicate_groups.push({
      group_key: `cluster:${k}`,
      keep_id: keep.id,
      delete_ids: fresh,
      count: items.length,
    })
  }

  return {
    fornitore_ids,
    clear_numero,
    duplicate_groups,
    delete_ids: [...deleteIdSet],
  }
}

function docMeta(doc: EdenDocumentoRow): Record<string, unknown> {
  return doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
    ? doc.metadata
    : {}
}

/** PDF Eden / estratto conto finito in fatture o comunicazioni. */
export function docLooksLikeMisclassifiedStatement(doc: EdenDocumentoRow): boolean {
  const meta = docMeta(doc)
  if (meta.tipo_documento === 'estratto_conto') return true
  if (meta.pending_kind_reclassified_from === 'statement') return true
  if (meta.pending_kind === 'statement') return true
  const fn = doc.file_name?.trim() ?? ''
  if (/^INV_\d+_\d{8}_E\.pdf$/i.test(fn)) return true
  return false
}

/** Fattura fantasma: nessuna bolla e nessun Tax Invoice No. valido. */
export function fatturaLooksLikePhantomStatement(f: EdenFatturaRow, fornitoreNome: string | null): boolean {
  if (f.bolla_id) return false
  const num = f.numero_fattura?.trim()
  if (!num) return true
  return fatturaNumeroIsMisusedUkAccount(num, fornitoreNome)
}

function docRequeueStrength(doc: EdenDocumentoRow): number {
  let s = 0
  if (doc.fornitore_id) s += 100
  if (doc.is_statement) s += 50
  if (doc.stato === 'associato') s += 20
  else if (doc.stato === 'da_processare' || doc.stato === 'in_attesa' || doc.stato === 'da_associare') s += 30
  if (docMeta(doc).estrazione_utile === true) s += 10
  if (docMeta(doc).tipo_documento === 'estratto_conto') s += 5
  return s
}

/**
 * Rimette in coda statement i PDF Eden Springs classificati come fattura/comunicazione.
 * Una riga per file_url; elimina le fatture fantasma collegate.
 */
export function buildEdenSpringsStatementRequeuePlan(
  fatture: EdenFatturaRow[],
  documenti: EdenDocumentoRow[],
  fornitoreNames: Map<string, string>,
): EdenStatementRequeuePlan {
  const fornitore_ids = [
    ...new Set([
      ...fatture.map((f) => f.fornitore_id).filter(Boolean),
      ...documenti.map((d) => d.fornitore_id).filter(Boolean),
    ] as string[]),
  ]

  const delete_fattura_ids = fatture
    .filter((f) => {
      const nome = f.fornitore_id ? fornitoreNames.get(f.fornitore_id) ?? null : null
      return fatturaLooksLikePhantomStatement(f, nome)
    })
    .map((f) => f.id)

  const fileUrlsFromFatture = new Set(
    fatture.filter((f) => f.file_url?.trim()).map((f) => f.file_url!.trim()),
  )

  const candidateDocs = documenti.filter(
    (d) => d.file_url?.trim() && (docLooksLikeMisclassifiedStatement(d) || fileUrlsFromFatture.has(d.file_url!.trim())),
  )

  const byFile = new Map<string, EdenDocumentoRow[]>()
  for (const d of candidateDocs) {
    const url = d.file_url!.trim()
    const arr = byFile.get(url) ?? []
    arr.push(d)
    byFile.set(url, arr)
  }

  const requeue: EdenStatementRequeueItem[] = []
  const skip_doc_ids: string[] = []

  for (const [file_url, items] of byFile) {
    const keep = [...items].sort((a, b) => {
      const ds = docRequeueStrength(b) - docRequeueStrength(a)
      if (ds !== 0) return ds
      return a.id.localeCompare(b.id)
    })[0]!
    requeue.push({ doc_id: keep.id, file_url, file_name: keep.file_name })
    for (const d of items) {
      if (d.id !== keep.id) skip_doc_ids.push(d.id)
    }
  }

  return { fornitore_ids, delete_fattura_ids, requeue, skip_doc_ids }
}
