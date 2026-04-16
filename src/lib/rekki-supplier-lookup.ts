/**
 * Ricerca fornitore Rekki per P.IVA (normalizzata).
 *
 * ## Diagnosi: perché la ricerca automatica via P.IVA fallisce
 *
 * 1. **Variabili d’ambiente assenti** — `lookupRekkiSuppliersByVat` legge solo `process.env` sul **runtime
 *    Node del server Next.js** (route `POST /api/fornitore-rekki`). Se `REKKI_API_KEY` o
 *    `REKKI_SUPPLIERS_SEARCH_URL` non sono definite lì, la modalità passa a `manual` senza chiamata HTTP.
 * 2. **Dove inserirle**
 *    - **Sviluppo locale:** file `.env.local` nella root del progetto Next (accanto a `package.json`),
 *      righe ad esempio:
 *        `REKKI_API_KEY=...`
 *        `REKKI_SUPPLIERS_SEARCH_URL=https://api.example.com/v1/suppliers/search?vat={vat}`
 *      Il placeholder `{vat}` viene sostituito con la sola **parte numerica** della P.IVA; senza `{vat}`
 *      viene aggiunto `?vat=` o `&vat=`. Riavvia `next dev` dopo le modifiche.
 *    - **Produzione (Vercel / Docker / altro host):** variabili d’ambiente nel pannello del provider
 *      (es. Project Settings → Environment Variables su Vercel), **non** in Supabase Dashboard, a meno che
 *      non richiami Rekki da Edge Functions / Database Webhooks (in quel caso andrebbero nei Secrets Supabase
 *      per quel contesto). Questa app usa la Route Handler Next → env del **deploy Next**.
 * 3. **Risposta API** — `REKKI_SUPPLIERS_SEARCH_URL` deve restituire JSON con array in `data` | `suppliers` |
 *    `items` | `results` e oggetti con `id` (o `supplier_id` / `uuid`) e nome. Status ≠ 2xx o JSON non
 *    conforme → nessun fornitore in lista.
 *
 * Senza API: usare il pulsante «Cerca su Rekki (P.IV.A)» (Google `site:rekki.com` + VAT) o «Cerca su Rekki»
 * (nome + `site:rekki.com`), poi incollare l’URL profilo nel
 * campo Link; `extractRekkiSupplierIdFromUrl` ricava l’ID.
 */

export type RekkiSupplierHit = { id: string; name: string }

/** Suggerimenti senza chiamate HTTP a Google/Rekki (solo URL da aprire nel browser). */
export type RekkiLookupFallbackHints = {
  googleSearchByVatUrl: string | null
  googleSearchByCompanyUrl: string | null
  /** Promemoria breve per gli operatori (dove configurare le env). */
  envSetupHint?: string
}

export type RekkiLookupResult = {
  mode: 'api' | 'manual'
  suppliers: RekkiSupplierHit[]
  message?: string
  /** Presente quando mancano le API, la risposta è vuota o in errore: aprire questi link nel browser. */
  fallback?: RekkiLookupFallbackHints | null
}

const ENV_HINT =
  'Variabili server Next.js: in locale `.env.local` nella root del repo; in produzione pannello env del deploy (es. Vercel). Chiavi: REKKI_API_KEY, REKKI_SUPPLIERS_SEARCH_URL (con {vat}).'

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

const MIN_VAT_DIGITS = 7

function digitsOnlyVat(pivaRaw: string): string {
  return (pivaRaw ?? '').replace(/\D/g, '')
}

/**
 * Google con query `site:rekki.com` + P.IVA (solo cifre). Aprire in nuova scheda dal client.
 */
