/**
 * Normalizza stringhe data in YYYY-MM-DD per PostgreSQL.
 * Documenti IT usano spesso DD/MM/YYYY: va interpretato prima di `new Date()`,
 * che in engine JS tende a leggere 08/04/2026 come MM/GG/AAAA (8 agosto).
 */

function ymdFromUtcParts(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const t = Date.UTC(y, m - 1, d)
  const dt = new Date(t)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Riconosce DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (convenzione europea, prioritaria per l'app).
 */
function parseEuropeanDmy(trimmed: string): string | null {
  const itMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (!itMatch) return null
  const d = parseInt(itMatch[1]!, 10)
  const m = parseInt(itMatch[2]!, 10)
  const y = parseInt(itMatch[3]!, 10)
  return ymdFromUtcParts(y, m, d)
}

export function safeDate(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null

  // Già in formato YYYY-MM-DD: valida (evita 2023-02-30, ecc.)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const y = parseInt(trimmed.slice(0, 4), 10)
    const m = parseInt(trimmed.slice(5, 7), 10)
    const d = parseInt(trimmed.slice(8, 10), 10)
    const v = ymdFromUtcParts(y, m, d)
    if (v) return v
    return null
  }

  // DD/MM/AAAA prima del parser JS (evita MM/GG in "04/08/2026" → agosto)
  const european = parseEuropeanDmy(trimmed)
  if (european) return european

  // Testi come "8 Apr 2026", ISO con orario, ecc. (stesso criterio di scan-emails)
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }

  console.warn(`[safe-date] Data non parsabile: "${raw}" — impostata a null`)
  return null
}
