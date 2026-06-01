/** Migrazione `conferme_ordine` non applicata o tabella assente in cache PostgREST. */
export function confermeOrdineTableUnavailable(err: { message?: string; code?: string }): boolean {
  if (err.code === '42P01') return true
  const m = (err.message ?? '').toLowerCase()
  if (!m.includes('conferme_ordine')) return false
  if (isConfermeOrdineMissingColumnMessage(m)) return false
  return (
    m.includes('schema cache') ||
    m.includes('could not find the table') ||
    m.includes('does not exist') ||
    m.includes('not found')
  )
}

function isConfermeOrdineMissingColumnMessage(messageLower: string): boolean {
  return (
    messageLower.includes('numero_ordine') &&
    (messageLower.includes('column') || messageLower.includes('schema cache'))
  )
}

/** True quando l’API segnala che manca del tutto la tabella (non solo una colonna). */
export function confermeOrdineTableMissingFromApiError(message: string): boolean {
  const m = message.toLowerCase()
  if (m.includes('42p01')) return true
  if (isConfermeOrdineMissingColumnMessage(m)) return false
  if (!m.includes('conferme_ordine')) return false
  return (
    m.includes('could not find the table') ||
    (m.includes('does not exist') && !m.includes('column')) ||
    (m.includes('schema cache') && m.includes('could not find') && !m.includes('column'))
  )
}

export function isConfermeOrdineMissingNumeroOrdineColumn(err: { message?: string }): boolean {
  return isConfermeOrdineMissingColumnMessage((err.message ?? '').toLowerCase())
}

function isConfermeOrdineMissingImportoTotaleMessage(messageLower: string): boolean {
  return (
    messageLower.includes('importo_totale') &&
    (messageLower.includes('column') || messageLower.includes('schema cache'))
  )
}

export function isConfermeOrdineMissingImportoTotaleColumn(err: { message?: string }): boolean {
  return isConfermeOrdineMissingImportoTotaleMessage((err.message ?? '').toLowerCase())
}
