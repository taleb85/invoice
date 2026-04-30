import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import type { Locale } from '@/lib/translations'
import { DOCUMENTI_PENDING_FILTER_STATES } from '@/lib/documenti-queue-stato'
import {
  buildSollecitoBollaEmail,
  buildSollecitoPromessaDocumentoEmail,
} from '@/lib/mail-sollecito-bolla'
import {
  fetchSollecitiReminderSettings,
  isBollaOverdue,
  isPromisedDocOverdue,
  parseAutoSollecitiEnabled,
  parseDateOnlyOrIso,
  SOLLECITI_CONFIG_CHIAVI,
  wholeDaysSinceUtc,
} from '@/lib/sollecito-aging'
import { createServiceClient } from '@/utils/supabase/server'

export const maxDuration = 300

const SUPPORTED_LOCALES: Locale[] = ['it', 'en', 'es', 'fr', 'de']

type FornitoreLite = { nome: string; email: string | null; language: string | null }

function unwrapFornitore(raw: unknown): FornitoreLite | null {
  const x = Array.isArray(raw) ? raw[0] : raw
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  return {
    nome: String(o.nome ?? 'Supplier'),
    email: typeof o.email === 'string' ? o.email : null,
    language: typeof o.language === 'string' ? o.language : null,
  }
}

function supplierLang(f: FornitoreLite | null): Locale {
  const l = f?.language
  return SUPPORTED_LOCALES.includes(l as Locale) ? (l as Locale) : 'en'
}

function cronLogOggetto(tipo: 'bolla' | 'promessa_doc', docId: string, subject: string): string {
  return `[CRON-SOLLECITO] tipo=${tipo} doc_id=${docId}| ${subject}`
}

