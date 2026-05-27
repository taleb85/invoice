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
