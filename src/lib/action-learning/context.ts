import type { CodaItem, DocumentOrigine } from '@/lib/command-system/types'

export interface ContestoApprendimento {
  origine: DocumentOrigine
  stato_origine: string
  pending_kind: string
  fornitore_id: string | null
  sede_id: string | null
  mittente?: string | null
}

export function estraiContesto(item: CodaItem): ContestoApprendimento {
  return {
    origine: item.origine,
    stato_origine: item.stato_origine,
    pending_kind: item.pending_kind,
    fornitore_id: item.fornitore_id,
    sede_id: item.sede_id,
    mittente: item.contesto_originale?.mittente as string | null | undefined,
  }
}

export function contestoToJsonb(contesto: ContestoApprendimento): Record<string, string | null> {
  return {
    origine: contesto.origine,
    stato_origine: contesto.stato_origine,
    pending_kind: contesto.pending_kind,
    ...(contesto.fornitore_id ? { fornitore_id: contesto.fornitore_id } : {}),
    ...(contesto.sede_id ? { sede_id: contesto.sede_id } : {}),
    ...(contesto.mittente ? { mittente: contesto.mittente } : {}),
  }
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