async function wasCronSollecitoRecent(
  supabase: ReturnType<typeof createServiceClient>,
  tipo: 'bolla' | 'promessa_doc',
  docId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const prefix = `[CRON-SOLLECITO] tipo=${tipo} doc_id=${docId}|`
  const { data, error } = await supabase
    .from('log_sincronizzazione')
    .select('id')
    .eq('stato', 'successo')
    .gte('data', since)
    .ilike('oggetto_mail', `${prefix}%`)
    .limit(1)

  if (error) {
    console.warn('[CRON process-solleciti] dedup log_sincronizzazione:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

function parseEmailFromMittente(mittente: string | null | undefined): string | null {
  if (!mittente || typeof mittente !== 'string') return null
  const t = mittente.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return t
  const angle = t.match(/<([^>\s@]+@[^>\s]+)>/)
  return angle?.[1]?.trim() ?? null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Giorni decimali dall’anchor (es. 4.2) per log cron; allineato al conteggio calendario UTC intero dove utile. */
function giorniTrascorsiDecimali(anchor: Date | null, ref: Date): string {
  if (!anchor || Number.isNaN(anchor.getTime())) return 'n/d'
  const raw = (ref.getTime() - anchor.getTime()) / DAY_MS
  const rounded = Math.round(raw * 10) / 10
  return Number.isFinite(rounded) ? String(rounded) : 'n/d'
}

/**
 * GET /api/cron/process-solleciti
 * Solleciti automatici (bolle in attesa + coda documenti con promessa allegato).
 * Header: Authorization: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey?.trim()) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const supabase = createServiceClient()

  const { data: autoRow, error: autoErr } = await supabase
    .from('configurazioni_app')
    .select('valore')
    .eq('chiave', SOLLECITI_CONFIG_CHIAVI.autoEnabled)
    .maybeSingle()

  let autoSollecitiEnabled = true
  if (!autoErr && autoRow?.valore != null && String(autoRow.valore).trim() !== '') {
    autoSollecitiEnabled = parseAutoSollecitiEnabled(autoRow.valore)
  } else {
    const cfgFallback = await fetchSollecitiReminderSettings(supabase)
    autoSollecitiEnabled = cfgFallback.autoSollecitiEnabled
  }

  if (!autoSollecitiEnabled) {
    console.log('[CRON] Automazione disattivata')
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'auto_solleciti_disabled',
      inviati: 0,
    })
  }

  const reminderCfg = await fetchSollecitiReminderSettings(supabase)
  const sogliaBolla = reminderCfg.giorniTolBolla
  const sogliaPromessa = reminderCfg.giorniTolPromessa
  const now = new Date()
  const resend = new Resend(resendKey)

  let inviati = 0
  let skippedAging = 0
  let skippedDedup = 0
  let skippedNoEmail = 0
  const errors: string[] = []

  const { data: bolle, error: bolleErr } = await supabase
    .from('bolle')
    .select('id, data, stato, fornitore_id, fornitori(nome, email, language)')
    .eq('stato', 'in attesa')

  if (bolleErr) {
    return NextResponse.json({ error: bolleErr.message }, { status: 500 })
  }

  for (const b of bolle ?? []) {
    const id = String(b.id)
    const anchor = parseDateOnlyOrIso(b.data ?? null)
    const giorniDec = giorniTrascorsiDecimali(anchor, now)
    const giorniCal = anchor ? wholeDaysSinceUtc(anchor, now) : null
    const statoNorm = String(b.stato ?? '').trim()

    const overdueBolla = isBollaOverdue({
      stato: b.stato,
      data: b.data,
      toleranceDays: sogliaBolla,
      now,
    })

    let sintesiAging: string
    if (!anchor) {
      sintesiAging = `senza data valida -> NON_ANALIZZABILE`
    } else if (statoNorm !== 'in attesa') {
      sintesiAging = `stato="${statoNorm}" -> NON_ELEGIBILE`
    } else {
      sintesiAging = `${giorniDec}gg passati su ${sogliaBolla} -> ${overdueBolla ? 'SOGLIA_RAGGIUNTA' : 'OK'}`
    }

    console.log(
      `[AGING CHECK] bolla id=${id}: Giorni trascorsi: ${giorniDec} | Giorni calendario UTC: ${giorniCal ?? 'n/d'} | Soglia: ${sogliaBolla} | ${sintesiAging}`,
    )

    if (!overdueBolla) {
      skippedAging++
      console.log(`[DECISION] bolla id=${id}: SKIP — aging non raggiunto o non eleggibile`)
      continue
    }

    if (await wasCronSollecitoRecent(supabase, 'bolla', id)) {
      skippedDedup++
      console.log(`[DECISION] bolla id=${id}: SKIP — sollecito già inviato negli ultimi 7 giorni`)
      continue
    }

    const fornitore = unwrapFornitore(b.fornitori)
    const email = fornitore?.email?.trim()
    if (!email) {
      skippedNoEmail++
      console.log(`[DECISION] bolla id=${id}: SKIP — email fornitore assente`)
      continue
    }

    const lang = supplierLang(fornitore)
    const dataISO = typeof b.data === 'string' ? b.data : String(b.data ?? '')
    const { subject, html } = buildSollecitoBollaEmail({
      nome: fornitore!.nome,
      dataISO,
      lang,
    })

    const { error: mailErr } = await resend.emails.send({
      from: 'Smart Pair <onboarding@resend.dev>',
      to: email,
      subject,
      html,
    })

    if (mailErr) {
      errors.push(`bolla ${id}: ${mailErr.message}`)
      console.log(`[DECISION] bolla id=${id}: ERRORE INVIO — ${mailErr.message}`)
      continue
    }

    inviati++
    console.log(`[DECISION] bolla id=${id}: INVIO sollecito a ${email}`)

    await supabase.from('log_sincronizzazione').insert([
      {
        mittente: 'cron/process-solleciti',
        oggetto_mail: cronLogOggetto('bolla', id, subject),
        stato: 'successo',
        fornitore_id: b.fornitore_id ?? null,
        file_url: null,
        errore_dettaglio: null,
      },
    ])
  }

  const { data: docRows, error: docErr } = await supabase
    .from('documenti_da_processare')
    .select('id, created_at, metadata, fornitore_id, mittente, fornitori(nome, email, language)')
    .in('stato', [...DOCUMENTI_PENDING_FILTER_STATES])

  if (docErr) {
    return NextResponse.json({ error: docErr.message, inviati, errors }, { status: 500 })
  }

  for (const row of docRows ?? []) {
    const id = String(row.id)
    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}

    if (meta.promessa_invio_documento !== true) continue

    const createdRaw = row.created_at
    const anchorProm =
      createdRaw == null
        ? null
        : typeof createdRaw === 'string'
          ? new Date(createdRaw)
          : createdRaw instanceof Date
            ? createdRaw
            : null
    const anchorOk = anchorProm && !Number.isNaN(anchorProm.getTime()) ? anchorProm : null

    const overduePromessa = isPromisedDocOverdue(meta, row.created_at, sogliaPromessa, now)
    const giorniDec = giorniTrascorsiDecimali(anchorOk, now)
    const giorniCal = anchorOk ? wholeDaysSinceUtc(anchorOk, now) : null

    const sintesiAging = !anchorOk
      ? `senza created_at valido -> NON_ANALIZZABILE`
      : `${giorniDec}gg passati su ${sogliaPromessa} -> ${overduePromessa ? 'SOGLIA_RAGGIUNTA' : 'OK'}`

    console.log(
      `[AGING CHECK] promessa_doc id=${id}: Giorni trascorsi: ${giorniDec} | Giorni calendario UTC: ${giorniCal ?? 'n/d'} | Soglia: ${sogliaPromessa} | ${sintesiAging}`,
    )

    if (!overduePromessa) {
      skippedAging++
      console.log(`[DECISION] promessa_doc id=${id}: SKIP — aging non raggiunto`)
      continue
    }

    if (await wasCronSollecitoRecent(supabase, 'promessa_doc', id)) {
      skippedDedup++
      console.log(`[DECISION] promessa_doc id=${id}: SKIP — sollecito già inviato negli ultimi 7 giorni`)
      continue
    }

    const fornitore = unwrapFornitore(row.fornitori)
    const email = fornitore?.email?.trim() ?? parseEmailFromMittente(row.mittente ?? undefined)
    if (!email) {
      skippedNoEmail++
      console.log(`[DECISION] promessa_doc id=${id}: SKIP — email destinatario assente`)
      continue
    }

    const lang = supplierLang(fornitore)
    const { subject, html } = buildSollecitoPromessaDocumentoEmail({
      nome: fornitore?.nome ?? 'Supplier',
      lang,
    })

    const { error: mailErr } = await resend.emails.send({
      from: 'Smart Pair <onboarding@resend.dev>',
      to: email,
      subject,
      html,
    })

    if (mailErr) {
      errors.push(`promessa_doc ${id}: ${mailErr.message}`)
      console.log(`[DECISION] promessa_doc id=${id}: ERRORE INVIO — ${mailErr.message}`)
      continue
    }

    inviati++
    console.log(`[DECISION] promessa_doc id=${id}: INVIO sollecito a ${email}`)

    await supabase.from('log_sincronizzazione').insert([
      {
        mittente: 'cron/process-solleciti',
        oggetto_mail: cronLogOggetto('promessa_doc', id, subject),
        stato: 'successo',
        fornitore_id: row.fornitore_id ?? null,
        file_url: null,
        errore_dettaglio: null,
      },
    ])
  }

  return NextResponse.json({
    ok: true,
    inviati,
    skipped_aging: skippedAging,
    skipped_dedup_7d: skippedDedup,
    skipped_no_email: skippedNoEmail,
    soglia_bolla_giorni: sogliaBolla,
    soglia_promessa_giorni: sogliaPromessa,
    ...(errors.length > 0 && { errors }),
  })
}
