import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

const PAGE_SIZE = 2_000
const MAX_ROWS = 20_000

export type DupFatturaRow = {
  id: string
  numero_fattura: string | null
  fornitore_id: string
  data: string
  importo: number | null
  bolla_id: string | null
  file_url: string | null
  sede_id: string | null
  fornitore_nome: string | null
}

export type DupFatturaGroup = {
  group_key: string
  fornitore_id: string
  fornitore_nome: string | null
  numero_display: string
  fatture: DupFatturaRow[]
  /** Suggerimento: tieni il record che ha già una bolla collegata; altrimenti il più recente per data. */
  ai_keep_id: string
  ai_keep_reason: string
}

export type DupBollaRow = {
  id: string
  numero_bolla: string | null
  fornitore_id: string
  data: string
  importo: number | null
  file_url: string | null
  sede_id: string | null
  fornitore_nome: string | null
  ha_fattura_collegata: boolean
}

export type DupBollaGroup = {
  group_key: string
  fornitore_id: string
  fornitore_nome: string | null
  numero_display: string
  bolle: DupBollaRow[]
  ai_keep_id: string
  ai_keep_reason: string
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    const arr = map.get(key) ?? []
    arr.push(item)
    map.set(key, arr)
  }
  return map
}

function pickKeepFattura(fatture: DupFatturaRow[]): DupFatturaRow {
  const withBolla = fatture.filter((x) => x.bolla_id)
  if (withBolla.length >= 1) {
    return [...withBolla].sort((a, b) => b.data.localeCompare(a.data))[0]!
  }
  return [...fatture].sort((a, b) => b.data.localeCompare(a.data))[0]!
}

function pickKeepBolla(bolle: DupBollaRow[]): DupBollaRow {
  const linked = bolle.filter((x) => x.ha_fattura_collegata)
  if (linked.length >= 1) {
    return [...linked].sort((a, b) => b.data.localeCompare(a.data))[0]!
  }
  return [...bolle].sort((a, b) => b.data.localeCompare(a.data))[0]!
}

function datesWithinDays(a: string | null, b: string | null, days: number): boolean {
  if (!a || !b) return false
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.abs(da - db) <= days * 24 * 60 * 60 * 1000
}

