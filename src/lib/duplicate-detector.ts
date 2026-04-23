import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

export type DuplicateItem = {
  id: string
  label: string
  /** ISO date string — document date (fatture/bolle) or creation timestamp (fornitori). */
  created_at: string
  metadata: Record<string, unknown>
}

export type DuplicateGroup = {
  reason: string
  items: DuplicateItem[]
}

export type EntityDuplicateReport = {
  groups: DuplicateGroup[]
  total: number
}

export type AllDuplicatesReport = {
  fatture: EntityDuplicateReport
  bolle: EntityDuplicateReport
  fornitori: EntityDuplicateReport
  total: number
}

const PAGE_SIZE = 2_000
const MAX_ROWS = 20_000

function datesWithinDays(a: string | null, b: string | null, days: number): boolean {
  if (!a || !b) return false
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.abs(da - db) <= days * 24 * 60 * 60 * 1000
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

type FatturaRow = {
  id: string
  numero_fattura: string | null
  fornitore_id: string | null
  importo: number | null
  data: string | null
  fornitori: { nome: string | null } | null
}

export async function detectDuplicateFatture(
  sedeId: string,
  supabase: SupabaseClient,
): Promise<EntityDuplicateReport> {
  const all: FatturaRow[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('fatture')
      .select('id, numero_fattura, fornitore_id, importo, data, fornitori(nome)')
      .eq('sede_id', sedeId)
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data) break
    all.push(...(data as unknown as FatturaRow[]))
    if (data.length < PAGE_SIZE) break
  }

  const groups: DuplicateGroup[] = []
  const usedIds = new Set<string>()

  // Group 1: same numero_fattura (normalised) + fornitore_id
  const byNumero = groupBy(
    all.filter((f) => f.fornitore_id && normalizeNumeroFattura(f.numero_fattura)),
    (f) => `${f.fornitore_id}\0${normalizeNumeroFattura(f.numero_fattura).toLowerCase()}`,
  )
  for (const items of byNumero.values()) {
    if (items.length < 2) continue
    items.forEach((f) => usedIds.add(f.id))
    groups.push({
      reason: 'Stesso numero fattura + fornitore',
      items: items.map((f) => ({
        id: f.id,
        label: `${f.fornitori?.nome ?? f.fornitore_id ?? '—'} · n.${f.numero_fattura ?? '—'}${f.importo != null ? ` · €${f.importo.toFixed(2)}` : ''} · ${f.data ?? '—'}`,
        created_at: f.data ?? '',
        metadata: { numero_fattura: f.numero_fattura, fornitore_id: f.fornitore_id, importo: f.importo, data: f.data },
      })),
    })
  }

  // Group 2: same importo + fornitore_id + date within 3 days (items not already grouped)
  const remaining = all.filter((f) => !usedIds.has(f.id) && f.importo != null && f.fornitore_id)
  const dateProcessed = new Set<string>()
  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]!
    if (dateProcessed.has(a.id)) continue
    const cluster: FatturaRow[] = [a]
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
    if (cluster.length >= 2) {
      cluster.forEach((f) => dateProcessed.add(f.id))
      groups.push({
        reason: 'Stesso importo + fornitore (± 3 giorni)',
        items: cluster.map((f) => ({
          id: f.id,
          label: `${f.fornitori?.nome ?? f.fornitore_id ?? '—'} · ${f.numero_fattura ? `n.${f.numero_fattura}` : '—'} · €${f.importo?.toFixed(2)} · ${f.data ?? '—'}`,
          created_at: f.data ?? '',
          metadata: { numero_fattura: f.numero_fattura, fornitore_id: f.fornitore_id, importo: f.importo, data: f.data },
        })),
      })
    }
  }

  const total = groups.reduce((s, g) => s + g.items.length, 0)
  return { groups, total }
}

type BollaRow = {
  id: string
  numero_bolla: string | null
  fornitore_id: string | null
  importo: number | null
  data: string | null
  fornitori: { nome: string | null } | null
}

