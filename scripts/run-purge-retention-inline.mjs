/**
 * Esegue la purge retention senza HTTP (evita cache del dev server).
 * Uso: node scripts/run-purge-retention-inline.mjs [--apply] [--force] [--sede-id=uuid]
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnv(p) {
  const env = {}
  if (!fs.existsSync(p)) return env
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    env[k] = v
  }
  return env
}

const apply = process.argv.includes('--apply')
const force = process.argv.includes('--force')
let sedeId = ''
for (const arg of process.argv) {
  const m = arg.match(/^--sede-id=(.+)$/)
  if (m) sedeId = m[1]
}

const env = loadEnv(path.join(root, '.env.local'))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const { purgeColdDocumentFiles } = await import(
  pathToFileURL(path.join(root, 'src/lib/document-file-retention.ts')).href
)

const sb = createClient(url, key)
console.log(apply ? 'APPLY' : 'DRY-RUN', force ? '(force)' : '')

const result = await purgeColdDocumentFiles(sb, {
  dryRun: !apply,
  force,
  sedeId: sedeId || undefined,
})

console.log(JSON.stringify(result, null, 2))
if (result.errors.length > 0) process.exit(1)
