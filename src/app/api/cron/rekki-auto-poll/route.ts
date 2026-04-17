import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/server'
import { gmailService, type GmailMessage } from '@/lib/gmail-service'
import { parseRekkiFromEmailParts, isLikelyRekkiEmail } from '@/lib/rekki-parser'
import { persistRekkiOrderStatement } from '@/lib/rekki-statement'

export const maxDuration = 300 // 5 minutes for cron job

interface ProcessingResult {
  messagesFound: number
  messagesProcessed: number
  ordersCreated: number
  errors: string[]
  details: Array<{
    messageId: string
    fornitore: string
    status: 'success' | 'error' | 'skipped'
    reason?: string
  }>
}

/**
 * CRON /api/cron/rekki-auto-poll
 * 
 * Polls Gmail for new Rekki order confirmation emails and processes them automatically.
 * Should be called every 15 minutes via Vercel Cron or external cron service.
 * 
 * Setup:
 * 1. Configure Gmail API credentials in .env.local
 * 2. Add to vercel.json:
 *    {
 *      "crons": [{
 *        "path": "/api/cron/rekki-auto-poll",
 *        "schedule": "every 15 minutes"
 *      }]
 *    }
 * 3. Secure with CRON_SECRET environment variable
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
  
  // Check if Gmail API is configured
  if (!gmailService.isConfigured()) {
    return NextResponse.json({
      error: 'Gmail API not configured',
      hint: 'Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN to .env.local'
    }, { status: 500 })
  }
  
  const supabase = createServiceClient()
  const result: ProcessingResult = {
    messagesFound: 0,
    messagesProcessed: 0,
    ordersCreated: 0,
    errors: [],
    details: [],
  }
  
  try {
    // Initialize Gmail service with supabase
    await gmailService.init(supabase)
    
    // Try to use global/system account (GMAIL_REFRESH_TOKEN in env)
    // For multi-user, you'd get userId from request or iterate through connected users
    
    // 1. Search for unread Rekki emails
    const messageIds = await gmailService.searchRekkiOrderEmails(20)
    result.messagesFound = messageIds.length
    
    if (messageIds.length === 0) {
      return NextResponse.json({
        ...result,
        message: 'No new Rekki emails found',
      })
    }
    
    console.log(`[REKKI-AUTO] Found ${messageIds.length} unread Rekki emails`)
    
    // 2. Process each email
    for (const messageId of messageIds) {
      try {
        // Check if already processed
        const { data: existing } = await supabase
          .from('rekki_auto_orders')
          .select('id')
          .eq('email_message_id', messageId)
          .maybeSingle()
        
        if (existing) {
          console.log(`[REKKI-AUTO] Message ${messageId} already processed, skipping`)
          result.details.push({
            messageId,
            fornitore: '(duplicate)',
            status: 'skipped',
            reason: 'Already processed',
          })
          continue
        }
        
        // Fetch full message
        const message = await gmailService.getMessage(messageId)
        if (!message) {
          result.errors.push(`Failed to fetch message ${messageId}`)
          continue
        }
        
        // Verify it's a Rekki email
        if (!isLikelyRekkiEmail(message.subject, message.from, message.bodyText || message.bodyHtml)) {
          console.log(`[REKKI-AUTO] Message ${messageId} doesn't look like Rekki order, skipping`)
          result.details.push({
            messageId,
            fornitore: '(not Rekki)',
            status: 'skipped',
            reason: 'Not a Rekki order email',
          })
          continue
        }
        
        // Parse Rekki lines
        const rekkiLines = parseRekkiFromEmailParts({
          subject: message.subject,
          html: message.bodyHtml,
          text: message.bodyText,
        })
        
        if (rekkiLines.length === 0) {
          console.log(`[REKKI-AUTO] No products extracted from ${messageId}`)
          result.errors.push(`No products extracted from message ${messageId}`)
          result.details.push({
            messageId,
            fornitore: '(unknown)',
            status: 'error',
            reason: 'No products extracted',
          })
          continue
        }
        
        // Find fornitore by checking all Rekki-linked suppliers
        const { data: fornitori } = await supabase
          .from('fornitori')
          .select('id, nome, sede_id, rekki_supplier_id, rekki_link')
          .or('rekki_supplier_id.neq.null,rekki_link.neq.null')
        
        if (!fornitori || fornitori.length === 0) {
          result.errors.push('No Rekki-linked suppliers found in system')
          result.details.push({
            messageId,
            fornitore: '(none)',
            status: 'error',
            reason: 'No Rekki suppliers configured',
          })
          continue
        }
        
        // For now, use first Rekki supplier (TODO: improve matching logic)
        // In production, you'd parse supplier name from email or use other heuristics
        const fornitore = fornitori[0]
        
        console.log(`[REKKI-AUTO] Processing order for ${fornitore.nome} with ${rekkiLines.length} products`)
        
        // Process the order (update listino + create statement)
        const processResult = await processRekkiOrder(supabase, {
          fornitore,
          rekkiLines,
          message,
        })
        
        // Record in rekki_auto_orders
        const receivedAt = message.internalDate 
          ? new Date(parseInt(message.internalDate)).toISOString() 
          : new Date().toISOString()
        
        await supabase.from('rekki_auto_orders').insert([{
          fornitore_id: fornitore.id,
          sede_id: fornitore.sede_id,
          email_message_id: messageId,
          email_subject: message.subject,
          email_received_at: receivedAt,
          products_extracted: rekkiLines.length,
          products_updated: processResult.productsUpdated,
          products_created: processResult.productsCreated,
          statement_id: processResult.statementId,
          status: 'completed',
          metadata: {
            lines: rekkiLines,
            price_changes: processResult.priceChanges,
          },
        }])
        
        // Mark email as read and add label
        await gmailService.markAsRead(messageId)
        await gmailService.addLabel(messageId, 'Rekki/Processed')
        
        result.messagesProcessed++
        result.ordersCreated++
        result.details.push({
          messageId,
          fornitore: fornitore.nome,
          status: 'success',
        })
        
        console.log(`[REKKI-AUTO] ✅ Successfully processed order for ${fornitore.nome}`)
        
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        result.errors.push(`Error processing ${messageId}: ${errMsg}`)
        result.details.push({
          messageId,
          fornitore: '(error)',
          status: 'error',
          reason: errMsg,
        })
        console.error(`[REKKI-AUTO] Error processing ${messageId}:`, err)
      }
    }
    
    return NextResponse.json({
      ...result,
      message: `Processed ${result.messagesProcessed}/${result.messagesFound} emails`,
    })
    
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[REKKI-AUTO] Fatal error:', err)
    return NextResponse.json({
      error: errMsg,
      ...result,
    }, { status: 500 })
  }
}

/**
 * Process a Rekki order: update listino prices and create statement
 */
