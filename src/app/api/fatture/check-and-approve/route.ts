import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { geminiGenerateVision, GeminiConfigurationError, GeminiTransientError } from '@/lib/gemini-vision'
import { inferContentTypeFromBuffer } from '@/lib/fix-ocr-dates-helpers'
import { recordAiUsage } from '@/lib/ai-usage-log'

const CHECK_PROMPT = `Rispondi solo con un JSON in questa forma esatta senza nessun altro testo:
{"esito":"ok","motivazione":""}

Regola: se vedi un importo, un nome fornitore e una data, rispondi sempre {"esito":"ok","motivazione":""}.
Ignora completamente differenze tra pagine, ripartizioni IVA, coerenza tra pagine, formattazione.
Rispondi "ko" SOLO se manca completamente uno tra: importo, fornitore, data, o se non è una fattura.`

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isSedePrivilegedRole(profile?.role)
  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato — solo admin' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { fattura_id?: string }
  const { fattura_id } = body
  if (!fattura_id) {
    return NextResponse.json({ error: 'fattura_id obbligatorio' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch fattura
  const { data: fattura, error: fetchErr } = await service
    .from('fatture')
    .select('id, sede_id, fornitore_id, importo, file_url, data, numero_fattura, approval_status, fornitori(nome)')
    .eq('id', fattura_id)
    .single()

  if (fetchErr || !fattura) {
    return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  }

  // Admin sede can only check their own
  if (isAdminSede && !isMaster && profile?.sede_id !== (fattura as { sede_id?: string }).sede_id) {
    return NextResponse.json({ error: 'Accesso negato a questa fattura' }, { status: 403 })
  }

  // Already approved/rejected
  const approvalStatus = (fattura as { approval_status?: string }).approval_status
  if (approvalStatus && approvalStatus !== 'pending') {
    return NextResponse.json({
      error: `Fattura già ${approvalStatus === 'approved' ? 'approvata' : 'rifiutata'}`,
    }, { status: 409 })
  }

  // Download file
  const fileUrl = (fattura as { file_url?: string | null }).file_url
  if (!fileUrl?.trim()) {
    return NextResponse.json({
      esito: 'ko' as const,
      motivazione: 'Nessun file allegato alla fattura — impossibile verificare',
    })
  }

  const dl = await downloadStorageObjectByFileUrl(service, fileUrl.trim())
  if ('error' in dl) {
    return NextResponse.json({
      esito: 'ko' as const,
      motivazione: `Impossibile scaricare il file: ${dl.error}`,
    })
  }

  const contentType = dl.contentType || inferContentTypeFromBuffer(dl.data) || 'application/pdf'
  const base64Data = dl.data.toString('base64')

  // Ask Gemini to check the invoice
  let checkResult: { esito: string; motivazione: string }
  let usage

  try {
    const res = await geminiGenerateVision(CHECK_PROMPT, contentType, base64Data,
      'Analizza questa fattura e restituisci il JSON di verifica.', 100)
    usage = res.usage
    const cleaned = res.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    checkResult = {
      esito: parsed.esito === 'ok' ? 'ok' : 'ko',
      motivazione: typeof parsed.motivazione === 'string' ? parsed.motivazione : '',
    }
  } catch (err) {
    if (err instanceof GeminiConfigurationError) {
      return NextResponse.json({ error: 'AI non configurata (GEMINI_API_KEY mancante)' }, { status: 503 })
    }
    if (err instanceof GeminiTransientError) {
      return NextResponse.json({ error: `Errore temporaneo AI: ${err.message}` }, { status: 503 })
    }
    return NextResponse.json({
      esito: 'ko',
      motivazione: `Errore durante l'analisi AI: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  // Record AI usage (fire-and-forget)
  if (usage) {
    recordAiUsage(service, {
      sede_id: profile?.sede_id ?? (fattura as { sede_id?: string }).sede_id ?? null,
      documento_id: fattura_id,
      tipo: 'check-and-approve',
      usage,
    }).catch(() => {})
  }

  // If check failed, return the result without approving
  if (checkResult.esito !== 'ok') {
    return NextResponse.json({
      esito: 'ko',
      motivazione: checkResult.motivazione || 'La fattura non ha superato il controllo automatico',
      approvata: false,
    })
  }

  // Auto-approve
  const now = new Date().toISOString()
  const updatePayload = {
    approval_status: 'approved',
    approved_by: user.id,
    approved_at: now,
    rejection_reason: null,
  }

  const { error: updateErr } = await service
    .from('fatture')
    .update(updatePayload)
    .eq('id', fattura_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Fire-and-forget: log activity
  const fFornitore = (fattura as { fornitore_id?: string | null }).fornitore_id
  logActivity(service, {
    userId: user.id,
    sedeId: profile?.sede_id ?? (fattura as { sede_id?: string }).sede_id ?? null,
    action: 'fattura.approved',
    entityType: 'fattura',
    entityId: fattura_id,
    entityLabel: (fattura as { fornitori?: { nome?: string | null } | null }).fornitori?.nome ?? undefined,
    metadata: {
      ...(fFornitore ? { fornitore_id: fFornitore } : {}),
      auto_approved: true,
    },
  }).catch(() => {})

  // Fire-and-forget push notification
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000'
  const sedeId = (fattura as { sede_id?: string }).sede_id
  const fornitoreNome = (fattura as { fornitori?: { nome?: string | null } | null }).fornitori?.nome ?? 'Fornitore'
  fetch(`${baseUrl}/api/push/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
    },
    body: JSON.stringify({
      title: 'Fattura approvata automaticamente',
      body: `La fattura di ${fornitoreNome} è stata verificata e approvata dall'AI`,
      url: `/fatture/${fattura_id}`,
      ...(sedeId ? { sede_id: sedeId } : {}),
    }),
  }).catch(() => {})

  return NextResponse.json({
    esito: 'ok',
    motivazione: '',
    approvata: true,
  })
}
