import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'

interface OverchargeItem {
  fatturaId: string
  fatturaData: string
  fatturaNumero: string | null
  prodotto: string
  rekkiProductId: string
  prezzoPagato: number
  prezzoPattuito: number
  differenza: number
  differenzaPercent: number
  quantita: number | null
  sprecoTotale: number
}

interface AuditSummary {
  totalOvercharges: number
  totalSpreco: number
  productCount: number
  fattureCount: number
  items: OverchargeItem[]
}

/**
 * Estrae la quantità dalla descrizione del line item usando pattern comuni
 */
function extractQuantityFromText(text: string): number | null {
  // Pattern comuni: "x5", "5x", "5 pz", "qty: 5", "quantità: 5", etc.
  const patterns = [
    /(?:x|qty|quantità|qta|quantity)[\s:]*(\d+)/i,
    /(\d+)[\s]*(?:x|pz|pcs|units|unità)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const qty = parseInt(match[1], 10)
      if (!isNaN(qty) && qty > 0 && qty < 10000) { // sanity check
        return qty
      }
    }
  }
  
  return null
}

/**
 * POST /api/audit/rekki-price-history
 * 
 * Analizza tutte le fatture storiche per un fornitore e identifica
 * i casi in cui è stato pagato un prezzo superiore a quello Rekki pattuito.
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Fornitore non trovato o accesso negato' }, { status: 403 })
  }

  
  const { fornitore_id, from_date, to_date } = await req.json() as {
    fornitore_id: string
    from_date?: string
    to_date?: string
  }
  
  if (!fornitore_id) {
    return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify the caller has access to this fornitore's sede before using the service client.
  const { data: fornitoreRow } = await service
    .from('fornitori')
    .select('sede_id')
    .eq('id', fornitore_id)
    .maybeSingle()

  if (!fornitoreRow) {
    return NextResponse.json({ error: 'Fornitore non trovato o accesso negato' }, { status: 404 })
  }

  const master = isMasterAdminRole(profile.role)
  if (!master && profile.sede_id !== fornitoreRow.sede_id) {
    return NextResponse.json({ error: 'Fornitore non trovato o accesso negato' }, { status: 403 })
  }

  // 1. Get all listino entries with rekki_product_id for this supplier
  const { data: listinoEntries, error: listinoErr } = await service
    .from('listino_prezzi')
    .select('rekki_product_id, prodotto, prezzo, data_prezzo')
    .eq('fornitore_id', fornitore_id)
    .not('rekki_product_id', 'is', null)
    .order('data_prezzo', { ascending: false })
  
  if (listinoErr) {
    return NextResponse.json({ error: listinoErr.message }, { status: 500 })
  }
  
  if (!listinoEntries || listinoEntries.length === 0) {
    return NextResponse.json({
      summary: {
        totalOvercharges: 0,
        totalSpreco: 0,
        productCount: 0,
        fattureCount: 0,
        items: [],
      }
    })
  }
  
  // Build map: rekki_product_id -> { prodotto, prezzo_pattuito, data_prezzo }
  const rekkiPriceMap = new Map<string, { prodotto: string; prezzo: number; data: string }>()
  for (const entry of listinoEntries) {
    if (!entry.rekki_product_id) continue
    const existing = rekkiPriceMap.get(entry.rekki_product_id)
    // Keep the most recent price
    if (!existing || entry.data_prezzo > existing.data) {
      rekkiPriceMap.set(entry.rekki_product_id, {
        prodotto: entry.prodotto,
        prezzo: entry.prezzo,
        data: entry.data_prezzo,
      })
    }
  }
  
  // 2. Get all fatture for this supplier in the date range
  let fattureQuery = service
    .from('fatture')
    .select('id, data, numero_fattura, file_url')
    .eq('fornitore_id', fornitore_id)
    .order('data', { ascending: false })
  
  if (from_date) {
    fattureQuery = fattureQuery.gte('data', from_date)
  }
  if (to_date) {
    fattureQuery = fattureQuery.lte('data', to_date)
  }
  
  const { data: fatture, error: fattureErr } = await fattureQuery
  
  if (fattureErr) {
    return NextResponse.json({ error: fattureErr.message }, { status: 500 })
  }
  
  if (!fatture || fatture.length === 0) {
    return NextResponse.json({
      summary: {
        totalOvercharges: 0,
        totalSpreco: 0,
        productCount: 0,
        fattureCount: 0,
        items: [],
      }
    })
  }
  
  // 3. For each fattura, extract line items and check for overcharges
  const overcharges: OverchargeItem[] = []
  const processedFattureIds = new Set<string>()
  const processedRekkiIds = new Set<string>()
  
  for (const fattura of fatture) {
    if (!fattura.file_url) continue
    
    try {
      // Extract line items using existing endpoint
      const extractResponse = await fetch(
        `${req.nextUrl.origin}/api/listino/importa-da-fattura`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({ fattura_id: fattura.id }),
        }
      )
      
      if (!extractResponse.ok) continue
      
      const { items } = await extractResponse.json() as { items: Array<{
        prodotto: string
        codice_prodotto: string | null
        prezzo: number
        unita: string | null
        note: string | null
      }> }
      
      for (const item of items) {
        // Try to match with rekki_product_id
        if (!item.codice_prodotto) continue
        
        const rekkiPrice = rekkiPriceMap.get(item.codice_prodotto)
        if (!rekkiPrice) continue
        
        // Only consider if price is higher than pattuito
        if (item.prezzo <= rekkiPrice.prezzo) continue
        
        // Only consider if the price was already established before this fattura
        if (fattura.data < rekkiPrice.data) continue
        
        const differenza = item.prezzo - rekkiPrice.prezzo
        const differenzaPercent = (differenza / rekkiPrice.prezzo) * 100
        
        // Only flag if difference is significant (> 1%)
        if (differenzaPercent <= 1) continue
        
        // Try to extract quantity
        const fullText = `${item.prodotto} ${item.note ?? ''} ${item.unita ?? ''}`
        const quantita = extractQuantityFromText(fullText)
        const sprecoTotale = quantita ? differenza * quantita : differenza
        
        overcharges.push({
          fatturaId: fattura.id,
          fatturaData: fattura.data,
          fatturaNumero: fattura.numero_fattura,
          prodotto: item.prodotto,
          rekkiProductId: item.codice_prodotto,
          prezzoPagato: item.prezzo,
          prezzoPattuito: rekkiPrice.prezzo,
          differenza,
          differenzaPercent,
          quantita,
          sprecoTotale,
        })
        
        processedFattureIds.add(fattura.id)
        processedRekkiIds.add(item.codice_prodotto)
      }
    } catch (err) {
      console.error(`[audit] Error processing fattura ${fattura.id}:`, err)
      // Continue with next fattura
    }
  }
  
  // 4. Calculate summary
  const totalSpreco = overcharges.reduce((sum, item) => sum + item.sprecoTotale, 0)
  
  const summary: AuditSummary = {
    totalOvercharges: overcharges.length,
    totalSpreco,
    productCount: processedRekkiIds.size,
    fattureCount: processedFattureIds.size,
    items: overcharges.sort((a, b) => b.sprecoTotale - a.sprecoTotale), // Sort by worst offenders
  }
  
  return NextResponse.json({ summary })
}
