/** Aggiunge `fy` (e altri parametri) alla query string di un path interno. */
export function withFiscalYearQuery(
  path: string,
  fiscalYear: number | null | undefined,
  extraParams?: Record<string, string | undefined | null>,
): string {
  const p = new URLSearchParams()
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      if (v != null && v !== '') p.set(k, v)
    }
  }
  if (fiscalYear != null && Number.isFinite(fiscalYear)) {
    p.set('fy', String(Math.floor(fiscalYear)))
  }
  const q = p.toString()
  return q ? `${path}?${q}` : path
}
