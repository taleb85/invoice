/**
 * Ricerca fornitore Rekki per P.IVA (normalizzata).
 * Richiede variabili opzionali: REKKI_API_KEY + REKKI_SUPPLIERS_SEARCH_URL
 * (URL con placeholder {vat} per il solo numero, es. …?vat={vat}).
 */

export type RekkiSupplierHit = { id: string; name: string }

export type RekkiLookupResult = {
  mode: 'api' | 'manual'
  suppliers: RekkiSupplierHit[]
  message?: string
}

function normalizeResponseJson(j: unknown): RekkiSupplierHit[] {
  if (!j || typeof j !== 'object') return []
  const o = j as Record<string, unknown>
  const raw = Array.isArray(o.data)
    ? o.data
    : Array.isArray(o.suppliers)
      ? o.suppliers
      : Array.isArray(o.items)
        ? o.items
        : Array.isArray(o.results)
          ? o.results
          : []
  const out: RekkiSupplierHit[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const u = x as Record<string, unknown>
    const id = String(u.id ?? u.supplier_id ?? u.uuid ?? '').trim()
    if (!id) continue
    const name = String(u.name ?? u.legal_name ?? u.company_name ?? u.display_name ?? id).trim()
    out.push({ id, name: name || id })
  }
  return out
}

export async function lookupRekkiSuppliersByVat(pivaRaw: string): Promise<RekkiLookupResult> {
  const digits = (pivaRaw ?? '').replace(/\D/g, '')
  if (digits.length < 7) {
    return { mode: 'manual', suppliers: [], message: 'P.IVA / VAT troppo corta per la ricerca.' }
  }

  const key = process.env.REKKI_API_KEY?.trim()
  const template = process.env.REKKI_SUPPLIERS_SEARCH_URL?.trim()

  if (!key || !template) {
    return {
      mode: 'manual',
      suppliers: [],
      message:
        'Ricerca automatica: configura sul server REKKI_API_KEY e REKKI_SUPPLIERS_SEARCH_URL (con {vat} nel path/query). ' +
        'Oppure incolla l’ID fornitore Rekki a mano.',
    }
  }

  const url = template.includes('{vat}')
    ? template.replace(/\{vat\}/g, encodeURIComponent(digits))
    : `${template}${template.includes('?') ? '&' : '?'}vat=${encodeURIComponent(digits)}`

  try {
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), 12_000)
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: ac.signal,
    })
    clearTimeout(to)
    if (!r.ok) {
      return {
        mode: 'api',
        suppliers: [],
        message: `Rekki ha risposto ${r.status}. Verifica URL e permessi API.`,
      }
    }
    const j: unknown = await r.json()
    const suppliers = normalizeResponseJson(j)
    return {
      mode: 'api',
      suppliers,
      message: suppliers.length ? undefined : 'Nessun fornitore Rekki trovato per questa P.IVA.',
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore di rete'
    return { mode: 'api', suppliers: [], message: msg }
  }
}
