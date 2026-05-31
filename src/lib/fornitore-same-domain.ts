import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractEmailDomainLower,
  isGenericSupplierEmailDomain,
} from '@/lib/fornitore-resolve-scan-email'

export type SameDomainPeer = {
  id: string
  nome: string
  emails: string[]
}

export type SameDomainConflict = {
  domain: string
  peers: SameDomainPeer[]
}

type FornitoreEmailRow = {
  id: string
  nome: string
  email: string | null
}

function addEmailToDomainIndex(
  index: Map<string, Map<string, { nome: string; emails: Set<string> }>>,
  fornitoreId: string,
  nome: string,
  rawEmail: string | null | undefined,
): void {
  const em = (rawEmail ?? '').trim().toLowerCase()
  if (!em.includes('@')) return
  const dom = extractEmailDomainLower(em)
  if (!dom || isGenericSupplierEmailDomain(dom)) return
  let byFornitore = index.get(dom)
  if (!byFornitore) {
    byFornitore = new Map()
    index.set(dom, byFornitore)
  }
  let entry = byFornitore.get(fornitoreId)
  if (!entry) {
    entry = { nome, emails: new Set() }
    byFornitore.set(fornitoreId, entry)
  }
  entry.emails.add(em)
}

/**
 * Indice dominio → fornitori nella sede (email primaria + alias).
 */
export async function buildSedeEmailDomainIndex(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<Map<string, Map<string, { nome: string; emails: Set<string> }>>> {
  const index = new Map<string, Map<string, { nome: string; emails: Set<string> }>>()

  const { data: fornitori, error: fErr } = await supabase
    .from('fornitori')
    .select('id, nome, email')
    .eq('sede_id', sedeId)
    .limit(2000)
  if (fErr) throw new Error(fErr.message)

  const rows = (fornitori ?? []) as FornitoreEmailRow[]
  const ids = rows.map((r) => r.id)
  for (const f of rows) {
    addEmailToDomainIndex(index, f.id, f.nome, f.email)
  }

  if (ids.length > 0) {
    const { data: aliases, error: aErr } = await supabase
      .from('fornitore_emails')
      .select('fornitore_id, email, fornitori!inner(nome, sede_id)')
      .eq('fornitori.sede_id', sedeId)
      .limit(5000)
    if (aErr) throw new Error(aErr.message)
    for (const a of aliases ?? []) {
      const row = a as {
        fornitore_id: string
        email: string
        fornitori: { nome: string } | { nome: string }[]
      }
      const nome = Array.isArray(row.fornitori)
        ? row.fornitori[0]?.nome
        : row.fornitori?.nome
      addEmailToDomainIndex(index, row.fornitore_id, nome ?? '—', row.email)
    }
  }

  return index
}

/**
 * Fornitori nella stessa sede che condividono almeno un dominio email non generico.
 */
export async function findSameDomainConflictsForFornitore(
  supabase: SupabaseClient,
  fornitoreId: string,
): Promise<SameDomainConflict[]> {
  const { data: self, error } = await supabase
    .from('fornitori')
    .select('id, sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const sedeId = (self as { sede_id?: string | null } | null)?.sede_id?.trim()
  if (!sedeId) return []

  const index = await buildSedeEmailDomainIndex(supabase, sedeId)
  const conflicts: SameDomainConflict[] = []

  for (const [domain, byFornitore] of index) {
    if (!byFornitore.has(fornitoreId) || byFornitore.size < 2) continue
    const peers: SameDomainPeer[] = [...byFornitore.entries()]
      .map(([id, v]) => ({
        id,
        nome: v.nome,
        emails: [...v.emails].sort(),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    conflicts.push({ domain, peers })
  }

  conflicts.sort((a, b) => a.domain.localeCompare(b.domain, 'it'))
  return conflicts
}

/** Altri fornitori (escluso `fornitoreId`) con dominio email in comune. */
export async function findSameDomainPeersForFornitore(
  supabase: SupabaseClient,
  fornitoreId: string,
): Promise<SameDomainPeer[]> {
  const conflicts = await findSameDomainConflictsForFornitore(supabase, fornitoreId)
  const byId = new Map<string, SameDomainPeer>()
  for (const c of conflicts) {
    for (const p of c.peers) {
      if (p.id === fornitoreId) continue
      const prev = byId.get(p.id)
      if (!prev) {
        byId.set(p.id, { ...p, emails: [...p.emails] })
      } else {
        const merged = new Set([...prev.emails, ...p.emails])
        byId.set(p.id, { ...prev, emails: [...merged].sort() })
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
}
