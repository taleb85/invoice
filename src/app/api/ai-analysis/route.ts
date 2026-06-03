import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { geminiGenerateVision, GeminiConfigurationError, GeminiTransientError } from '@/lib/gemini-vision'
import { inferContentTypeFromBuffer } from '@/lib/fix-ocr-dates-helpers'

type AnalysisEntityType = 'bolla' | 'fattura'

type AiSuggestion = {
  type: 'info' | 'anomaly' | 'convert-to-fattura' | 'not-invoice' | 'assign-supplier' | 'add-potential-supplier'
  label: string
  description: string
  /** Dati estratti dal documento per creazione fornitore potenziale */
  supplier_name?: string
  contact_email?: string
  contact_phone?: string
  product_types?: string[]
  document_type_label?: string
}

type AiAnalysisResult = {
  analysis: string
  suggestions: AiSuggestion[]
}

const SYSTEM_PROMPT = `You are a JSON-only API. Analyze Italian fiscal documents. Read the document image and cross-check against the database context.

Return EXACTLY this JSON structure (no markdown, no extra text). Every field must be present:

{
  "analysis": "Write a short analysis paragraph in the user's language here",
  "suggestions": [
    {
      "type": "info | anomaly | convert-to-fattura | not-invoice | assign-supplier | add-potential-supplier",
      "label": "Short title",
      "description": "Explanation in the user's language",
      "supplier_name": "Supplier company name extracted from document (or null)",
      "contact_email": "Supplier email extracted from document (or null)",
      "contact_phone": "Supplier phone extracted from document (or null)",
      "product_types": ["product category 1", "product category 2"],
      "document_type_label": "price list / catalog / brochure / technical sheet / invoice / delivery note"
    }
  ]
}

Rules for suggestions:
1. Identify document type. Invoice → "info". Delivery note with prices → "convert-to-fattura". Other (catalog, price list, brochure) → "not-invoice" AND "add-potential-supplier".
2. Read the supplier name from the document. Compare with DB. Mismatch → "anomaly". Match or missing → "assign-supplier".
3. Extract the date from the document. Look at the raw text. Write down day, month, year separately. Compare day, month, year values with the DB components. If any differ → "anomaly".
4. For invoices: read the total amount. Remove currency and trailing zeros. Compare with DB. Different → "anomaly".
5. For non-invoice documents (catalogs, price lists): ALWAYS add "add-potential-supplier" suggestion with supplier_name, contact_email, contact_phone, product_types array, and document_type_label extracted from the document. Fill ALL fields you can read from the document; use null for unknown fields.
6. The "add-potential-supplier" suggestion MUST include the supplier_name field with the actual company name read from the document.

Each suggestion type max once. Max 5 total.
Write in the user's language.
Return ONLY the JSON object. No markdown, no code fences, no extra text.`

const LOCALE_TO_LANG: Record<string, string> = {
  it: 'Italian',
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
}

