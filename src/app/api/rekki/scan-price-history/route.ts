import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { gmailService, type GmailMessage } from '@/lib/gmail-service'
import { parseRekkiFromEmailParts, isLikelyRekkiEmail } from '@/lib/rekki-parser'

export const maxDuration = 300 // 5 minutes for scanning

interface HistoryScanResult {
  success: boolean
  fornitore: string
  emailsScanned: number
  productsFound: number
  pricesExtracted: number
  dateRange: {
    oldest: string | null
    newest: string | null
  }
  lowestPrices: Array<{
    prodotto: string
    lowestPrice: number
    currentPrice: number | null
    potentialSavings: number
    occurrences: number
  }>
  potentialRefunds: Array<{
    fatturaId: string
    numeroFattura: string | null
    dataFattura: string
    prodotto: string
    pricePaid: number
    lowestEmailPrice: number
    delta: number
    deltaPercent: number
    quantity: number
    potentialRefund: number
  }>
  totalPotentialRefund: number
}

/**
 * POST /api/rekki/scan-price-history
 * 
 * Scans all historical emails from orders@rekki.com for a supplier,
 * extracts price data, and identifies potential refunds.
 * 
 * Body:
 * - fornitore_id: UUID
 * - max_emails: number (optional, default 100)
 * - lookback_days: number (optional, default 365)
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  
  const {
    fornitore_id,
    max_emails = 100,
    lookback_days = 365,
  } = await req.json() as {
    fornitore_id: string
    max_emails?: number
    lookback_days?: number
  }
  
  if (!fornitore_id) {
    return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
  }
  
  const service = createServiceClient()
  
  // Verify Gmail API configured
  if (!gmailService.isConfigured()) {
    return NextResponse.json({
      error: 'Gmail API non configurato',
      hint: 'Aggiungi GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, e GMAIL_REFRESH_TOKEN a .env.local'
    }, { status: 500 })
  }
  
  // Get fornitore details
  const { data: fornitore, error: fornErr } = await service
    .from('fornitori')
    .select('id, nome, sede_id, rekki_supplier_id, rekki_link')
    .eq('id', fornitore_id)
    .single()
  
  if (fornErr || !fornitore) {
    return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
  }
  
  try {
    // Initialize Gmail service
    await gmailService.init(service)
    
    // Build search query: from:orders@rekki.com + fornitore name
    const query = `from:orders@rekki.com "${fornitore.nome}" newer_than:${lookback_days}d`
    
    console.log(`[PRICE-HISTORY] Searching Gmail: ${query}`)
    
    // Get message IDs
    const gmail = (gmailService as any).oauth2Client
    const { google } = await import('googleapis')
    const gmailClient = google.gmail({ version: 'v1', auth: gmail })
    
    const searchResponse = await gmailClient.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: max_emails,
    })
    
    const messageIds = searchResponse.data.messages?.map(m => m.id as string) || []
    
    if (messageIds.length === 0) {
      return NextResponse.json({
        success: true,
        fornitore: fornitore.nome,
        emailsScanned: 0,
        productsFound: 0,
        pricesExtracted: 0,
        message: 'Nessuna email trovata per questo fornitore',
      })
    }
    
    console.log(`[PRICE-HISTORY] Found ${messageIds.length} emails for ${fornitore.nome}`)
    
    // Track discovered prices
    const priceRecords: Array<{
      prodotto: string
      prodotto_normalized: string
      prezzo_unitario: number
      quantita: number
      email_message_id: string
      email_subject: string | null
      email_date: string
    }> = []
    
    // Process each email
    for (const messageId of messageIds) {
      try {
        const message = await gmailService.getMessage(messageId)
        if (!message) continue
        
        // Verify it's a Rekki email
        if (!isLikelyRekkiEmail(message.subject, message.from, message.bodyText || message.bodyHtml)) {
          continue
        }
        
        // Parse Rekki lines
        const rekkiLines = parseRekkiFromEmailParts({
          subject: message.subject,
          html: message.bodyHtml,
          text: message.bodyText,
        })
        
        if (rekkiLines.length === 0) continue
        
        // Convert internalDate to ISO string
        const emailDate = message.internalDate 
          ? new Date(parseInt(message.internalDate)).toISOString()
          : new Date().toISOString()
        
        // Add to records
        for (const line of rekkiLines) {
          priceRecords.push({
            prodotto: line.prodotto,
            prodotto_normalized: line.prodotto.toLowerCase().trim(),
            prezzo_unitario: line.prezzo_unitario,
            quantita: line.quantita,
            email_message_id: messageId,
            email_subject: message.subject,
            email_date: emailDate,
          })
        }
        
        console.log(`[PRICE-HISTORY] Extracted ${rekkiLines.length} products from ${messageId}`)
        
      } catch (err) {
        console.error(`[PRICE-HISTORY] Error processing ${messageId}:`, err)
        continue
      }
    }
    
    if (priceRecords.length === 0) {
      return NextResponse.json({
        success: true,
        fornitore: fornitore.nome,
        emailsScanned: messageIds.length,
        productsFound: 0,
        pricesExtracted: 0,
        message: 'Nessun prodotto estratto dalle email',
      })
    }
    
    // Insert into price_history (upsert to avoid duplicates)
    const insertPromises = priceRecords.map(record =>
      service.from('rekki_price_history').upsert([{
        fornitore_id: fornitore.id,
        sede_id: fornitore.sede_id,
        ...record,
      }], {
        onConflict: 'email_message_id,prodotto_normalized',
        ignoreDuplicates: true,
      })
    )
    
    await Promise.all(insertPromises)
    
    console.log(`[PRICE-HISTORY] Inserted ${priceRecords.length} price records`)
    
    // Refresh materialized view
    try {
      await service.rpc('refresh_materialized_view', { view_name: 'rekki_lowest_prices' })
    } catch (mvErr) {
      // Ignore error if function doesn't exist yet or view refresh fails
      console.warn('[PRICE-HISTORY] Materialized view refresh failed:', mvErr)
    }
    
    // Analyze: Find lowest prices per product
    const { data: lowestPrices } = await service
      .from('rekki_price_history')
      .select('prodotto_normalized, prezzo_unitario')
      .eq('fornitore_id', fornitore.id)
      .order('prezzo_unitario', { ascending: true })
    
    const lowestPriceMap = new Map<string, number>()
    lowestPrices?.forEach(p => {
      const current = lowestPriceMap.get(p.prodotto_normalized)
      if (!current || p.prezzo_unitario < current) {
        lowestPriceMap.set(p.prodotto_normalized, p.prezzo_unitario)
      }
    })
    
    // Get current listino prices
    const { data: currentListino } = await service
      .from('listino_prezzi')
      .select('prodotto, prezzo')
      .eq('fornitore_id', fornitore.id)
    
    const currentPriceMap = new Map<string, number>()
    currentListino?.forEach(l => {
      currentPriceMap.set(l.prodotto.toLowerCase().trim(), l.prezzo)
    })
    
    // Build lowest prices comparison
    const lowestPricesComparison = Array.from(lowestPriceMap.entries()).map(([prodNorm, lowest]) => {
      const current = currentPriceMap.get(prodNorm) || null
      const savings = current ? current - lowest : 0
      
      // Count occurrences
      const occurrences = priceRecords.filter(r => r.prodotto_normalized === prodNorm).length
      
      return {
        prodotto: priceRecords.find(r => r.prodotto_normalized === prodNorm)?.prodotto || prodNorm,
        lowestPrice: lowest,
        currentPrice: current,
        potentialSavings: savings,
        occurrences,
      }
    }).filter(p => p.potentialSavings > 0)
    
    // Analyze invoices for potential refunds
    const { data: fatture } = await service
      .from('fatture')
      .select('id, numero_fattura, data, importo')
      .eq('fornitore_id', fornitore.id)
      .gte('data', new Date(Date.now() - lookback_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('data', { ascending: false })
    
    const potentialRefunds: HistoryScanResult['potentialRefunds'] = []
    
    if (fatture && fatture.length > 0) {
      // For each invoice, extract line items and compare
      for (const fattura of fatture.slice(0, 20)) { // Limit to 20 most recent
        try {
          // Call existing API to extract items
          const extractRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/listino/importa-da-fattura`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fornitore_id: fornitore.id,
              fattura_id: fattura.id,
            }),
          })
          
          if (!extractRes.ok) continue
          
          const { items } = await extractRes.json()
          
          if (!items || items.length === 0) continue
          
          // Compare each item with lowest email price
          for (const item of items) {
            const normalized = item.product.toLowerCase().trim()
            const lowestEmailPrice = lowestPriceMap.get(normalized)
            
            if (!lowestEmailPrice) continue
            
            const pricePaid = item.price
            const delta = pricePaid - lowestEmailPrice
            const deltaPercent = (delta / lowestEmailPrice) * 100
            
            // Flag if paid more than 5% above lowest email price
            if (deltaPercent > 5) {
              potentialRefunds.push({
                fatturaId: fattura.id,
                numeroFattura: fattura.numero_fattura,
                dataFattura: fattura.data,
                prodotto: item.product,
                pricePaid,
                lowestEmailPrice,
                delta,
                deltaPercent,
                quantity: item.quantity || 1,
                potentialRefund: delta * (item.quantity || 1),
              })
            }
          }
        } catch (err) {
          console.error(`[PRICE-HISTORY] Error analyzing fattura ${fattura.id}:`, err)
          continue
        }
      }
    }
    
    const totalPotentialRefund = potentialRefunds.reduce((sum, r) => sum + r.potentialRefund, 0)
    
    // Date range
    const dates = priceRecords.map(r => r.email_date).sort()
    const dateRange = {
      oldest: dates[0] || null,
      newest: dates[dates.length - 1] || null,
    }
    
    const result: HistoryScanResult = {
      success: true,
      fornitore: fornitore.nome,
      emailsScanned: messageIds.length,
      productsFound: new Set(priceRecords.map(r => r.prodotto_normalized)).size,
      pricesExtracted: priceRecords.length,
      dateRange,
      lowestPrices: lowestPricesComparison.slice(0, 50), // Top 50
      potentialRefunds,
      totalPotentialRefund,
    }
    
    return NextResponse.json({ result })
    
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Errore sconosciuto'
    console.error('[PRICE-HISTORY] Fatal error:', err)
    return NextResponse.json({
      error: errMsg,
      fornitore: fornitore.nome,
    }, { status: 500 })
  }
}
