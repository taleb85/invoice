import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'

export const maxDuration = 300 // 5 minutes

interface InvoiceProcessResult {
  invoicesFound: number
  invoicesProcessed: number
  anomaliesDetected: number
  errors: string[]
  details: Array<{
    invoiceId: string
    fornitore: string
    status: 'success' | 'error' | 'no_rekki_reference'
    anomalies?: number
  }>
}

/**
 * CRON /api/cron/auto-process-invoices
 * 
 * Automatically processes new invoices and compares them with Rekki order prices.
 * Should be called hourly via Vercel Cron or external cron service.
 * 
 * Logic:
 * 1. Find recently uploaded invoices (last 24h) that haven't been checked
 * 2. For each invoice, extract line items
 * 3. Compare with latest Rekki order (from rekki_auto_orders)
 * 4. Flag anomalies where invoice price > Rekki price by >5%
 * 5. Create notifications for significant discrepancies
 */
export async function GET(req: NextRequest) {
  // Security: verify cron secret
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  
  const isAuthorized = 
    authHeader === `Bearer ${secret}` || 
    querySecret === secret
  
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const supabase = createServiceClient()
  const result: InvoiceProcessResult = {
    invoicesFound: 0,
    invoicesProcessed: 0,
    anomaliesDetected: 0,
    errors: [],
    details: [],
  }
  
  try {
    // 1. Find recent fatture from Rekki-linked suppliers
    const { data: fatture, error: fattureErr } = await supabase
      .from('fatture')
      .select(`
        id,
        fornitore_id,
        data,
        numero_fattura,
        importo,
        file_url,
        fornitori!inner(
          id,
          nome,
          rekki_supplier_id,
          rekki_link
        )
      `)
      .gte('data', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .or('rekki_supplier_id.neq.null,rekki_link.neq.null', { foreignTable: 'fornitori' })
      .order('data', { ascending: false })
      .limit(50)
    
    if (fattureErr) {
      return NextResponse.json({
        error: fattureErr.message,
        ...result,
      }, { status: 500 })
    }
    
    if (!fatture || fatture.length === 0) {
      return NextResponse.json({
        ...result,
        message: 'No recent invoices from Rekki suppliers found',
      })
    }
    
    result.invoicesFound = fatture.length
    console.log(`[AUTO-INVOICE] Found ${fatture.length} recent invoices from Rekki suppliers`)
    
    // 2. Process each invoice
    for (const fattura of fatture) {
      try {
        const fornitore = (fattura as any).fornitori
        
        // Get latest Rekki order for this supplier
        const { data: latestOrder } = await supabase
          .from('rekki_auto_orders')
          .select('*')
          .eq('fornitore_id', fornitore.id)
          .eq('status', 'completed')
          .order('email_received_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (!latestOrder) {
          console.log(`[AUTO-INVOICE] No Rekki order found for ${fornitore.nome}, skipping`)
          result.details.push({
            invoiceId: fattura.id,
            fornitore: fornitore.nome,
            status: 'no_rekki_reference',
          })
          continue
        }
        
        // Extract line items from invoice (call existing API)
        const extractRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/listino/importa-da-fattura`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_url: fattura.file_url,
            fornitore_id: fornitore.id,
          }),
        })
        
        if (!extractRes.ok) {
          result.errors.push(`Failed to extract items from invoice ${fattura.numero_fattura}`)
          continue
        }
        
        const { items: invoiceItems } = await extractRes.json()
        
        if (!invoiceItems || invoiceItems.length === 0) {
          console.log(`[AUTO-INVOICE] No items extracted from ${fattura.numero_fattura}`)
          continue
        }
        
        // Compare with Rekki order
        const rekkiPrices = new Map<string, number>()
        const rekkiLines = latestOrder.metadata?.price_changes || []
        
        rekkiLines.forEach((change: any) => {
          const normalized = change.prodotto.toLowerCase().trim()
          rekkiPrices.set(normalized, change.newPrice)
        })
        
        let anomalyCount = 0
        const anomalies: Array<{
          prodotto: string
          invoicePrice: number
          rekkiPrice: number
          delta: number
        }> = []
        
        for (const item of invoiceItems) {
          const normalized = item.product.toLowerCase().trim()
          const rekkiPrice = rekkiPrices.get(normalized)
          
          if (!rekkiPrice) continue
          
          const invoicePrice = item.price
          const delta = ((invoicePrice - rekkiPrice) / rekkiPrice) * 100
          
          // Flag if invoice price > Rekki price by >5%
          if (delta > 5) {
            anomalyCount++
            anomalies.push({
              prodotto: item.product,
              invoicePrice,
              rekkiPrice,
              delta,
            })
          }
        }
        
        if (anomalyCount > 0) {
          result.anomaliesDetected += anomalyCount
          
          // Create notification / alert
          console.log(`[AUTO-INVOICE] ⚠️ ${anomalyCount} price anomalies detected in ${fattura.numero_fattura} for ${fornitore.nome}`)
          
          // Log to database for audit
          await supabase.from('log_sincronizzazione').insert([{
            mittente: 'auto-invoice-check',
            oggetto_mail: `Anomalie prezzi: ${fattura.numero_fattura}`,
            stato: 'fornitore_suggerito',
            fornitore_id: fornitore.id,
            file_url: fattura.file_url,
            errore_dettaglio: `${anomalyCount} prodotti con prezzo fattura superiore al prezzo Rekki confermato:\n${anomalies.map(a => `- ${a.prodotto}: Fattura £${a.invoicePrice.toFixed(2)} vs Rekki £${a.rekkiPrice.toFixed(2)} (+${a.delta.toFixed(1)}%)`).join('\n')}`,
          }])
        }
        
        result.invoicesProcessed++
        result.details.push({
          invoiceId: fattura.id,
          fornitore: fornitore.nome,
          status: 'success',
          anomalies: anomalyCount,
        })
        
        console.log(`[AUTO-INVOICE] ✅ Processed ${fattura.numero_fattura} for ${fornitore.nome} - ${anomalyCount} anomalies`)
        
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        result.errors.push(`Error processing invoice ${fattura.numero_fattura}: ${errMsg}`)
        console.error(`[AUTO-INVOICE] Error processing ${fattura.numero_fattura}:`, err)
      }
    }
    
    return NextResponse.json({
      ...result,
      message: `Processed ${result.invoicesProcessed}/${result.invoicesFound} invoices, detected ${result.anomaliesDetected} anomalies`,
    })
    
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AUTO-INVOICE] Fatal error:', err)
    return NextResponse.json({
      error: errMsg,
      ...result,
    }, { status: 500 })
  }
}
