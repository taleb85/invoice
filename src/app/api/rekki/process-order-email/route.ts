import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { parseRekkiFromEmailParts, type RekkiLine } from '@/lib/rekki-parser'
import { persistRekkiOrderStatement } from '@/lib/rekki-statement'

interface ProcessResult {
  success: boolean
  productsExtracted: number
  productsUpdated: number
  productsCreated: number
  statementId?: string
  error?: string
  lines: Array<{
    prodotto: string
    quantita: number
    prezzo_unitario: number
    importo_linea: number
    action: 'updated' | 'created' | 'skipped'
    listinoId?: string
    previousPrice?: number
  }>
}

/**
 * POST /api/rekki/process-order-email
 * 
 * Processa un'email di conferma ordine Rekki:
 * 1. Estrae prodotti, quantità e prezzi dal testo email
 * 2. Aggiorna automaticamente listino_prezzi con i prezzi Rekki
 * 3. Crea statement per triple-check con fatture
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  
  const {
    fornitore_id,
    email_subject,
    email_body,
    email_html,
    file_url,
    data_ordine,
  } = await req.json() as {
    fornitore_id: string
    email_subject?: string
    email_body?: string
    email_html?: string
    file_url?: string
    data_ordine?: string
  }
  
  if (!fornitore_id) {
    return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
  }
  
  if (!email_body && !email_html) {
    return NextResponse.json({ error: 'email_body o email_html richiesto' }, { status: 400 })
  }
  
  const service = createServiceClient()
  
  // Verify fornitore exists
  const { data: fornitore, error: fornErr } = await service
    .from('fornitori')
    .select('id, nome, sede_id, rekki_supplier_id, rekki_link')
    .eq('id', fornitore_id)
    .single()
  
  if (fornErr || !fornitore) {
    return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
  }
  
  // Check if fornitore is Rekki-linked
  const isRekkiLinked = Boolean(
    fornitore.rekki_supplier_id?.trim() || fornitore.rekki_link?.trim()
  )
  
  if (!isRekkiLinked) {
    return NextResponse.json(
      { error: 'Questo fornitore non è collegato a Rekki. Configura rekki_supplier_id o rekki_link.' },
      { status: 400 }
    )
  }
  
  // 1. Parse Rekki lines from email
  const rekkiLines = parseRekkiFromEmailParts({
    subject: email_subject,
    html: email_html,
    text: email_body,
  })
  
  if (rekkiLines.length === 0) {
    return NextResponse.json({
      error: 'Nessun prodotto estratto dall\'email. Verifica che l\'email contenga una tabella ordini Rekki.'
    }, { status: 400 })
  }
  
  // 2. Update/create listino_prezzi entries
  const oggi = data_ordine || new Date().toISOString().split('T')[0]
  const result: ProcessResult = {
    success: false,
    productsExtracted: rekkiLines.length,
    productsUpdated: 0,
    productsCreated: 0,
    lines: [],
  }
  
  // Get existing listino for fuzzy matching
  const { data: existingListino } = await service
    .from('listino_prezzi')
    .select('id, prodotto, prezzo, rekki_product_id')
    .eq('fornitore_id', fornitore_id)
  
  const listinoMap = new Map<string, { id: string; prezzo: number; rekki_id: string | null }>()
  existingListino?.forEach(entry => {
    // Normalize for fuzzy matching
    const normalized = entry.prodotto.toLowerCase().trim()
    listinoMap.set(normalized, {
      id: entry.id,
      prezzo: entry.prezzo,
      rekki_id: entry.rekki_product_id,
    })
  })
  
  for (const line of rekkiLines) {
    const normalizedProdotto = line.prodotto.toLowerCase().trim()
    const existing = listinoMap.get(normalizedProdotto)
    
    if (existing) {
      // Update existing entry
      const { error: updateErr } = await service
        .from('listino_prezzi')
        .update({
          prezzo: line.prezzo_unitario,
          data_prezzo: oggi,
          note: `Aggiornato da ordine Rekki - Qty: ${line.quantita}`,
        })
        .eq('id', existing.id)
      
      if (!updateErr) {
        result.productsUpdated++
        result.lines.push({
          ...line,
          action: 'updated',
          listinoId: existing.id,
          previousPrice: existing.prezzo,
        })
      } else {
        result.lines.push({
          ...line,
          action: 'skipped',
        })
      }
    } else {
      // Create new entry
      const { data: newEntry, error: createErr } = await service
        .from('listino_prezzi')
        .insert([{
          fornitore_id,
          sede_id: fornitore.sede_id,
          prodotto: line.prodotto,
          prezzo: line.prezzo_unitario,
          data_prezzo: oggi,
          note: `Creato da ordine Rekki - Qty: ${line.quantita}`,
          rekki_product_id: null, // Will be mapped manually later
        }])
        .select('id')
        .single()
      
      if (!createErr && newEntry) {
        result.productsCreated++
        result.lines.push({
          ...line,
          action: 'created',
          listinoId: newEntry.id,
        })
      } else {
        result.lines.push({
          ...line,
          action: 'skipped',
        })
      }
    }
  }
  
  // 3. Persist as statement for triple-check
  try {
    const persistResult = await persistRekkiOrderStatement(service, {
      fornitoreId: fornitore_id,
      sedeId: fornitore.sede_id,
      rekkiLines,
      emailSubject: email_subject || `Ordine Rekki - ${fornitore.nome}`,
      fileUrl: file_url || null,
    })
    
    if ('statementId' in persistResult) {
      result.statementId = persistResult.statementId
      result.success = true
    } else {
      result.error = persistResult.error
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Errore durante la creazione dello statement'
  }
  
  return NextResponse.json({ result })
}
