#!/usr/bin/env node
/**
 * Esegue dal terminale i job cron dell'app (GET + Authorization: Bearer CRON_SECRET).
 * Stesso meccanismo di Vercel Cron / curl verso `/api/cron/*`.
 *
 * Prerequisiti in `.env.local` o nell'ambiente:
 *   CRON_SECRET=…
 * Opzionale:
 *   SITE_URL=http://localhost:3000   (default localhost in dev)
 *
 * Uso:
 *   npm run process:sync
 *   npm run process -- /api/cron/auto-process-invoices
 *   SITE_URL=https://tuo-progetto.vercel.app npm run process:sync
 *
 * Paths noti:
 *   /api/cron/sync-emails          — sincronizza IMAP (come cron orario)
 *   /api/scan-emails               — alternativa legacy (GET + stesso bearer)
 *   /api/cron/auto-process-invoices
 *   /api/cron/rekki-auto-poll
 *   /api/cron/backup
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvLocal() {
  const p = resolve(root, '.env.local')
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

const DEFAULT_PATH = '/api/cron/sync-emails'

const pathArg = process.argv.slice(2).find((a) => a.startsWith('/')) ?? DEFAULT_PATH
const secret = process.env.CRON_SECRET?.trim()

const siteRaw =
  process.env.SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  'http://localhost:3000'

const base = siteRaw.endsWith('/') ? siteRaw.slice(0, -1) : siteRaw
const url = new URL(pathArg.startsWith('/') ? pathArg : `/${pathArg}`, base).toString()

if (!secret) {
  console.error('Manca CRON_SECRET (impostalo in .env.local o negli export).')
  process.exit(1)
}

const res = await fetch(url, {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${secret}`,
    Accept: 'application/json',
  },
})

const text = await res.text()
let body
try {
  body = text.trim() ? JSON.parse(text) : null
} catch {
  body = text
}

if (!res.ok) {
  console.error(`HTTP ${res.status}`, body)
  process.exit(1)
}

console.log(JSON.stringify(body, null, 2))
