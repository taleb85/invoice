import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { findUniqueFornitoreForPendingDoc } from '@/lib/auto-resolve-pending-doc'
import type { QuickScanResult } from '@/components/quick-scan/quick-scan-modal'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData non valido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const sedeId = (formData.get('sede_id') as string | null) || null

  if (!file) {
    return NextResponse.json({ error: 'Nessun file ricevuto' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo file non supportato: ${file.type}` },
      { status: 400 },
    )
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer())
    const ocr = await ocrInvoice(buffer, file.type)

    // Map OCR tipo_documento to QuickScan tipo
    let tipo: QuickScanResult['tipo'] = 'unknown'
    if (ocr.tipo_documento === 'fattura') tipo = 'fattura'
    else if (ocr.tipo_documento === 'bolla') tipo = 'bolla'

    // Try to match fornitore from the anagrafica
    let fornitoreId: string | null = null
    let fornitoreNome: string | null = ocr.ragione_sociale ?? null

    if (sedeId) {
      const match = await findUniqueFornitoreForPendingDoc(supabase, {
        docSedeId: sedeId,
        metadata: {
          ragione_sociale: ocr.ragione_sociale,
          p_iva: ocr.p_iva,
          indirizzo: ocr.indirizzo,
        },
        mittente: null,
      })
      if (match) {
        fornitoreId = match.id
        fornitoreNome = match.nome
      }
    }

    const result: QuickScanResult = {
      tipo,
      fornitore: fornitoreNome,
      importo: ocr.totale_iva_inclusa ?? null,
      data: ocr.data_fattura ?? null,
      numero: ocr.numero_fattura ?? null,
      fornitore_id: fornitoreId,
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: `Errore OCR: ${msg}` }, { status: 500 })
  }
}