export function buildGoogleSiteRekkiSearchUrlForVat(vatDigits: string): string | null {
  const d = digitsOnlyVat(vatDigits)
  if (d.length < MIN_VAT_DIGITS) return null
  const q = `site:rekki.com ${d}`
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

/**
 * Google con `site:rekki.com` + ragione sociale (ricerca manuale sul dominio Rekki).
 */
export function buildGoogleSiteRekkiSearchUrlForCompany(companyName: string): string | null {
  const t = companyName.replace(/\s+/g, ' ').trim()
  if (t.length < 2) return null
  const q = `site:rekki.com ${t}`
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`
}

/**
 * Google generico sul nome fornitore (senza vincolo `site:`).
 */
export function buildGoogleSearchUrlForCompanyName(companyName: string): string | null {
  const t = companyName.replace(/\s+/g, ' ').trim()
  if (t.length < 2) return null
  return `https://www.google.com/search?q=${encodeURIComponent(t)}`
}

/**
 * Fallback «smart» senza scraping: solo URL di ricerca (e hint env), nessuna richiesta server-side a Google/Rekki.
 */
export function buildRekkiDiscoveryFallbackHints(opts: {
  vatDigits: string
  supplierDisplayName?: string | null
  includeEnvHint?: boolean
}): RekkiLookupFallbackHints {
  const vatDigits = digitsOnlyVat(opts.vatDigits)
  return {
    googleSearchByVatUrl: buildGoogleSiteRekkiSearchUrlForVat(vatDigits),
    googleSearchByCompanyUrl: buildGoogleSiteRekkiSearchUrlForCompany(opts.supplierDisplayName ?? '') ?? null,
    envSetupHint: opts.includeEnvHint ? ENV_HINT : undefined,
  }
}

export async function lookupRekkiSuppliersByVat(
  pivaRaw: string,
  opts?: { supplierDisplayName?: string | null },
): Promise<RekkiLookupResult> {
  const digits = digitsOnlyVat(pivaRaw)
  const name = opts?.supplierDisplayName?.trim() || null

  const attachFallback = (
    base: Omit<RekkiLookupResult, 'fallback'>,
    includeEnvHint: boolean,
  ): RekkiLookupResult => ({
    ...base,
    fallback: buildRekkiDiscoveryFallbackHints({
      vatDigits: digits,
      supplierDisplayName: name,
      includeEnvHint,
    }),
  })

  if (digits.length < MIN_VAT_DIGITS) {
    return attachFallback(
      { mode: 'manual', suppliers: [], message: 'P.IVA / VAT troppo corta per la ricerca.' },
      false,
    )
  }

  /** Solo runtime server Next.js (route `POST /api/fornitore-rekki` → questa funzione). */
  const key = process.env.REKKI_API_KEY?.trim()
  const template = process.env.REKKI_SUPPLIERS_SEARCH_URL?.trim()

  if (!key || !template) {
    return attachFallback(
      {
        mode: 'manual',
        suppliers: [],
        message:
          'Ricerca da P.IVA non attiva: sul server Next.js servono REKKI_API_KEY e REKKI_SUPPLIERS_SEARCH_URL (con {vat} nel path o query; header Bearer). ' +
          'Usa «Cerca su Rekki» qui sotto o incolla il link profilo nel campo Link.',
      },
      true,
    )
  }

  const vatEncoded = encodeURIComponent(digits)
  const hasVatPlaceholder = /\{vat\}/i.test(template)
  const url = hasVatPlaceholder
    ? template.replace(/\{vat\}/gi, vatEncoded)
    : `${template}${template.includes('?') ? '&' : '?'}vat=${vatEncoded}`

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
      return attachFallback(
        {
          mode: 'api',
          suppliers: [],
          message: `Rekki ha risposto ${r.status}. Verifica URL e permessi API.`,
        },
        false,
      )
    }
    const j: unknown = await r.json()
    const suppliers = normalizeResponseJson(j)
    if (!suppliers.length) {
      return attachFallback(
        {
          mode: 'api',
          suppliers: [],
          message: 'Nessun fornitore Rekki trovato per questa P.IVA.',
        },
        false,
      )
    }
    return {
      mode: 'api',
      suppliers,
      message: undefined,
      fallback: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore di rete'
    return attachFallback({ mode: 'api', suppliers: [], message: msg }, false)
  }
}
