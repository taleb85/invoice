import type { DuplicateItem } from '@/lib/duplicate-detector'

export type DuplicateSuggestEntity = 'fatture' | 'bolle' | 'fornitori'

function cmpIsoDesc(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? 1 : a > b ? -1 : 0
}

/** Confronto stabile: “migliore” per tenerlo (ordine decrescente dopo sort). */
function compareFatturaKeep(a: DuplicateItem, b: DuplicateItem): number {
  const ma = a.metadata
  const mb = b.metadata

  const bollaA = ma.bolla_id != null && String(ma.bolla_id).trim() !== '' ? 1 : 0
  const bollaB = mb.bolla_id != null && String(mb.bolla_id).trim() !== '' ? 1 : 0
  if (bollaB !== bollaA) return bollaB - bollaA

  const fileA = ma.ha_file === true ? 1 : 0
  const fileB = mb.ha_file === true ? 1 : 0
  if (fileB !== fileA) return fileB - fileA

  let u = cmpIsoDesc(String(ma.sistema_updated_at ?? ''), String(mb.sistema_updated_at ?? ''))
  if (u !== 0) return u

  u = cmpIsoDesc(String(ma.sistema_created_at ?? ''), String(mb.sistema_created_at ?? ''))
  if (u !== 0) return u

  u = cmpIsoDesc(String(ma.data ?? ''), String(mb.data ?? ''))
  if (u !== 0) return u

  u = cmpIsoDesc(String(a.created_at ?? ''), String(b.created_at ?? ''))
  if (u !== 0) return u

  return b.id.localeCompare(a.id)
}

/** `stato` bolla: completato &gt; altro. */
function compareBollaKeep(a: DuplicateItem, b: DuplicateItem): number {
  const ma = a.metadata
  const mb = b.metadata

  const linkA = ma.ha_fattura_collegata === true ? 1 : 0
  const linkB = mb.ha_fattura_collegata === true ? 1 : 0
  if (linkB !== linkA) return linkB - linkA

  const statoA = String(ma.stato ?? '').toLowerCase() === 'completato' ? 1 : 0
  const statoB = String(mb.stato ?? '').toLowerCase() === 'completato' ? 1 : 0
  if (statoB !== statoA) return statoB - statoA

  const fileA = ma.ha_file === true ? 1 : 0
  const fileB = mb.ha_file === true ? 1 : 0
  if (fileB !== fileA) return fileB - fileA

  let u = cmpIsoDesc(String(ma.sistema_updated_at ?? ''), String(mb.sistema_updated_at ?? ''))
  if (u !== 0) return u

  u = cmpIsoDesc(String(ma.sistema_created_at ?? ''), String(mb.sistema_created_at ?? ''))
  if (u !== 0) return u

  u = cmpIsoDesc(String(ma.data ?? ''), String(mb.data ?? ''))
  if (u !== 0) return u

  u = cmpIsoDesc(String(a.created_at ?? ''), String(b.created_at ?? ''))
  if (u !== 0) return u

  return b.id.localeCompare(a.id)
}

function richnessFornitore(it: DuplicateItem): number {
  const m = it.metadata
  let s = 0
  const piva = typeof m.piva === 'string' ? m.piva.trim() : ''
  const email = typeof m.email === 'string' ? m.email.trim() : ''
  const nome = typeof m.nome === 'string' ? m.nome.trim() : ''
  if (piva) s += 400
  if (email) s += 100
  s += Math.min(nome.length, 200)
  return s
}

function compareFornitoreKeep(a: DuplicateItem, b: DuplicateItem): number {
  const ra = richnessFornitore(a)
  const rb = richnessFornitore(b)
  if (rb !== ra) return rb - ra

  let u = cmpIsoDesc(String(a.metadata.sistema_updated_at ?? ''), String(b.metadata.sistema_updated_at ?? ''))
  if (u !== 0) return u

  u = cmpIsoDesc(String(a.metadata.sistema_created_at ?? a.created_at ?? ''), String(b.metadata.sistema_created_at ?? b.created_at ?? ''))
  if (u !== 0) return u

  return b.id.localeCompare(a.id)
}

/** ID del record consigliato da **conservare** in un gruppo duplicati (gli altri sono candidati allo scarto). */
export function pickKeepDuplicateItemId(items: DuplicateItem[], entity: DuplicateSuggestEntity): string | null {
  if (items.length === 0) return null
  if (items.length === 1) return items[0]!.id

  const sorted =
    entity === 'fatture'
      ? [...items].sort(compareFatturaKeep)
      : entity === 'bolle'
        ? [...items].sort(compareBollaKeep)
        : [...items].sort(compareFornitoreKeep)

  return sorted[0]!.id
}

/** ID da segnare per eliminazione (tutti tranne `pickKeepDuplicateItemId`). */
export function pickDiscardDuplicateItemIds(items: DuplicateItem[], entity: DuplicateSuggestEntity): string[] {
  const keep = pickKeepDuplicateItemId(items, entity)
  if (!keep || items.length < 2) return []
  return items.filter((i) => i.id !== keep).map((i) => i.id)
}