export async function detectDuplicateBolle(
  sedeId: string,
  supabase: SupabaseClient,
): Promise<EntityDuplicateReport> {
  const all: BollaRow[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('bolle')
      .select('id, numero_bolla, fornitore_id, importo, data, fornitori(nome)')
      .eq('sede_id', sedeId)
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error || !data) break
    all.push(...(data as unknown as BollaRow[]))
    if (data.length < PAGE_SIZE) break
  }

  const groups: DuplicateGroup[] = []
  const usedIds = new Set<string>()

  // Group 1: same numero_bolla (normalised) + fornitore_id
  const byNumero = groupBy(
    all.filter((b) => b.fornitore_id && normalizeNumeroFattura(b.numero_bolla)),
    (b) => `${b.fornitore_id}\0${normalizeNumeroFattura(b.numero_bolla).toLowerCase()}`,
  )
  for (const items of byNumero.values()) {
    if (items.length < 2) continue
    items.forEach((b) => usedIds.add(b.id))
    groups.push({
      reason: 'Stesso numero bolla + fornitore',
      items: items.map((b) => ({
        id: b.id,
        label: `${b.fornitori?.nome ?? b.fornitore_id ?? '—'} · n.${b.numero_bolla ?? '—'}${b.importo != null ? ` · €${b.importo.toFixed(2)}` : ''} · ${b.data ?? '—'}`,
        created_at: b.data ?? '',
        metadata: { numero_bolla: b.numero_bolla, fornitore_id: b.fornitore_id, importo: b.importo, data: b.data },
      })),
    })
  }

  // Group 2: same importo + fornitore_id + date within 3 days
  const remaining = all.filter((b) => !usedIds.has(b.id) && b.importo != null && b.fornitore_id)
  const dateProcessed = new Set<string>()
  for (let i = 0; i < remaining.length; i++) {
    const a = remaining[i]!
    if (dateProcessed.has(a.id)) continue
    const cluster: BollaRow[] = [a]
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
    if (cluster.length >= 2) {
      cluster.forEach((b) => dateProcessed.add(b.id))
      groups.push({
        reason: 'Stesso importo + fornitore (± 3 giorni)',
        items: cluster.map((b) => ({
          id: b.id,
          label: `${b.fornitori?.nome ?? b.fornitore_id ?? '—'} · ${b.numero_bolla ? `n.${b.numero_bolla}` : '—'} · €${b.importo?.toFixed(2)} · ${b.data ?? '—'}`,
          created_at: b.data ?? '',
          metadata: { numero_bolla: b.numero_bolla, fornitore_id: b.fornitore_id, importo: b.importo, data: b.data },
        })),
      })
    }
  }

  const total = groups.reduce((s, g) => s + g.items.length, 0)
  return { groups, total }
}

type FornitoreRow = {
  id: string
  nome: string | null
  piva: string | null
  email: string | null
  created_at: string | null
}

export async function detectDuplicateFornitori(
  sedeId: string,
  supabase: SupabaseClient,
): Promise<EntityDuplicateReport> {
  const all: FornitoreRow[] = []
  for (let from = 0; from < 5_000; from += 500) {
    const { data, error } = await supabase
      .from('fornitori')
      .select('id, nome, piva, email, created_at')
      .eq('sede_id', sedeId)
      .order('created_at', { ascending: true })
      .range(from, from + 499)
    if (error || !data) break
    all.push(...(data as unknown as FornitoreRow[]))
    if (data.length < 500) break
  }

  const groups: DuplicateGroup[] = []
  const usedIds = new Set<string>()

  // Group 1: same piva (non-empty)
  const byPiva = groupBy(
    all.filter((f) => f.piva?.trim()),
    (f) => f.piva!.trim().toUpperCase(),
  )
  for (const [piva, items] of byPiva) {
    if (items.length < 2) continue
    items.forEach((f) => usedIds.add(f.id))
    groups.push({
      reason: `Stessa P.IVA (${piva})`,
      items: items.map((f) => ({
        id: f.id,
        label: `${f.nome ?? '—'} · P.IVA ${f.piva}${f.email ? ` · ${f.email}` : ''}`,
        created_at: f.created_at ?? '',
        metadata: { nome: f.nome, piva: f.piva, email: f.email },
      })),
    })
  }

  // Group 2: same nome (case insensitive, trimmed) — not already in group 1
  const byNome = groupBy(
    all.filter((f) => !usedIds.has(f.id) && f.nome?.trim()),
    (f) => f.nome!.trim().toLowerCase(),
  )
  for (const [, items] of byNome) {
    if (items.length < 2) continue
    items.forEach((f) => usedIds.add(f.id))
    groups.push({
      reason: 'Stesso nome fornitore',
      items: items.map((f) => ({
        id: f.id,
        label: `${f.nome}${f.piva ? ` · P.IVA ${f.piva}` : ''}${f.email ? ` · ${f.email}` : ''}`,
        created_at: f.created_at ?? '',
        metadata: { nome: f.nome, piva: f.piva, email: f.email },
      })),
    })
  }

  // Group 3: same email (non-empty) — not already grouped
  const byEmail = groupBy(
    all.filter((f) => !usedIds.has(f.id) && f.email?.trim()),
    (f) => f.email!.trim().toLowerCase(),
  )
  for (const [email, items] of byEmail) {
    if (items.length < 2) continue
    groups.push({
      reason: `Stessa email (${email})`,
      items: items.map((f) => ({
        id: f.id,
        label: `${f.nome ?? '—'}${f.piva ? ` · P.IVA ${f.piva}` : ''} · ${f.email}`,
        created_at: f.created_at ?? '',
        metadata: { nome: f.nome, piva: f.piva, email: f.email },
      })),
    })
  }

  const total = groups.reduce((s, g) => s + g.items.length, 0)
  return { groups, total }
}

export async function detectAllDuplicates(
  sedeId: string,
  supabase: SupabaseClient,
): Promise<AllDuplicatesReport> {
  const [fatture, bolle, fornitori] = await Promise.all([
    detectDuplicateFatture(sedeId, supabase),
    detectDuplicateBolle(sedeId, supabase),
    detectDuplicateFornitori(sedeId, supabase),
  ])
  return {
    fatture,
    bolle,
    fornitori,
    total: fatture.total + bolle.total + fornitori.total,
  }
}