async function processRekkiOrder(
  supabase: SupabaseClient,
  opts: {
    fornitore: {
      id: string
      nome: string
      sede_id: string | null
      rekki_supplier_id: string | null
      rekki_link: string | null
    }
    rekkiLines: Array<{ prodotto: string; quantita: number; prezzo_unitario: number; importo_linea: number }>
    message: GmailMessage
  }
) {
  const { fornitore, rekkiLines, message } = opts
  const oggi = new Date().toISOString().split('T')[0]
  
  let productsUpdated = 0
  let productsCreated = 0
  const priceChanges: Array<{
    prodotto: string
    oldPrice: number | null
    newPrice: number
    action: 'updated' | 'created'
  }> = []
  
  // Get existing listino
  const { data: existingListino } = await supabase
    .from('listino_prezzi')
    .select('id, prodotto, prezzo, rekki_product_id')
    .eq('fornitore_id', fornitore.id)
  
  const listinoMap = new Map<string, { id: string; prezzo: number }>()
  existingListino?.forEach((entry: { id: string; prodotto: string; prezzo: number }) => {
    const normalized = entry.prodotto.toLowerCase().trim()
    listinoMap.set(normalized, { id: entry.id, prezzo: entry.prezzo })
  })
  
  // Update or create listino entries
  for (const line of rekkiLines) {
    const normalizedProdotto = line.prodotto.toLowerCase().trim()
    const existing = listinoMap.get(normalizedProdotto)
    
    if (existing) {
      // Update existing
      await supabase
        .from('listino_prezzi')
        .update({
          prezzo: line.prezzo_unitario,
          data_prezzo: oggi,
          note: `[AUTO] Aggiornato da conferma Rekki - Qty: ${line.quantita}`,
        })
        .eq('id', existing.id)
      
      productsUpdated++
      priceChanges.push({
        prodotto: line.prodotto,
        oldPrice: existing.prezzo,
        newPrice: line.prezzo_unitario,
        action: 'updated',
      })
    } else {
      // Create new
      await supabase
        .from('listino_prezzi')
        .insert([{
          fornitore_id: fornitore.id,
          sede_id: fornitore.sede_id,
          prodotto: line.prodotto,
          prezzo: line.prezzo_unitario,
          data_prezzo: oggi,
          note: `[AUTO] Creato da conferma Rekki - Qty: ${line.quantita}`,
        }])
      
      productsCreated++
      priceChanges.push({
        prodotto: line.prodotto,
        oldPrice: null,
        newPrice: line.prezzo_unitario,
        action: 'created',
      })
    }
  }
  
  // Create statement for triple-check
  const persistResult = await persistRekkiOrderStatement(supabase, {
    fornitoreId: fornitore.id,
    sedeId: fornitore.sede_id,
    rekkiLines,
    emailSubject: message.subject || `[AUTO] Ordine Rekki - ${fornitore.nome}`,
  })
  
  return {
    productsUpdated,
    productsCreated,
    priceChanges,
    statementId: 'statementId' in persistResult ? persistResult.statementId : null,
  }
}
