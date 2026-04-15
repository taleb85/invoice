#!/usr/bin/env node
/**
 * Applica le migration SQL in ordine (allineato a DEPLOY_GUIDE.md, Passo 3).
 *
 * Modalità A — connessione Postgres (massima compatibilità con script lunghi):
 *   DATABASE_URL=postgresql://...?sslmode=require
 *   oppure SUPABASE_DB_URL
 *   (Supabase → Settings → Database → Connection string → URI)
 *
 * Modalità B — niente URI DB: Supabase Management API (beta)
 *   SUPABASE_ACCESS_TOKEN   — Personal Access Token o fine-grained token con permesso database (write)
 *                             https://supabase.com/dashboard/account/tokens
 *   NEXT_PUBLIC_SUPABASE_URL — già nel progetto; da qui si ricava il project ref (sottodominio .supabase.co)
 *   oppure SUPABASE_PROJECT_REF esplicito (domini custom / URL non standard)
 *
 * Priorità: se c’è DATABASE_URL / SUPABASE_DB_URL si usa Postgres; altrimenti Management API se token + ref.
 *
 * Uso:
 *   node scripts/apply-supabase-migrations.mjs
 *   node scripts/apply-supabase-migrations.mjs --dry-run
 *   node scripts/apply-supabase-migrations.mjs --with-dup-display-name
 *   node scripts/apply-supabase-migrations.mjs --from create-log-table.sql   # salta file già applicati
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const MANAGEMENT_API = 'https://api.supabase.com/v1'

const MIGRATIONS = [
  'multi-sede.sql',
  'create-log-table.sql',
  'security-and-performance.sql',
  'setup-storage.sql',
  'security-update.sql',
  'add-country-code.sql',
  'add-da-associare-stato.sql',
  'fix-documenti-visibilita.sql',
  'fix-rls-null-sede.sql',
  'add-importo-multibolla.sql',
  'add-fornitore-emails.sql',
  'add-fornitore-display-name.sql',
  'add-ai-metadata.sql',
  'add-statement-column.sql',
  'add-registrato-da.sql',
  'sedi-imap.sql',
  'migrations/listino_prezzi.sql',
  'migrations/fornitore_contatti.sql',
  'migrations/add-imap-lookback-days.sql',
  'supabase/migrations/add-statements.sql',
  'supabase/migrations/add-rekki-statement-status.sql',
  'supabase/migrations/add-sede-currency-timezone-lang.sql',
  'supabase/migrations/fix-rls-bolle-fatture-via-fornitore-sede.sql',
  'supabase/migrations/fix-storage-documenti-public-read.sql',
  'supabase/migrations/proactive-supplier-rekki.sql',
  'supabase/migrations/admin-log-sede-sync-health-rekki-id.sql',
  'supabase/migrations/tighten-rls-operator-isolation.sql',
  'supabase/migrations/email-scan-attachment-fingerprint.sql',
  'supabase/migrations/20260413_admin_sede_role.sql',
  'supabase/migrations/20260413_fix-taleb-profile-admin-sede.sql',
  'supabase/migrations/add-fornitore-logo-url.sql',
  'supabase/migrations/listino-prezzi-rls-authenticated-write.sql',
  'supabase/migrations/add-conferme-ordine.sql',
  'supabase/migrations/fornitore-ocr-tipo-pending-kind-hints.sql',
  'supabase/migrations/20260415_fatture_add_updated_at_if_missing.sql',
]

function loadEnvLocal() {
  const p = resolve(root, '.env.local')
  if (!existsSync(p)) return {}
  const text = readFileSync(p, 'utf8')
  const out = {}
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
    out[key] = val
  }
  return out
}

function mergeProcessEnv(loaded) {
  for (const [k, v] of Object.entries(loaded)) {
    if (process.env[k] === undefined) process.env[k] = v
  }
}

/** @param {string | undefined} supabaseUrl */
function projectRefFromSupabaseUrl(supabaseUrl) {
  if (!supabaseUrl || typeof supabaseUrl !== 'string') return null
  try {
    const u = new URL(supabaseUrl)
    const host = u.hostname.toLowerCase()
    const m = host.match(/^([a-z0-9_-]+)\.supabase\.co$/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/**
 * @param {string} ref
 * @param {string} token
 * @param {string} query
 */
async function managementRunSql(ref, token, query) {
  const res = await fetch(
    `${MANAGEMENT_API}/projects/${encodeURIComponent(ref)}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        read_only: false,
      }),
    }
  )

  const text = await res.text()
  let parsed = text
  try {
    parsed = text ? JSON.parse(text) : text
  } catch {
    /* testo grezzo */
  }

  if (!res.ok) {
    const detail =
      typeof parsed === 'object' && parsed !== null
        ? JSON.stringify(parsed)
        : String(parsed)
    let hint = ''
    if (res.status === 401) {
      hint =
        '\n\n401 Unauthorized: il token non è accettato da api.supabase.com.\n' +
        '  • NON usare anon key né service_role (stringhe lunghe che iniziano con eyJ): servono per l’app, non per la Management API.\n' +
        '  • Crea un token da: https://supabase.com/dashboard/account/tokens (deve iniziare con sbp_).\n' +
        '  • Se usi un token “fine-grained”, includi il permesso Database → write (database_write).\n' +
        '  • In .env.local niente virgolette attorno al valore, niente spazi prima/dopo; salva e riprova.\n' +
        '  • Alternativa: DATABASE_URL (Settings → Database → Connection string) e lo script userà Postgres.'
    }
    throw new Error(`Management API HTTP ${res.status}: ${detail}${hint}`)
  }
  return parsed
}

/**
 * Verifica che il PAT sia valido per la Management API prima di lanciare migration lunghe.
 * @param {string} token
 */
async function verifyManagementToken(token) {
  const res = await fetch(`${MANAGEMENT_API}/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (res.status === 401) {
    throw new Error(
      'Management API: 401 su GET /projects — token rifiutato.\n' +
        '  • NON usare anon / service_role (eyJ…): usa Account → Access Tokens (sbp_…).\n' +
        '  • Token scaduto/revocato o copia errata in .env.local (nessuna virgoletta).\n' +
        '  • Alternativa: DATABASE_URL (Postgres) per npm run db:apply-migrations.'
    )
  }
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Management API verify projects: HTTP ${res.status} ${t}`)
  }
}

/**
 * @param {string} dbUrl
 * @param {string[]} migrations
 */
async function runWithPostgres(dbUrl, migrations) {
  const { default: postgres } = await import('postgres')
  const sql = postgres(dbUrl, { max: 1 })
  try {
    for (let i = 0; i < migrations.length; i++) {
      const rel = migrations[i]
      const abs = resolve(root, rel)
      if (!existsSync(abs)) {
        throw new Error(`File mancante: ${rel}`)
      }
      console.log(`[${i + 1}/${migrations.length}] ${rel}`)
      await sql.file(abs)
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

/**
 * @param {string} ref
 * @param {string} token
 * @param {string[]} migrations
 */
async function runWithManagementApi(ref, token, migrations) {
  for (let i = 0; i < migrations.length; i++) {
    const rel = migrations[i]
    const abs = resolve(root, rel)
    if (!existsSync(abs)) {
      throw new Error(`File mancante: ${rel}`)
    }
    const query = readFileSync(abs, 'utf8')
    console.log(`[${i + 1}/${migrations.length}] ${rel}`)
    await managementRunSql(ref, token, query)
  }
}

function parseCliArgs(argv) {
  let fromFile = null
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) {
      fromFile = argv[i + 1]
      i++
      continue
    }
    rest.push(argv[i])
  }
  return { fromFile, flags: new Set(rest) }
}

mergeProcessEnv(loadEnvLocal())

const { fromFile, flags: args } = parseCliArgs(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const withDup = args.has('--with-dup-display-name')

const migrations = [...MIGRATIONS]
if (withDup) {
  migrations.push('supabase/migrations/add-fornitore-display-name.sql')
}

let toRun = migrations
if (fromFile) {
  const needle = fromFile.replace(/^\.\//, '')
  const idx = migrations.findIndex(
    (f) =>
      f === fromFile ||
      f === needle ||
      f.endsWith(`/${needle}`) ||
      f === `migrations/${needle}` ||
      f === `supabase/migrations/${needle}`
  )
  if (idx === -1) {
    console.error(
      `--from: "${fromFile}" non è nell’elenco. Esempi: create-log-table.sql, migrations/listino_prezzi.sql`
    )
    process.exit(1)
  }
  toRun = migrations.slice(idx)
  console.log(`Riprendo da [${idx + 1}/${migrations.length}] ${toRun[0]}\n`)
}

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
const pat = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const ref =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  projectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)

if (dryRun) {
  console.log('Dry run — file da applicare (in ordine):')
  for (const rel of toRun) {
    const abs = resolve(root, rel)
    const ok = existsSync(abs)
    console.log(`  ${ok ? '✓' : '✗'} ${rel}`)
    if (!ok) process.exitCode = 1
  }
  console.log('')
  if (dbUrl) {
    console.log('Esecuzione: Postgres (DATABASE_URL / SUPABASE_DB_URL).')
  } else if (pat && ref) {
    console.log(`Esecuzione: Management API (project ref: ${ref}).`)
  } else if (pat && !ref) {
    console.log(
      'SUPABASE_ACCESS_TOKEN presente ma project ref assente: imposta NEXT_PUBLIC_SUPABASE_URL (.supabase.co) o SUPABASE_PROJECT_REF.'
    )
    process.exitCode = 1
  } else {
    console.log(
      'Nessuna credenziale esecutiva: aggiungi DATABASE_URL oppure SUPABASE_ACCESS_TOKEN (+ URL/ref).'
    )
  }
  process.exit(process.exitCode ?? 0)
}

if (dbUrl) {
  try {
    await runWithPostgres(dbUrl, toRun)
    console.log('Completato (Postgres).')
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
  process.exit(0)
}

if (pat && ref) {
  if (pat.startsWith('eyJ')) {
    console.error(
      'SUPABASE_ACCESS_TOKEN sembra una JWT (inizia con eyJ): di solito è anon o service_role.\n' +
        'La Management API richiede un Personal Access Token dalla pagina Account (sbp_…).\n' +
        'Oppure usa DATABASE_URL per le migration.'
    )
    process.exit(1)
  }
  try {
    await verifyManagementToken(pat)
    await runWithManagementApi(ref, pat, toRun)
    console.log('Completato (Management API).')
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
  process.exit(0)
}

console.error(
  `Configurazione insufficiente per eseguire le migration.

  Opzione 1 — Postgres:
    DATABASE_URL o SUPABASE_DB_URL (URI dalla dashboard Database)

  Opzione 2 — senza URI DB:
    SUPABASE_ACCESS_TOKEN  (dashboard → Account → Access Tokens, permesso database write)
    e NEXT_PUBLIC_SUPABASE_URL (es. https://xxxx.supabase.co) oppure SUPABASE_PROJECT_REF

  Verifica: node scripts/apply-supabase-migrations.mjs --dry-run`
)
process.exit(1)
