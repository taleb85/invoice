#!/usr/bin/env node
/**
 * Audit & Fix All — comando unico per ricontrollare TUTTI i documenti.
 *
 * Chiama in loop l'endpoint `/api/admin/audit-and-fix-all` finché non restano
 * più documenti idonei. Mostra avanzamento live con totali cumulativi.
 *
 * Esegue di default:
 *   1. Pass 1 deterministico (veloce, gratis) — corregge fornitore/data/tipo
 *      usando metadata OCR già presenti + catena di qualità 2/3.
 *   2. Pass 2 AI (Gemini Vision) — solo se passi `--with-ai`. Costoso.
 *   3. Cleanup — solo se passi `--cleanup`. Pulisce bolle/fatture create per
 *      errore quando il documento sorgente è una conferma d'ordine.
 *
 * Uso:
 *   npm run audit:full                         # solo pass 1 (veloce)
 *   npm run audit:full -- --with-ai            # pass 1 + pass 2 AI (lento)
 *   npm run audit:full -- --phase=ai           # solo pass 2 (AI)
 *   npm run audit:full -- --phase=cleanup      # solo cleanup (dry-run)
 *   npm run audit:full -- --cleanup            # cleanup in dry-run (mostra cosa farebbe)
 *   npm run audit:full -- --cleanup --cleanup-apply
 *                                              # cleanup REALE (cancella bolle/fatture)
 *   npm run audit:full -- --sede-id=<uuid>     # limita a una sede
 *   npm run audit:full -- --batch=20           # docs per chiamata
 *   npm run audit:full -- --max-iterations=10  # tetto al loop
 *   npm run audit:full -- --force              # riprocessa anche già marcati
 *   npm run audit:full -- --dry-run            # solo conta, non chiama l'endpoint
 *
 * Prerequisiti in `.env.local`:
 *   CRON_SECRET=<bearer per autenticarsi all'endpoint admin>
 * Opzionale:
 *   SITE_URL=http://localhost:3000             # default localhost in dev
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Env loader ───────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvLocal()

// ─── ANSI colors ──────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
}

const isTty = process.stdout.isTTY === true
const c = (color, text) => (isTty ? `${C[color]}${text}${C.reset}` : text)

// ─── Argomenti ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const flags = {
    phase: null, // 'deterministic' | 'ai' | 'cleanup' | null
    withAi: false,
    cleanup: false,
    cleanupApply: false,
    sedeId: null,
    batch: null,
    maxIterations: 200,
    force: false,
    dryRun: false,
    help: false,
  }
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') flags.help = true
    else if (arg === '--with-ai') flags.withAi = true
    else if (arg === '--cleanup') flags.cleanup = true
    else if (arg === '--cleanup-apply') flags.cleanupApply = true
    else if (arg === '--force') flags.force = true
    else if (arg === '--dry-run') flags.dryRun = true
    else if (arg.startsWith('--phase=')) flags.phase = arg.slice('--phase='.length).trim()
    else if (arg.startsWith('--sede-id=')) flags.sedeId = arg.slice('--sede-id='.length).trim()
    else if (arg.startsWith('--batch=')) flags.batch = parseInt(arg.slice('--batch='.length), 10)
    else if (arg.startsWith('--max-iterations=')) {
      const n = parseInt(arg.slice('--max-iterations='.length), 10)
      if (Number.isFinite(n) && n > 0) flags.maxIterations = n
    }
  }
  return flags
}

const flags = parseArgs()

if (flags.help) {
  console.log(`Uso:
  npm run audit:full                         solo pass 1 (deterministico)
  npm run audit:full -- --with-ai            pass 1 + pass 2 (AI Gemini)
  npm run audit:full -- --phase=ai           solo pass 2 (AI)
  npm run audit:full -- --phase=deterministic solo pass 1
  npm run audit:full -- --phase=cleanup      solo cleanup (dry-run)
  npm run audit:full -- --cleanup            cleanup in dry-run (mostra candidati)
  npm run audit:full -- --cleanup --cleanup-apply
                                             cleanup REALE: cancella bolle/fatture
                                             create per errore da Order Confirmation
  npm run audit:full -- --sede-id=<uuid>     limita a una sede
  npm run audit:full -- --batch=N            docs per chiamata (default 50/5/25)
  npm run audit:full -- --max-iterations=N   tetto al loop (default 200)
  npm run audit:full -- --force              riprocessa anche già marcati
  npm run audit:full -- --dry-run            solo stima, non chiama l'endpoint
`)
  process.exit(0)
}

// ─── Endpoint config ──────────────────────────────────────────────────────────

const cronSecret = process.env.CRON_SECRET?.trim()
if (!cronSecret) {
  console.error(c('red', 'Manca CRON_SECRET in .env.local. Impossibile autenticarsi all\'endpoint admin.'))
  process.exit(1)
}

const siteRaw =
  process.env.SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'http://localhost:3000'
const SITE = siteRaw.endsWith('/') ? siteRaw.slice(0, -1) : siteRaw
const ENDPOINT = `${SITE}/api/admin/audit-and-fix-all`

// ─── Caller ───────────────────────────────────────────────────────────────────

async function runOneBatch(phase) {
  // Cleanup è SEMPRE in dry-run a meno che l'utente non abbia passato esplicitamente
  // --cleanup-apply. Questo è un guard di sicurezza: cancellazioni vere richiedono
  // intenzione esplicita.
  const cleanupDryRun = phase === 'cleanup_misclassified' && !flags.cleanupApply
  const body = {
    phase,
    ...(flags.sedeId ? { sede_id: flags.sedeId } : {}),
    ...(flags.batch ? { batch_size: flags.batch } : {}),
    ...(flags.force ? { force: true } : {}),
    ...(cleanupDryRun ? { dry_run: true } : {}),
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json
  try {
    json = text.trim() ? JSON.parse(text) : null
  } catch {
    json = { ok: false, error: text }
  }

  if (!res.ok) {
    const err = (json && json.error) || `HTTP ${res.status}`
    throw new Error(err)
  }

  return json
}

async function loopPhase(phase, label) {
  const isCleanup = phase === 'cleanup_misclassified'
  const cleanupDryRun = isCleanup && !flags.cleanupApply

  console.log()
  console.log(c('bold', c('cyan', `═══ ${label} ═══`)))
  console.log(c('gray', `endpoint: ${ENDPOINT}`))
  console.log(c('gray', `phase: ${phase}${flags.sedeId ? `, sede: ${flags.sedeId}` : ''}${flags.force ? ', force=true' : ''}${cleanupDryRun ? ', dry_run=true' : ''}`))
  if (isCleanup) {
    console.log(
      cleanupDryRun
        ? c('yellow', '  ! Cleanup in DRY-RUN — nessuna cancellazione. Aggiungi --cleanup-apply per applicare.')
        : c('red', '  ! Cleanup REALE — bolle/fatture verranno cancellate dal database.'),
    )
  }
  console.log()

  const totals = {
    iterations: 0,
    checked: 0,
    fornitore_fixed: 0,
    tipo_fixed: 0,
    flagged_for_review: 0,
    unchanged: 0,
    errors: 0,
    cleanup_actions: 0,
  }

  let firstRemaining = null

  for (let i = 1; i <= flags.maxIterations; i++) {
    let result
    try {
      result = await runOneBatch(phase)
    } catch (e) {
      console.error(c('red', `  iter ${i}: errore — ${e.message}`))
      totals.errors++
      if (totals.errors >= 3) {
        console.error(c('red', '  Troppi errori consecutivi, interrompo.'))
        break
      }
      continue
    }

    totals.iterations++
    totals.checked += result.checked
    totals.fornitore_fixed += result.fornitore_fixed
    totals.tipo_fixed += result.tipo_fixed
    totals.flagged_for_review += result.flagged_for_review
    totals.unchanged += result.unchanged
    totals.errors += result.errors
    if (Array.isArray(result.cleanup_actions)) {
      totals.cleanup_actions += result.cleanup_actions.length
    }

    if (firstRemaining === null) firstRemaining = result.remaining_estimate

    const pct =
      firstRemaining > 0
        ? Math.min(100, Math.round((totals.checked / firstRemaining) * 100))
        : 100

    const bar = renderBar(pct)
    if (isCleanup) {
      process.stdout.write(
        `  ${c('cyan', `iter ${String(i).padStart(3, ' ')}`)} ${bar} ${String(pct).padStart(3, ' ')}%  ` +
          `checked=${c('bold', totals.checked)} ` +
          `cleaned=${c('green', totals.cleanup_actions)} ` +
          `err=${c('red', totals.errors)} ` +
          c('gray', `(rem≈${result.remaining_estimate})`) +
          (cleanupDryRun ? c('yellow', ' [DRY-RUN]') : '') +
          '\n',
      )
    } else {
      process.stdout.write(
        `  ${c('cyan', `iter ${String(i).padStart(3, ' ')}`)} ${bar} ${String(pct).padStart(3, ' ')}%  ` +
          `checked=${c('bold', totals.checked)} ` +
          `forn+${c('green', totals.fornitore_fixed)} ` +
          `tipo+${c('green', totals.tipo_fixed)} ` +
          `flagged=${c('yellow', totals.flagged_for_review)} ` +
          `err=${c('red', totals.errors)} ` +
          c('gray', `(rem≈${result.remaining_estimate})`) +
          '\n',
      )
    }

    // Mostra ogni cambiamento (max 5 per batch per non sovraccaricare l'output)
    if (Array.isArray(result.changes) && result.changes.length) {
      for (const ch of result.changes.slice(0, 5)) {
        const reason = ch.reason || 'change'
        const fornBefore = shortId(ch.fornitore_id_before)
        const fornAfter = shortId(ch.fornitore_id_after)
        const tipoBefore = ch.tipo_before ?? '—'
        const tipoAfter = ch.tipo_after ?? '—'
        console.log(
          c('gray', `        · ${shortId(ch.doc_id)}  [${reason}]`) +
            (fornBefore !== fornAfter ? `  forn ${fornBefore} → ${c('green', fornAfter)}` : '') +
            (tipoBefore !== tipoAfter ? `  tipo ${tipoBefore} → ${c('green', tipoAfter)}` : ''),
        )
      }
      if (result.changes.length > 5) {
        console.log(c('gray', `        · …${result.changes.length - 5} altri`))
      }
    }

    // Cleanup: mostra ogni azione (max 5)
    if (Array.isArray(result.cleanup_actions) && result.cleanup_actions.length) {
      for (const a of result.cleanup_actions.slice(0, 5)) {
        const status = a.applied ? c('green', '✓') : c('yellow', '○')
        const orph = a.deleted_orphan_fattura_ids?.length ?? 0
        console.log(
          c('gray', `        ${status} ${(a.fornitore_nome ?? '?').padEnd(28).slice(0, 28)} ${(a.file_name ?? '').slice(0, 36)}`) +
            (a.deleted_bolla_id ? c('gray', ` bolla=${shortId(a.deleted_bolla_id)}`) : '') +
            (a.deleted_fattura_id ? c('gray', ` fat=${shortId(a.deleted_fattura_id)}`) : '') +
            (orph > 0 ? c('gray', ` +${orph} orfane`) : ''),
        )
      }
      if (result.cleanup_actions.length > 5) {
        console.log(c('gray', `        · …${result.cleanup_actions.length - 5} altre`))
      }
    }

    if (!result.has_more) {
      break
    }
  }

  console.log()
  console.log(c('bold', `  riepilogo ${label}`))
  console.log(`    iterazioni:        ${totals.iterations}`)
  console.log(`    documenti visti:   ${totals.checked}`)
  if (isCleanup) {
    const verb = cleanupDryRun ? 'da pulire' : 'puliti'
    console.log(`    ${verb.padEnd(18)} ${c('green', String(totals.cleanup_actions))}`)
  } else {
    console.log(`    fornitore corretti:${c('green', String(totals.fornitore_fixed))}`)
    console.log(`    tipo corretti:     ${c('green', String(totals.tipo_fixed))}`)
    console.log(`    da rivedere:       ${c('yellow', String(totals.flagged_for_review))}`)
    console.log(`    invariati:         ${totals.unchanged}`)
  }
  console.log(`    errori:            ${c(totals.errors > 0 ? 'red' : 'gray', String(totals.errors))}`)
  return totals
}

function renderBar(pct, width = 24) {
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled
  return c('green', '█'.repeat(filled)) + c('gray', '░'.repeat(empty))
}

function shortId(id) {
  if (!id) return c('gray', 'null')
  return c('cyan', String(id).slice(0, 8))
}

// ─── Dry run ──────────────────────────────────────────────────────────────────

if (flags.dryRun) {
  console.log(c('yellow', 'DRY-RUN: ricognizione (1 chiamata per fase, batch=1, nessuna iterazione)'))
  try {
    const det = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'deterministic', batch_size: 1, ...(flags.sedeId ? { sede_id: flags.sedeId } : {}) }),
    })
    const detJson = await det.json()
    console.log(`pass1 (deterministico): rimangono ~${detJson.remaining_estimate} documenti`)

    const ai = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'ai', batch_size: 1, ...(flags.sedeId ? { sede_id: flags.sedeId } : {}) }),
    })
    const aiJson = await ai.json()
    if (aiJson.ok === false) {
      console.log(`pass2 (AI):             non disponibile — ${aiJson.error}`)
    } else {
      console.log(`pass2 (AI Gemini):      rimangono ~${aiJson.remaining_estimate} documenti`)
    }
  } catch (e) {
    console.error(c('red', `Dry-run fallito: ${e.message}`))
    process.exit(1)
  }
  process.exit(0)
}

// ─── Flow principale ──────────────────────────────────────────────────────────

const startedAt = Date.now()
const summaries = []

try {
  if (
    flags.phase === 'cleanup' ||
    flags.phase === 'cleanup_misclassified' ||
    (flags.cleanup && !flags.phase)
  ) {
    const label = flags.cleanupApply
      ? 'CLEANUP — Bolle/Fatture incoerenti (REALE)'
      : 'CLEANUP — Bolle/Fatture incoerenti (DRY-RUN)'
    const t = await loopPhase('cleanup_misclassified', label)
    summaries.push({ label: 'cleanup_misclassified', ...t })
  } else if (
    flags.phase === 'cleanup_conferme_ordine' ||
    flags.phase === 'cleanup_co'
  ) {
    const label = flags.cleanupApply
      ? 'CLEANUP — conferme_ordine orfane (REALE)'
      : 'CLEANUP — conferme_ordine orfane (DRY-RUN)'
    const t = await loopPhase('cleanup_conferme_ordine', label)
    summaries.push({ label: 'cleanup_conferme_ordine', ...t })
  } else if (flags.phase === 'ai' || flags.phase === 'pass2') {
    const t = await loopPhase('ai', 'PASS 2 — AI Gemini Vision')
    summaries.push({ label: 'pass2_ai', ...t })
  } else if (flags.phase === 'deterministic' || flags.phase === 'pass1') {
    const t = await loopPhase('deterministic', 'PASS 1 — Deterministico')
    summaries.push({ label: 'pass1_deterministic', ...t })
  } else {
    // Default: pass1 sempre, pass2 solo se --with-ai
    const t1 = await loopPhase('deterministic', 'PASS 1 — Deterministico (veloce, gratis)')
    summaries.push({ label: 'pass1_deterministic', ...t1 })

    if (flags.withAi) {
      const t2 = await loopPhase('ai', 'PASS 2 — AI Gemini Vision (lento, costo Gemini)')
      summaries.push({ label: 'pass2_ai', ...t2 })
    } else {
      console.log()
      console.log(c('gray', '  pass2 (AI) saltato. Per eseguirlo: npm run audit:full -- --with-ai'))
    }
  }
} catch (e) {
  console.error(c('red', `\nErrore fatale: ${e.message}`))
  process.exit(1)
}

const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
console.log()
console.log(c('bold', `Completato in ${elapsedSec}s`))

// Exit code = 1 se errori
const totalErrors = summaries.reduce((s, x) => s + x.errors, 0)
process.exit(totalErrors > 0 ? 1 : 0)
