import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

interface ImportedRow {
  'Product ID'?: string
  'Product Name'?: string
  'Price'?: string
  [key: string]: string | undefined
}

interface ParsedProduct {
  rekki_product_id: string
  prodotto: string
  prezzo: number
}

interface ImportResult {
  updated: number
  created: number
  anomalies: Array<{
    prodotto: string
    rekki_product_id: string
    old_price: number
    new_price: number
    delta_pct: number
  }>
  errors: Array<{ row: number; error: string }>
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const profile = await getProfile()
    if (!profile) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    // Get form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const fornitoreId = formData.get('fornitore_id') as string | null
    const dataPrezzo = formData.get('data_prezzo') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File mancante' }, { status: 400 })
    }

    if (!fornitoreId) {
      return NextResponse.json({ error: 'fornitore_id mancante' }, { status: 400 })
    }

    if (!dataPrezzo) {
      return NextResponse.json({ error: 'data_prezzo mancante' }, { status: 400 })
    }

    // Check permissions
    const service = createServiceClient()
    const { data: fornitore, error: fornErr } = await service
      .from('fornitori')
      .select('sede_id')
      .eq('id', fornitoreId)
      .single()

    if (fornErr || !fornitore) {
      return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })
    }

    // Check user permission
    if (!isMasterAdminRole(profile.role)) {
      if (!profile.sede_id || profile.sede_id !== fornitore.sede_id) {
        return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
      }
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    let rows: ImportedRow[] = []
    
    // Parse based on file type
    if (file.name.endsWith('.csv') || file.type === 'text/csv') {
      // Parse CSV
      const text = buffer.toString('utf-8')
      const parseResult = Papa.parse<ImportedRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      })

      if (parseResult.errors.length > 0) {
        return NextResponse.json(
          { error: 'Errore parsing CSV', details: parseResult.errors },
          { status: 400 }
        )
      }
      
      rows = parseResult.data
    } else if (file.name.match(/\.(xlsx|xls)$/i)) {
      // Parse Excel
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          return NextResponse.json({ error: 'File Excel vuoto' }, { status: 400 })
        }
        
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<ImportedRow>(worksheet, {
          raw: false,
          defval: '',
        })
        
        rows = jsonData
      } catch (xlsxError) {
        return NextResponse.json(
          { error: `Errore parsing Excel: ${xlsxError instanceof Error ? xlsxError.message : 'Errore sconosciuto'}` },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Formato file non supportato. Usa CSV o Excel (.xlsx, .xls)' },
        { status: 400 }
      )
    }

    // Extract and validate products
    const products: ParsedProduct[] = []
    const errors: Array<{ row: number; error: string }> = []

    rows.forEach((row, index) => {
      const productId = row['Product ID']?.trim() || row['product_id']?.trim() || row['ProductID']?.trim()
      const productName = row['Product Name']?.trim() || row['product_name']?.trim() || row['ProductName']?.trim() || row['prodotto']?.trim()
      const priceStr = row['Price']?.trim() || row['price']?.trim() || row['prezzo']?.trim()

      if (!productId || !productName || !priceStr) {
        errors.push({ 
          row: index + 2, // +2 because: +1 for header, +1 for 0-index
          error: `Riga incompleta: ProductID="${productId || 'N/A'}", ProductName="${productName || 'N/A'}", Price="${priceStr || 'N/A'}"`
        })
        return
      }

      // Parse price
      const price = parseFloat(priceStr.replace(/[^0-9.,-]/g, '').replace(',', '.'))
      if (isNaN(price) || price <= 0) {
        errors.push({ row: index + 2, error: `Prezzo non valido: "${priceStr}"` })
        return
      }

      products.push({
        rekki_product_id: productId,
        prodotto: productName,
        prezzo: price,
      })
    })

    if (products.length === 0) {
      return NextResponse.json(
        { 
          error: 'Nessun prodotto valido trovato nel file',
          errors,
          hint: 'Il file deve contenere le colonne: "Product ID", "Product Name", "Price"'
        },
        { status: 400 }
      )
    }

    // Get existing products for this supplier
    const { data: existingProducts } = await service
      .from('listino_prezzi')
      .select('id, rekki_product_id, prodotto, prezzo, data_prezzo')
      .eq('fornitore_id', fornitoreId)
      .not('rekki_product_id', 'is', null)

    const existingMap = new Map<string, { id: string; prezzo: number; prodotto: string }>()
    existingProducts?.forEach((p) => {
      if (p.rekki_product_id) {
        existingMap.set(p.rekki_product_id, {
          id: p.id,
          prezzo: p.prezzo,
          prodotto: p.prodotto,
        })
      }
    })

    // Process products: update existing or create new
    const result: ImportResult = {
      updated: 0,
      created: 0,
      anomalies: [],
      errors,
    }

    const toUpdate: Array<{ id: string; prezzo: number; prodotto: string }> = []
    const toCreate: Array<{
      fornitore_id: string
      sede_id: string | null
      prodotto: string
      prezzo: number
      data_prezzo: string
      rekki_product_id: string
      note: string | null
    }> = []

    for (const product of products) {
      const existing = existingMap.get(product.rekki_product_id)

      if (existing) {
        // Update existing
        toUpdate.push({
          id: existing.id,
          prezzo: product.prezzo,
          prodotto: product.prodotto, // Update name too
        })

        // Check for anomaly (price increase > 5%)
        const delta = ((product.prezzo - existing.prezzo) / existing.prezzo) * 100
        if (delta > 5) {
          result.anomalies.push({
            prodotto: product.prodotto,
            rekki_product_id: product.rekki_product_id,
            old_price: existing.prezzo,
            new_price: product.prezzo,
            delta_pct: delta,
          })
        }
      } else {
        // Create new
        toCreate.push({
          fornitore_id: fornitoreId,
          sede_id: fornitore.sede_id,
          prodotto: product.prodotto,
          prezzo: product.prezzo,
          data_prezzo: dataPrezzo,
          rekki_product_id: product.rekki_product_id,
          note: 'Importato da listino Rekki',
        })
      }
    }

    // Single upsert replaces U sequential UPDATE calls (N+1 pattern).
    // Upsert on `id` merges updates + inserts into two round-trips max.
    if (toUpdate.length > 0) {
      const { error: updErr } = await service
        .from('listino_prezzi')
        .upsert(
          toUpdate.map((item) => ({
            id:          item.id,
            prezzo:      item.prezzo,
            prodotto:    item.prodotto,
            data_prezzo: dataPrezzo,
          })),
          { onConflict: 'id' },
        )

      if (updErr) {
        errors.push({ row: -1, error: `Errore aggiornamento: ${updErr.message}` })
      } else {
        result.updated = toUpdate.length
      }
    }

    // Execute inserts (already a single bulk insert — unchanged)
    if (toCreate.length > 0) {
      const { error: insErr } = await service
        .from('listino_prezzi')
        .insert(toCreate)

      if (insErr) {
        errors.push({ row: -1, error: `Errore creazione: ${insErr.message}` })
      } else {
        result.created = toCreate.length
      }
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('[importa-da-rekki] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore interno' },
      { status: 500 }
    )
  }
}