/** Fatture duplicate per sede — stesso raggruppamento di duplicate-detector, con bolla_id. */
export async function fetchEnrichedDuplicateFattureGroups(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<DupFatturaGroup[]> {
  type FRow = {
    id: string
    numero_fattura: string | null
    fornitore_id: string | null
    importo: number | null
    data: string | null
    bolla_id: string | null
    file_url: string | null
    sede_id: string | null
    fornitori: { nome: string | null } | null
  }

  const all: FRow[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('fatture')
      .select('id, numero_fattura, fornitore_id, importo, data, bolla_id, file_url, sede_id, fornitori(nome)')
      .eq('sede_id', sedeId)
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data) break
    all.push(...(data as unknown as FRow[]))
    if (data.length < PAGE_SIZE) break
  }

  const groups: DupFatturaGroup[] = []
  const usedIds = new Set<string>()

  const byNumero = groupBy(
    all.filter((f) => f.fornitore_id && normalizeNumeroFattura(f.numero_fattura)),
    (f) =>
      `${f.fornitore_id}\0${normalizeNumeroFattura(f.numero_fattura)!.toLowerCase()}`,
  )
  for (const items of byNumero.values()) {
    if (items.length < 2) continue
    items.forEach((f) => usedIds.add(f.id))
    const fatture: DupFatturaRow[] = items.map((f) => ({
      id: f.id,
      numero_fattura: f.numero_fattura,
      fornitore_id: f.fornitore_id!,
      data: String(f.data ?? ''),
      importo: f.importo != null ? Number(f.importo) : null,
      bolla_id: f.bolla_id,
      file_url: f.file_url ?? null,
      sede_id: f.sede_id,
      fornitore_nome: f.fornitori?.nome ?? null,
    }))
    const withBolla = fatture.filter((x) => x.bolla_id)
    const keep = pickKeepFattura(fatture)
    const reason =
      withBolla.length > 0
        ? 'Mantieni la fattura con bolla collegata (o la più recente se più di una col bolla).'
        : 'Nessuna bolla collegata: suggerita la più recente per data documento.'
    groups.push({
      group_key: `num:${fatture[0]!.fornitore_id}:${normalizeNumeroFattura(items[0]!.numero_fattura)}`,
      fornitore_id: fatture[0]!.fornitore_id,
      fornitore_nome: fatture[0]!.fornitore_nome,
      numero_display: fatture[0]!.numero_fattura ?? '—',
      fatture,
      ai_keep_id: keep.id,
      ai_keep_reason: reason,
    })
  }

  const remaining = all.filter((f) => !usedIds.has(f.id) && f.importo != null && f.fornitore_id)
  const dateProcessed = new Set<string>()
  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]!
    if (dateProcessed.has(a.id)) continue
    const cluster: FRow[] = [a]
    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j]!
      if (dateProcessed.has(b.id)) continue
      if (
        b.fornitore_id === a.fornitore_id &&
        b.importo != null &&
        Math.round(b.importo * 100) === Math.round(a.importo! * 100) &&
        datesWithinDays(a.data, b.data, 3)
      ) {
        cluster.push(b)
      }
    }
    if (cluster.length < 2) continue
    cluster.forEach((f) => dateProcessed.add(f.id))
    const fatture: DupFatturaRow[] = cluster.map((f) => ({
      id: f.id,
      numero_fattura: f.numero_fattura,
      fornitore_id: f.fornitore_id!,
      data: String(f.data ?? ''),
      importo: f.importo != null ? Number(f.importo) : null,
      bolla_id: f.bolla_id,
      file_url: f.file_url ?? null,
      sede_id: f.sede_id,
      fornitore_nome: f.fornitori?.nome ?? null,
    }))
    const withBolla = fatture.filter((x) => x.bolla_id)
    const keep = pickKeepFattura(fatture)
    const reason =
      withBolla.length > 0
        ? 'Stesso importo e data vicina: preferisci quella con bolla collegata.'
        : 'Duplicati per importo: preferisci la più recente.'
    groups.push({
      group_key: `imp:${fatture[0]!.fornitore_id}:${fatture[0]!.importo}:${fatture[0]!.data}`,
      fornitore_id: fatture[0]!.fornitore_id,
      fornitore_nome: fatture[0]!.fornitore_nome,
      numero_display: fatture.map((x) => x.numero_fattura ?? '—').join(' · '),
      fatture,
      ai_keep_id: keep.id,
      ai_keep_reason: reason,
    })
  }

  return groups
}

/** Per ogni bolla nella sede: verifica se esiste una fattura che punta a quella bolla. */
async function bolleHaFatturaMap(supabase: SupabaseClient, bollaIds: string[]): Promise<Map<string, boolean>> {
  const m = new Map<string, boolean>()
  for (const id of bollaIds) m.set(id, false)
  if (bollaIds.length === 0) return m
  const chunk = 300
  for (let i = 0; i < bollaIds.length; i += chunk) {
    const slice = bollaIds.slice(i, i + chunk)
    const { data } = await supabase.from('fatture').select('bolla_id').in('bolla_id', slice)
    for (const row of data ?? []) {
      const bid = (row as { bolla_id: string | null }).bolla_id
      if (bid) m.set(bid, true)
    }
  }
  return m
}