async function analyzeEntityStreaming(
  service: ReturnType<typeof createServiceClient>,
  entityType: AnalysisEntityType,
  entityId: string,
  locale: string,
  sendProgress: (step: string, message: string) => void,
): Promise<AiAnalysisResult> {
  let fileUrl: string | null = null
  let entityContext = ''
  const preDetected: AiSuggestion[] = []

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  sendProgress('fetching', 'Caricamento dati documento…')

  if (entityType === 'bolla') {
    const { data, error } = await service
      .from('bolle')
      .select('id, numero_bolla, data, file_url, stato, fornitore_id, fornitori(nome)')
      .eq('id', entityId)
      .maybeSingle()

    if (error || !data) {
      throw new Error('Bolla non trovata')
    }

    fileUrl = data.file_url
    const forn = (data.fornitori as unknown as { nome: string } | null)
    const fornitoreName = forn?.nome ?? ''
    entityContext = [
      `Tipo: Bolla / DDT`,
      `Numero: ${data.numero_bolla ?? '—'}`,
      `Data DB: ${data.data ?? '—'} (Anno=${data.data ? data.data.slice(0,4) : '?'}, Mese=${data.data ? data.data.slice(5,7) : '?'}, Giorno=${data.data ? data.data.slice(8,10) : '?'})`,
      `Stato: ${data.stato ?? '—'}`,
      `Fornitore DB: ${fornitoreName || '—'}`,
    ].join('\n')

    if (data.data) {
      const dbDate = new Date(data.data + 'T00:00:00')
      if (dbDate > today) {
        preDetected.push({
          type: 'anomaly',
          label: 'Data DB nel futuro',
          description: `La data nel database (${data.data}) è nel futuro (oggi: ${todayStr}). Potrebbero essere stati invertiti giorno e mese.`,
        })
      }
    }
  } else {
    const { data, error } = await service
      .from('fatture')
      .select('id, numero_fattura, data, file_url, importo, fornitore_id, fornitori(nome)')
      .eq('id', entityId)
      .maybeSingle()

    if (error || !data) {
      throw new Error('Fattura non trovata')
    }

    fileUrl = data.file_url
    const forn = (data.fornitori as unknown as { nome: string } | null)
    const fornitoreName = forn?.nome ?? ''
    entityContext = [
      `Tipo: Fattura`,
      `Numero: ${data.numero_fattura ?? '—'}`,
      `Data DB: ${data.data ?? '—'} (Anno=${data.data ? data.data.slice(0,4) : '?'}, Mese=${data.data ? data.data.slice(5,7) : '?'}, Giorno=${data.data ? data.data.slice(8,10) : '?'})`,
      `Importo DB: ${data.importo != null ? Number(data.importo) : '—'}`,
      `Fornitore DB: ${fornitoreName || '—'}`,
    ].join('\n')

    if (data.data) {
      const dbDate = new Date(data.data + 'T00:00:00')
      if (dbDate > today) {
        preDetected.push({
          type: 'anomaly',
          label: 'Data DB nel futuro',
          description: `La data nel database (${data.data}) è nel futuro (oggi: ${todayStr}). Potrebbero essere stati invertiti giorno e mese.`,
        })
      }
    }
  }

  if (!fileUrl?.trim()) {
    throw new Error('Nessun allegato da analizzare')
  }

  sendProgress('downloading', 'Download allegato…')

  const dl = await downloadStorageObjectByFileUrl(service, fileUrl.trim())
  if ('error' in dl) {
    throw new Error(`Download fallito: ${dl.error}`)
  }

  const { data: fileBuffer, contentType } = dl

  let mime = (contentType ?? '').trim().toLowerCase()
  if (!mime || mime === 'application/octet-stream') {
    mime = inferContentTypeFromBuffer(fileBuffer) ?? 'application/pdf'
  }
  if (!mime.includes('pdf') && !mime.startsWith('image/')) {
    mime = 'application/pdf'
  }

  const base64 = fileBuffer.toString('base64')

  sendProgress('analyzing', 'Analisi con AI Gemini…')

  const lang = LOCALE_TO_LANG[locale] ?? 'English'
  const userPrompt = `Database context:\n${entityContext}\nOggi: ${todayStr}\n\nRespond in ${lang}.\n\nRead the document image. Extract the raw date text. Write down day, month, and year separately. Then compare each with the DB components above. If any component differs → "anomaly". Return JSON.`

  const { text } = await geminiGenerateVision(SYSTEM_PROMPT, mime, base64, userPrompt, 2000)

  sendProgress('parsing', 'Interpretazione risultati…')

  let result: AiAnalysisResult
  try {
    let cleaned = text.trim()

    if (cleaned.startsWith('```')) {
      const firstNl = cleaned.indexOf('\n')
      if (firstNl !== -1) cleaned = cleaned.slice(firstNl + 1)
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
      cleaned = cleaned.trim()
    }

    const braceStart = cleaned.indexOf('{')
    const braceEnd = cleaned.lastIndexOf('}')
    if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
      cleaned = cleaned.slice(braceStart, braceEnd + 1)
    }

    const parsed: Record<string, unknown> = JSON.parse(cleaned)
    if (!parsed.analysis || !Array.isArray(parsed.suggestions)) {
      const fallbackAnalysis: string[] = []
      const fallbackSuggestions: AiSuggestion[] = []
      const docType = parsed.document_type as string | undefined
      if (docType) {
        const typeMap: Record<string, AiSuggestion['type']> = {
          info: 'info',
          'convert-to-fattura': 'convert-to-fattura',
          'not-invoice': 'not-invoice',
        }
        const st = typeMap[docType] ?? 'info'
        fallbackSuggestions.push({ type: st, label: 'Tipo documento', description: `Rilevato come: ${docType}` })
      }
      const supplierName = parsed.supplier_name as string | undefined
      if (supplierName) {
        fallbackSuggestions.push({ type: 'assign-supplier', label: 'Fornitore', description: `Fornitore rilevato: ${supplierName}` })
      }
      const docTypeLabel = parsed.document_type_label as string | undefined
      const isNonInvoice = docType === 'not-invoice' || (docTypeLabel && !docTypeLabel.includes('invoice') && !docTypeLabel.includes('fattura'))
      if (supplierName && isNonInvoice) {
        fallbackSuggestions.push({
          type: 'add-potential-supplier',
          label: 'Aggiungi come fornitore potenziale',
          description: `Registra "${supplierName}" come fornitore potenziale per valutazione.`,
          supplier_name: supplierName,
          document_type_label: docTypeLabel ?? docType,
          product_types: Array.isArray(parsed.product_types) ? parsed.product_types as string[] : [],
          contact_email: (parsed.contact_email as string) ?? undefined,
          contact_phone: (parsed.contact_phone as string) ?? undefined,
        })
      }
      const dateField = parsed.date as Record<string, unknown> | undefined
      if (dateField) {
        const dateStr = `${String(dateField.day ?? '?')}/${String(dateField.month ?? '?')}/${String(dateField.year ?? '?')}`
        fallbackAnalysis.push(`Data documento: ${dateStr}`)
      }
      const totalAmount = parsed.total_amount as string | undefined
      if (totalAmount) {
        fallbackSuggestions.push({ type: 'anomaly', label: 'Importo', description: `Anomalia importo: ${totalAmount}` })
      }
      result = {
        analysis: fallbackAnalysis.length > 0 ? fallbackAnalysis.join('. ') : `Analisi disponibile. ${JSON.stringify(parsed).substring(0, 200)}`,
        suggestions: fallbackSuggestions,
      }
    } else {
      result = parsed as unknown as AiAnalysisResult
    }
  } catch (parseErr) {
    const fallbackText = text.trim()
    const firstBrace = fallbackText.indexOf('{')
    const lastBrace = fallbackText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = fallbackText.slice(firstBrace, lastBrace + 1)
      try {
        const fallback = JSON.parse(extracted)
        const fallbackSuggestions: AiSuggestion[] = []
        if (fallback.document_type) {
          fallbackSuggestions.push({ type: fallback.document_type === 'convert-to-fattura' ? 'convert-to-fattura' : 'info', label: 'Tipo documento', description: `Rilevato come: ${fallback.document_type}` })
        }
        if (fallback.supplier_name) {
          fallbackSuggestions.push({ type: 'assign-supplier', label: 'Fornitore', description: `Fornitore rilevato: ${fallback.supplier_name}` })
          if (fallback.document_type === 'not-invoice' || (fallback.document_type_label && !String(fallback.document_type_label).includes('invoice'))) {
            fallbackSuggestions.push({
              type: 'add-potential-supplier',
              label: 'Aggiungi come fornitore potenziale',
              description: `Registra "${fallback.supplier_name}" come fornitore potenziale.`,
              supplier_name: String(fallback.supplier_name),
              document_type_label: String(fallback.document_type_label ?? fallback.document_type ?? ''),
              product_types: Array.isArray(fallback.product_types) ? fallback.product_types as string[] : [],
              contact_email: fallback.contact_email as string | undefined,
              contact_phone: fallback.contact_phone as string | undefined,
            })
          }
        }
        result = { analysis: `Analisi completata.`, suggestions: fallbackSuggestions }
      } catch {
        result = {
          analysis: `Risposta JSON non valida o troncata. Contenuto grezzo: ${extracted.substring(0, 300)}…`,
          suggestions: [],
        }
      }
    } else {
      result = {
        analysis: `Errore: l'AI non ha prodotto un'analisi valida. (${String(parseErr).substring(0, 100)})`,
        suggestions: [],
      }
    }
  }

  if (preDetected.length > 0) {
    const existingTypes = new Set(result.suggestions.map(s => s.type))
    for (const anomaly of preDetected) {
      if (!existingTypes.has('anomaly')) {
        result.suggestions.push(anomaly)
        existingTypes.add('anomaly')
      }
    }
  }

  // Rimuovi "add-potential-supplier" se il fornitore è già registrato
  const potentialIdx = result.suggestions.findIndex(s => s.type === 'add-potential-supplier')
  if (potentialIdx !== -1) {
    const sugg = result.suggestions[potentialIdx]
    const supplierName = sugg.supplier_name?.trim()
    if (supplierName) {
      const { data: existing } = await service
        .from('comunicazioni_fornitori_potenziali')
        .select('id')
        .ilike('nome_azienda', supplierName)
        .limit(1)
        .maybeSingle()
      if (existing) {
        result.suggestions.splice(potentialIdx, 1)
      }
    }
  }

  return result
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getRequestAuth()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const service = createServiceClient()

    let body: { entityType?: AnalysisEntityType; entityId?: string; locale?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
    }

    const { entityType, entityId, locale } = body
    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType e entityId richiesti' }, { status: 400 })
    }

    if (entityType !== 'bolla' && entityType !== 'fattura') {
      return NextResponse.json({ error: 'entityType deve essere "bolla" o "fattura"' }, { status: 400 })
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const write = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        }

        try {
          const result = await analyzeEntityStreaming(service, entityType, entityId, locale ?? 'it', (step, message) => {
            write({ type: 'progress', step, message })
          })

          write({ type: 'result', data: result })
        } catch (err) {
          if (err instanceof GeminiConfigurationError) {
            write({ type: 'error', error: err.message })
          } else if (err instanceof GeminiTransientError) {
            write({ type: 'error', error: err.message })
          } else {
            const message = err instanceof Error ? err.message : 'Errore sconosciuto'
            write({ type: 'error', error: message })
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    if (err instanceof GeminiConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    if (err instanceof GeminiTransientError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
