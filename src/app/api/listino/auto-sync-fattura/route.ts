import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

interface LineItem {
  prodotto: string
  codice_prodotto: string | null
  prezzo: number
  unita: string | null
  note: string | null
}

interface MatchResult {
  lineItem: LineItem
  match: {
    listinoId: string
    prodotto: string
    prezzoAttuale: number
    rekkiProductId: string | null
    matchType: 'rekki_id' | 'fuzzy_name' | 'none'
    fuzzyScore?: number
  } | null
  delta: number | null
  deltaPercent: number | null
  isAnomaly: boolean
  isNew: boolean
}

/**
 * Fuzzy string matching using Levenshtein distance
 * Returns a score between 0 (no match) and 1 (perfect match)
 */
function fuzzyMatch(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  if (s1 === s2) return 1
  if (s1.includes(s2) || s2.includes(s1)) return 0.85
  
  const len1 = s1.length
  const len2 = s2.length
  const maxLen = Math.max(len1, len2)
  
  if (maxLen === 0) return 1
  
  // Levenshtein distance
  const matrix: number[][] = []
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  
  const distance = matrix[len1][len2]
  return 1 - distance / maxLen
}

/**
 * Match line items with listino_prezzi entries
 */
async function matchLineItems(
  service: ReturnType<typeof createServiceClient>,
  fornitoreId: string,
  lineItems: LineItem[]
): Promise<MatchResult[]> {
  // Get all listino entries for this supplier
  const { data: listino } = await service
    .from('listino_prezzi')
    .select('id, prodotto, prezzo, rekki_product_id')
    .eq('fornitore_id', fornitoreId)
    .order('data_prezzo', { ascending: false })
  
  if (!listino) return lineItems.map(item => ({
    lineItem: item,
    match: null,
    delta: null,
    deltaPercent: null,
    isAnomaly: false,
    isNew: true,
  }))
  
  const results: MatchResult[] = []
  
  for (const item of lineItems) {
    let bestMatch: MatchResult['match'] = null
    let bestScore = 0
    
    // 1. Try exact match by rekki_product_id (if item has codice_prodotto)
    if (item.codice_prodotto) {
      const rekkiMatch = listino.find(l => 
        l.rekki_product_id && 
        l.rekki_product_id.toLowerCase() === item.codice_prodotto?.toLowerCase()
      )
      
      if (rekkiMatch) {
        bestMatch = {
          listinoId: rekkiMatch.id,
          prodotto: rekkiMatch.prodotto,
          prezzoAttuale: rekkiMatch.prezzo,
          rekkiProductId: rekkiMatch.rekki_product_id,
          matchType: 'rekki_id',
        }
      }
    }
    
    // 2. If no rekki match, try fuzzy name matching
    if (!bestMatch) {
      for (const entry of listino) {
        const score = fuzzyMatch(item.prodotto, entry.prodotto)
        if (score > bestScore && score >= 0.75) {
          bestScore = score
          bestMatch = {
            listinoId: entry.id,
            prodotto: entry.prodotto,
            prezzoAttuale: entry.prezzo,
            rekkiProductId: entry.rekki_product_id,
            matchType: 'fuzzy_name',
            fuzzyScore: score,
          }
        }
      }
    }
    
    // Calculate delta and anomaly
    let delta: number | null = null
    let deltaPercent: number | null = null
    let isAnomaly = false
    
    if (bestMatch) {
      delta = item.prezzo - bestMatch.prezzoAttuale
      deltaPercent = (delta / bestMatch.prezzoAttuale) * 100
      isAnomaly = deltaPercent > 5 // Increase > 5%
    }
    
    results.push({
      lineItem: item,
      match: bestMatch,
      delta,
      deltaPercent,
      isAnomaly,
      isNew: !bestMatch,
    })
  }
  
  return results
}

/**
 * POST /api/listino/auto-sync-fattura
 * 
 * Extracts line items from a fattura and automatically matches them with listino_prezzi.
 * Returns match results with anomaly detection.
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  
  const { fattura_id } = await req.json() as { fattura_id: string }
  if (!fattura_id) {
    return NextResponse.json({ error: 'fattura_id richiesto' }, { status: 400 })
  }
  
  const service = createServiceClient()
  
  // Get fattura
  const { data: fattura, error: fatturaErr } = await service
    .from('fatture')
    .select('id, fornitore_id, file_url, data, numero_fattura')
    .eq('id', fattura_id)
    .single()
  
  if (fatturaErr || !fattura) {
    return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  }
  
  if (!fattura.fornitore_id) {
    return NextResponse.json({ error: 'Fattura senza fornitore associato' }, { status: 400 })
  }
  
  // Extract line items using existing endpoint
  const extractResponse = await fetch(
    `${req.nextUrl.origin}/api/listino/importa-da-fattura`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ fattura_id }),
    }
  )
  
  if (!extractResponse.ok) {
    const errorData = await extractResponse.json()
    return NextResponse.json(
      { error: `Errore estrazione line items: ${errorData.error}` },
      { status: extractResponse.status }
    )
  }
  
  const { items: lineItems } = await extractResponse.json() as { items: LineItem[] }
  
  if (!lineItems || lineItems.length === 0) {
    return NextResponse.json({
      matches: [],
      summary: {
        total: 0,
        matched: 0,
        anomalies: 0,
        new: 0,
      },
    })
  }
  
  // Match with listino
  const matches = await matchLineItems(service, fattura.fornitore_id, lineItems)
  
  const summary = {
    total: matches.length,
    matched: matches.filter(m => m.match !== null).length,
    anomalies: matches.filter(m => m.isAnomaly).length,
    new: matches.filter(m => m.isNew).length,
  }
  
  return NextResponse.json({
    matches,
    summary,
    fattura: {
      id: fattura.id,
      data: fattura.data,
      numero_fattura: fattura.numero_fattura,
    },
  })
}