/** Bolle duplicate per sede (stesso criterio di duplicate-detector) con flag fattura collegata. */
export async function fetchEnrichedDuplicateBolleGroups(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<DupBollaGroup[]> {
  type BRow = {
    id: string
    numero_bolla: string | null
    fornitore_id: string | null
    importo: number | null
    data: string | null
    file_url: string | null
    sede_id: string | null
    fornitori: { nome: string | null } | null
  }

  const all: BRow[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('bolle')
      .select('id, numero_bolla, fornitore_id, importo, data, file_url, sede_id, fornitori(nome)')
      .eq('sede_id', sedeId)
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data) break
    all.push(...(data as unknown as BRow[]))
    if (data.length < PAGE_SIZE) break
  }

  const ids = all.map((b) => b.id)
  const fatturaByBolla = await bolleHaFatturaMap(supabase, ids)

  function rowToDup(b: BRow): DupBollaRow {
    return {
      id: b.id,
      numero_bolla: b.numero_bolla,
      fornitore_id: b.fornitore_id!,
      data: String(b.data ?? ''),
      importo: b.importo != null ? Number(b.importo) : null,
      file_url: b.file_url ?? null,
      sede_id: b.sede_id,
      fornitore_nome: b.fornitori?.nome ?? null,
      ha_fattura_collegata: fatturaByBolla.get(b.id) ?? false,
    }
  }

  const groups: DupBollaGroup[] = []
  const usedIds = new Set<string>()

  const byNumero = groupBy(
    all.filter((b) => b.fornitore_id && normalizeNumeroFattura(b.numero_bolla)),
    (b) =>
      `${b.fornitore_id}\0${normalizeNumeroFattura(b.numero_bolla)!.toLowerCase()}`,
  )
  for (const items of byNumero.values()) {
    if (items.length < 2) continue
    items.forEach((b) => usedIds.add(b.id))
    const bolle = items.map(rowToDup)
    const withF = bolle.filter((x) => x.ha_fattura_collegata)
    const keep = pickKeepBolla(bolle)
    const reason =
      withF.length > 0
        ? 'Mantieni la bolla collegata a una fattura (o la più recente se più candidate).'
        : 'Suggerita la più recente per data.'
    groups.push({
      group_key: `bn:${bolle[0]!.fornitore_id}:${normalizeNumeroFattura(items[0]!.numero_bolla)}`,
      fornitore_id: bolle[0]!.fornitore_id,
      fornitore_nome: bolle[0]!.fornitore_nome,
      numero_display: bolle[0]!.numero_bolla ?? '—',
      bolle,
      ai_keep_id: keep.id,
      ai_keep_reason: reason,
    })
  }

  const remaining = all.filter((b) => !usedIds.has(b.id) && b.importo != null && b.fornitore_id)
  const dateProcessed = new Set<string>()
  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]!
    if (dateProcessed.has(a.id)) continue
    const cluster: BRow[] = [a]
    for (let j = i + 1; j < remaining.length; j++) {
      const b = remaining[j]!
      if (dateProcessed.has(b.id)) continue
      if (
        b.fornitore_id === a.fornitore_id &&
        b.importo != null &&
        Math.round(b.importo * 100) === Math.round(a.importo! * 100) &&
        datesWithinDays(a.data, b.data, 3)
      ) {
        cluster.push(b)
      }
    }
    if (cluster.length < 2) continue
    cluster.forEach((b) => dateProcessed.add(b.id))
    const bolle = cluster.map(rowToDup)
    const withF = bolle.filter((x) => x.ha_fattura_collegata)
    const keep = pickKeepBolla(bolle)
    groups.push({
      group_key: `bi:${bolle[0]!.fornitore_id}:${bolle[0]!.importo}:${bolle[0]!.data}`,
      fornitore_id: bolle[0]!.fornitore_id,
      fornitore_nome: bolle[0]!.fornitore_nome,
      numero_display: bolle.map((x) => x.numero_bolla ?? '—').join(' · '),
      bolle,
      ai_keep_id: keep.id,
      ai_keep_reason:
        withF.length > 0
          ? 'Stesso importo: preferisci la bolla con fattura collegata.'
          : 'Preferisci la più recente.',
    })
  }

  return groups
}
