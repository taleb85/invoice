#!/usr/bin/env node
/**
 * Audit globale listino_prezzi: righe con prezzo = quantità OCR (tutti i fornitori).
 * Logica in src/lib/listino-price-audit.ts (eseguita via vitest integration).
 *
 *   npm run audit:listino-qty
 *   npm run audit:listino-qty:apply
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

loadEnvLocal()

const apply = process.argv.includes('--apply')
const env = {
  ...process.env,
  LISTINO_QTY_AUDIT: '1',
  LISTINO_QTY_AUDIT_APPLY: apply ? '1' : '0',
}

const r = spawnSync(
  'npx',
  ['vitest', 'run', 'src/lib/__tests__/listino-qty-audit-all.integration.test.ts'],
  { cwd: root, env, stdio: 'inherit' },
)

process.exit(r.status ?? 1)
