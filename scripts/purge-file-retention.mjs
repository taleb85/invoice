/**
 * Purge allegati oltre la finestra hot (mese corrente + precedente).
 *
 * Uso:
 *   node scripts/purge-file-retention.mjs              # dry-run
 *   node scripts/purge-file-retention.mjs --apply      # cancellazione reale
 *   node scripts/purge-file-retention.mjs --apply --force   # ignora giorno del mese
 *   node scripts/purge-file-retention.mjs --sede-id=<uuid>
 *
 * Richiede CRON_SECRET e SITE_URL in .env.local (come run-cron-local).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvLocal() {
  const p = resolve(root, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
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

const apply = process.argv.includes('--apply')
const force = process.argv.includes('--force')
let sedeId = ''
for (const arg of process.argv) {
  const m = arg.match(/^--sede-id=(.+)$/)
  if (m) sedeId = m[1]
}

const secret = process.env.CRON_SECRET
const base = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

if (!secret) {
  console.error('CRON_SECRET mancante in .env.local')
  process.exit(1)
}

const q = new URLSearchParams()
if (!apply) q.set('dry_run', '1')
if (force) q.set('force', '1')
if (sedeId) q.set('sede_id', sedeId)

const url = `${base}/api/cron/purge-file-retention?${q.toString()}`
console.log(apply ? 'APPLY' : 'DRY-RUN', '→', url)

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
})
const body = await res.json().catch(() => ({}))
console.log(JSON.stringify(body, null, 2))
if (!res.ok) process.exit(1)
