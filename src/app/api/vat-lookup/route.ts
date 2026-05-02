import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'

export type VatLookupResult = {
  found: boolean
  ragione_sociale: string | null
  indirizzo: string | null
  piva: string
  paese: string
}

function cleanPiva(raw: string, country: string): string {
  let s = raw.trim().replace(/\s/g, '').toUpperCase()
  // Strip country prefix if present (IT1234... → 1234...)
  const countryPrefix = country.toUpperCase()
  if (s.startsWith(countryPrefix)) s = s.slice(countryPrefix.length)
  // For GB strip prefix too
  if (country.toUpperCase() === 'GB' && s.startsWith('GB')) s = s.slice(2)
  return s
}

async function checkCache(supabase: SupabaseClient, cacheKey: string): Promise<VatLookupResult | null> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('vat_lookup_cache')
      .select('data, cached_at')
      .eq('piva', cacheKey)
      .gte('cached_at', thirtyDaysAgo)
      .maybeSingle()
    if (data?.data) return data.data as VatLookupResult
  } catch {
    // Cache miss — continue
  }
  return null
}

async function saveCache(supabase: SupabaseClient, cacheKey: string, result: VatLookupResult) {
  try {
    await supabase
      .from('vat_lookup_cache')
      .upsert([{ piva: cacheKey, data: result, cached_at: new Date().toISOString() }], { onConflict: 'piva' })
  } catch {
    // Cache write failure is non-fatal
  }
}

async function lookupViesIT(piva: string): Promise<VatLookupResult | null> {
  try {
    const res = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/${piva}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      isValid?: boolean
      name?: string
      address?: string
      userError?: string
    }
    if (!json.isValid) return null
    const name = json.name && json.name !== '---' ? json.name.trim() : null
    const address = json.address && json.address !== '---' ? json.address.trim() : null
    return { found: true, ragione_sociale: name, indirizzo: address, piva, paese: 'IT' }
  } catch {
    return null
  }
}

async function lookupOpenFiscaIT(piva: string): Promise<VatLookupResult | null> {
  try {
    const res = await fetch(`https://agenzia-entrate-api.vercel.app/api/piva/${piva}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      denominazione?: string
      indirizzo?: string
      comune?: string
      found?: boolean
    }
    if (!json.denominazione) return null
    const address = [json.indirizzo, json.comune].filter(Boolean).join(', ') || null
    return { found: true, ragione_sociale: json.denominazione.trim(), indirizzo: address, piva, paese: 'IT' }
  } catch {
    return null
  }
}

async function lookupCompaniesHouseGB(vatNumber: string): Promise<VatLookupResult | null> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(
      `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(vatNumber)}`,
      {
        headers: { Authorization: 'Basic ' + Buffer.from(apiKey + ':').toString('base64') },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      items?: Array<{ title?: string; address_snippet?: string; company_number?: string }>
    }
    const first = json.items?.[0]
    if (!first?.title) return null
    return {
      found: true,
      ragione_sociale: first.title,
      indirizzo: first.address_snippet ?? null,
      piva: vatNumber,
      paese: 'GB',
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const rawPiva = searchParams.get('piva') ?? ''
  const country = (searchParams.get('country') ?? 'IT').toUpperCase()

  if (!rawPiva) {
    return NextResponse.json({ error: 'piva parameter required' }, { status: 400 })
  }

  const piva = cleanPiva(rawPiva, country)

  if (piva.length < 7) {
    return NextResponse.json({ found: false, ragione_sociale: null, indirizzo: null, piva, paese: country })
  }

  const supabase = createServiceClient()
  const cacheKey = `${country}:${piva}`

  // Check cache first
  const cached = await checkCache(supabase, cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
  }

  let result: VatLookupResult | null = null

  if (country === 'IT') {
    // Try VIES first (EU VAT Information Exchange System — free, no key)
    result = await lookupViesIT(piva)
    // Fallback: OpenFisca community API
    if (!result) result = await lookupOpenFiscaIT(piva)
  } else if (country === 'GB') {
    result = await lookupCompaniesHouseGB(piva)
  }

  const finalResult: VatLookupResult = result ?? {
    found: false,
    ragione_sociale: null,
    indirizzo: null,
    piva,
    paese: country,
  }

  // Cache result (including negative results — avoids hammering APIs for bad PIVAs)
  if (finalResult.found) {
    await saveCache(supabase, cacheKey, finalResult)
  }

  return NextResponse.json(finalResult)
}
