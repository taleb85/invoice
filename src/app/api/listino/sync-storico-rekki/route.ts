import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

/**
 * POST /api/listino/sync-storico-rekki
 * 
 * Sincronizza tutti i prezzi del listino con le fatture storiche per eliminare
 * i blocchi "Data documento anteriore". Aggiorna automaticamente data_prezzo
 * per ogni prodotto in base alla fattura più vecchia trovata.
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  
  const { fornitore_id } = await req.json() as { fornitore_id: string }
  
  if (!fornitore_id) {
    return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
  }
  
  const service = createServiceClient()
  
  // 1. Get all listino entries for this supplier with rekki_product_id
  const { data: listinoEntries, error: listinoErr } = await service
    .from('listino_prezzi')
    .select('id, rekki_product_id, prodotto, prezzo, data_prezzo')
    .eq('fornitore_id', fornitore_id)
    .not('rekki_product_id', 'is', null)
  
  if (listinoErr) {
    return NextResponse.json({ error: listinoErr.message }, { status: 500 })
  }
  
  if (!listinoEntries || listinoEntries.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Nessun prodotto Rekki da sincronizzare',
      updated: 0,
    })
  }
  
  // 2. Get ALL fatture for this supplier (no date limit)
  const { data: fatture, error: fattureErr } = await service
    .from('fatture')
    .select('id, data, file_url')
    .eq('fornitore_id', fornitore_id)
    .order('data', { ascending: true }) // Oldest first
  
  if (fattureErr) {
    return NextResponse.json({ error: fattureErr.message }, { status: 500 })
  }
  
  if (!fatture || fatture.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'Nessuna fattura storica da analizzare',
      updated: 0,
    })
  }
  
  // 3. Build map: rekki_product_id -> earliest date found
  const earliestDateMap = new Map<string, { date: string; price: number }>()
  
  // Initialize with current listino dates
  for (const entry of listinoEntries) {
    if (!entry.rekki_product_id) continue
    earliestDateMap.set(entry.rekki_product_id, {
      date: entry.data_prezzo,
      price: entry.prezzo,
    })
  }
  
  // 4. Scan all fatture to find earlier occurrences
  let processedCount = 0
  for (const fattura of fatture) {
    if (!fattura.file_url) continue
    
    try {
      // Extract line items
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
      }> }
      
      for (const item of items) {
        if (!item.codice_prodotto) continue
        
        const current = earliestDateMap.get(item.codice_prodotto)
        if (!current) continue
        
        // Update if this fattura is earlier
        if (fattura.data < current.date) {
          earliestDateMap.set(item.codice_prodotto, {
            date: fattura.data,
            price: item.prezzo,
          })
        }
      }
      
      processedCount++
    } catch (err) {
      console.error(`[sync-storico] Error processing fattura ${fattura.id}:`, err)
    }
  }
  
  // 5. Update listino entries with new earliest dates
  let updatedCount = 0
  for (const entry of listinoEntries) {
    if (!entry.rekki_product_id) continue
    
    const earliest = earliestDateMap.get(entry.rekki_product_id)
    if (!earliest) continue
    
    // Only update if we found an earlier date
    if (earliest.date < entry.data_prezzo) {
      const { error: updateErr } = await service
        .from('listino_prezzi')
        .update({
          data_prezzo: earliest.date,
          // Optionally update price too if it changed
          ...(earliest.price !== entry.prezzo && { prezzo: earliest.price }),
        })
        .eq('id', entry.id)
      
      if (!updateErr) {
        updatedCount++
      } else {
        console.error(`[sync-storico] Error updating ${entry.id}:`, updateErr)
      }
    }
  }
  
  return NextResponse.json({
    success: true,
    message: `Sincronizzazione completata: ${updatedCount} prodotti aggiornati`,
    updated: updatedCount,
    scanned: processedCount,
  })
}
