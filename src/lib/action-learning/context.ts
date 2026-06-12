import type { CodaItem, DocumentOrigine } from '@/lib/command-system/types'

export interface ContestoApprendimento {
  origine: DocumentOrigine
  stato_origine: string
  pending_kind: string
  fornitore_id: string | null
  sede_id: string | null
  mittente?: string | null
}

/** Dominio email (es. `fatture@acme.it` → `acme.it`) per aggregare pattern simili. */
export function mittenteDomain(mittente: string | null | undefined): string | null {
  const raw = mittente?.trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  const at = lower.indexOf('@')
  if (at >= 0) {
    const domain = lower.slice(at + 1).trim()
    return domain || null
  }
  return lower
}

/**
 * Contesto JSON ridotto per l'apprendimento: evita chiavi troppo specifiche
 * (nome file, anomalie puntuali, email intera) così le conferme si sommano.
 */
export function normalizeContestoJson(
  contesto: Record<string, unknown>,
): Record<string, string> {
  const fonte = typeof contesto.fonte === 'string' ? contesto.fonte.trim() : ''
  if (fonte === 'verifica_associazioni') {
    const action = typeof contesto.action_originale === 'string'
      ? contesto.action_originale.trim()
      : ''
    const categoria = typeof contesto.documento_categoria === 'string'
      ? contesto.documento_categoria.trim()
      : ''
    const out: Record<string, string> = { fonte: 'verifica_associazioni' }
    if (action) out.action_originale = action
    out.documento_categoria = categoria || 'sconosciuta'
    return out
  }

  const out: Record<string, string> = {}
  const origine = typeof contesto.origine === 'string' ? contesto.origine.trim() : ''
  const stato = typeof contesto.stato_origine === 'string' ? contesto.stato_origine.trim() : ''
  const pending = typeof contesto.pending_kind === 'string' ? contesto.pending_kind.trim() : ''
  if (origine) out.origine = origine
  if (stato) out.stato_origine = stato
  if (pending) out.pending_kind = pending

  const domain = mittenteDomain(
    (typeof contesto.mittente === 'string' ? contesto.mittente : null)
      ?? (typeof contesto.mittente_domain === 'string' ? contesto.mittente_domain : null),
  )
  if (domain) out.mittente_domain = domain

  return out
}

export function estraiContesto(item: CodaItem): ContestoApprendimento {
  const mittente =
    item.mittente
    ?? (item.contesto_originale?.mittente as string | null | undefined)
    ?? null
  return {
    origine: item.origine,
    stato_origine: item.stato_origine,
    pending_kind: item.pending_kind,
    fornitore_id: item.fornitore_id,
    sede_id: item.sede_id,
    mittente,
  }
}

export function contestoToJsonb(contesto: ContestoApprendimento): Record<string, string> {
  return normalizeContestoJson({
    origine: contesto.origine,
    stato_origine: contesto.stato_origine,
    pending_kind: contesto.pending_kind,
    mittente: contesto.mittente,
  })
}

export function assertItemSedeAccess(
  profileSedeId: string | null | undefined,
  isMaster: boolean,
  item: CodaItem,
): boolean {
  const sede = item.sede_id?.trim()
  if (!sede) return true
  if (isMaster) return true
  return profileSedeId === sede
}
