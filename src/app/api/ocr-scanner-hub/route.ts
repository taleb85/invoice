import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'
import { ocrInvoice, OcrInvoiceConfigurationError } from '@/lib/ocr-invoice'
import { geminiGenerateText, GEMINI_MODEL, type GeminiUsage } from '@/lib/gemini-vision'
import { logActivity } from '@/lib/activity-logger'

export type ScannerDocumentKind = 'ddt' | 'fattura' | 'supplier_card' | 'unknown'

export type ScannerIntent = 'auto' | 'bolla' | 'fattura' | 'nuovo_fornitore'

type HubJson = {
  document_kind: ScannerDocumentKind
  nome: string | null
  piva: string | null
  indirizzo: string | null
  data: string | null
  numero_documento: string | null
  importo: number | null
}

function parseJsonContent(content: string): Record<string, unknown> {
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned) as Record<string, unknown>
}

function mapKind(v: unknown): ScannerDocumentKind {
  const s = String(v ?? '').toLowerCase()
  if (s === 'ddt' || s === 'bolla' || s === 'delivery') return 'ddt'
  if (s === 'fattura' || s === 'invoice') return 'fattura'
  if (s === 'supplier_card' || s === 'anagrafica' || s === 'supplier') return 'supplier_card'
  return 'unknown'
}

async function classifyFromInvoiceText(textSnippet: string): Promise<ScannerDocumentKind> {
  const system = `You are a document classifier. Given extracted text from a business PDF, respond with ONE word: ddt, fattura, supplier_card, or unknown.
- ddt = delivery note / bolla / DDT / transport document
- fattura = tax invoice or credit note
- supplier_card = presentation/letter without full fiscal invoice content
- unknown = cannot determine

Return ONLY valid JSON: {"document_kind":"ddt"|"fattura"|"supplier_card"|"unknown"}`
  try {
    const res = await geminiGenerateText(system, textSnippet.slice(0, 6000), 80)
    const parsed = parseJsonContent(res.text)
    return mapKind(parsed.document_kind)
  } catch {
    return 'unknown'
  }
}

function invoiceToHub(kind: ScannerDocumentKind, inv: Awaited<ReturnType<typeof ocrInvoice>>): HubJson {
  return {
    document_kind: kind,
    nome: inv.nome,
    piva: inv.piva,
    indirizzo: inv.indirizzo ?? null,
    data: inv.data,
    numero_documento: inv.numero_fattura,
    importo: inv.totale_iva_inclusa,
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY non configurata.' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const [{ data: { user } }, profile, cookieStore] = await Promise.all([
      supabase.auth.getUser(),
      getProfile(),
      await cookies(),
    ])

    // Resolve the sede the scan belongs to (for usage tracking)
    let logSedeId: string | null = profile?.sede_id ?? null
    if (profile?.role === 'admin' && !logSedeId) {
      logSedeId = cookieStore.get('admin-sede-id')?.value?.trim() || null
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const intentRaw = (formData.get('intent') as string | null) ?? 'auto'
    const intent = (
      ['auto', 'bolla', 'fattura', 'nuovo_fornitore'].includes(intentRaw) ? intentRaw : 'auto'
    ) as ScannerIntent

    if (!file) {
      return NextResponse.json({ error: 'Nessun file ricevuto.' }, { status: 400 })
    }

    const allowedMime = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
    if (!allowedMime.includes(file.type as (typeof allowedMime)[number])) {
      return NextResponse.json(
        { error: 'Formato non supportato. Usa PDF oppure foto JPEG, PNG o WebP.' },
        { status: 400 },
      )
    }

    const buffer = await file.arrayBuffer()
    const buf = new Uint8Array(buffer)

    let capturedUsage: GeminiUsage | null = null
    const onUsage = (u: GeminiUsage) => {
      capturedUsage = u
    }

    const fireLogUsage = (kind: ScannerDocumentKind) => {
      if (!user || !capturedUsage) return
      const service = createServiceClient()
      logActivity(service, {
        userId: user.id,
        sedeId: logSedeId,
        action: 'gemini.ocr',
        entityType: 'document',
        entityLabel: `${file.type} → ${kind}`,
        metadata: {
          inputTokens: capturedUsage.inputTokens,
          outputTokens: capturedUsage.outputTokens,
          totalTokens: capturedUsage.totalTokens,
          estimatedCostUsd: capturedUsage.estimatedCostUsd,
          model: GEMINI_MODEL,
          operation: 'scanner_hub',
          intent,
          sedeId: logSedeId,
        },
      }).catch(() => {})
    }

    if (intent === 'nuovo_fornitore') {
      const inv = await ocrInvoice(buf, file.type, undefined, { onUsage })
      fireLogUsage('supplier_card')
      return NextResponse.json({ intent, ...invoiceToHub('supplier_card', inv) })
    }

    if (intent === 'fattura') {
      const inv = await ocrInvoice(buf, file.type, undefined, { onUsage })
      fireLogUsage('fattura')
      return NextResponse.json({ intent, ...invoiceToHub('fattura', inv) })
    }

    if (intent === 'bolla') {
      const inv = await ocrInvoice(buf, file.type, undefined, { onUsage })
      fireLogUsage('ddt')
      return NextResponse.json({ intent, ...invoiceToHub('ddt', inv) })
    }

    // intent === 'auto'
    const inv = await ocrInvoice(buf, file.type, undefined, { onUsage })
    let textForKind = ''
    if (file.type === 'application/pdf') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = (await import('pdf-parse')) as any
        const pdfParse = mod.default ?? mod
        const pdfBuf = Buffer.from(buffer)
        const result = await pdfParse(pdfBuf)
        textForKind = (result.text ?? '').trim()
      } catch {
        textForKind = [inv.nome, inv.numero_fattura, inv.piva].filter(Boolean).join(' ')
      }
    } else {
      textForKind = [inv.nome, inv.numero_fattura, inv.piva].filter(Boolean).join(' ')
    }
    const kind =
      textForKind.length > 40 ? await classifyFromInvoiceText(textForKind) : 'unknown'
    const resolvedKind: ScannerDocumentKind =
      kind === 'unknown' && (inv.numero_fattura || inv.totale_iva_inclusa != null)
        ? 'fattura'
        : kind === 'unknown'
          ? 'fattura'
          : kind

    fireLogUsage(resolvedKind)
    return NextResponse.json({ intent, ...invoiceToHub(resolvedKind, inv) })
  } catch (err: unknown) {
    if (err instanceof OcrInvoiceConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
