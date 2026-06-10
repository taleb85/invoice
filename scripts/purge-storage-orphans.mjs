/**
 * Rimuove file orfani dal bucket Supabase "documenti":
 * presenti in storage ma non referenziati da nessuna tabella con colonna file_url.
 *
 * Uso:
 *   node scripts/purge-storage-orphans.mjs              # dry-run (default)
 *   node scripts/purge-storage-orphans.mjs --apply      # cancella davvero
 *   node scripts/purge-storage-orphans.mjs --apply --batch=200
 *
 * Richiede .env.local con NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.local')

const TABLES_WITH_FILE_URL = [
  'bolle',
  'fatture',
  'conferme_ordine',
  'documenti_da_processare',
  'statements',
  'log_sincronizzazione',
  'cataloghi_fornitori_potenziali',
]

const BUCKET = 'documenti'
const DEFAULT_BATCH = 100

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

function parseStoragePath(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return null
  try {
    const u = new URL(fileUrl.trim())
    const parts = u.pathname.split('/').filter(Boolean)
    const i = parts.indexOf('object')
    if (i === -1) return null
    const kind = parts[i + 1]
    const bucket = parts[i + 2]
    if ((kind !== 'public' && kind !== 'sign' && kind !== 'authenticated') || !bucket) {
      return null
    }
    const objectPath = parts.slice(i + 3).map(decodeURIComponent).join('/')
    return objectPath || null
  } catch {
    return null
  }
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function parseArgs(argv) {
  const apply = argv.includes('--apply')
  let batch = DEFAULT_BATCH
  for (const arg of argv) {
    const m = arg.match(/^--batch=(\d+)$/)
    if (m) batch = Math.max(1, parseInt(m[1], 10))
  }
  return { apply, batch }
}

async function fetchAllFileUrlPaths(sb) {
  const refs = new Set()
  const pageSize = 1000

  for (const table of TABLES_WITH_FILE_URL) {
    let from = 0
  outer: for (;;) {
      const { data, error } = await sb
        .from(table)
        .select('file_url')
        .not('file_url', 'is', null)
        .range(from, from + pageSize - 1)

      if (error) {
        if (error.code === '42P01') {
          console.warn(`  Tabella ${table} assente, skip.`)
          break outer
        }
        throw new Error(`${table}: ${error.message}`)
      }

      const rows = data ?? []
      for (const row of rows) {
        const p = parseStoragePath(row.file_url)
        if (p) refs.add(p)
      }

      if (rows.length < pageSize) break
      from += pageSize
    }
  }

  return refs
}

/** Elenco ricorsivo di tutti gli oggetti nel bucket (path relativi). */
async function listAllStorageObjects(sb, prefix = '') {
  const out = []
  const limit = 1000
  let offset = 0

  for (;;) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`list storage "${prefix || '/'}": ${error.message}`)

    const chunk = data ?? []
    for (const entry of chunk) {
      if (!entry?.name) continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const isFolder = entry.id == null && entry.metadata == null
      if (isFolder) {
        const nested = await listAllStorageObjects(sb, rel)
        out.push(...nested)
      } else {
        const sz =
          entry.metadata &&
          typeof entry.metadata === 'object' &&
          entry.metadata.size != null
            ? Number(entry.metadata.size)
            : 0
        out.push({
          name: rel,
          size: Number.isFinite(sz) ? sz : 0,
        })
      }
    }

    if (chunk.length < limit) break
    offset += limit
    if (offset > 1_000_000) {
      console.warn('Tetto elenco storage raggiunto (1M offset).')
      break
    }
  }

  return out
}

async function removeBatch(sb, names) {
  const { data, error } = await sb.storage.from(BUCKET).remove(names)
  if (error) throw new Error(error.message)
  return data ?? []
}

async function main() {
  const { apply, batch } = parseArgs(process.argv.slice(2))

  const env = loadEnv(envPath)
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const sb = createClient(url, key)

  console.log(apply ? 'Modalità: APPLY (cancellazione reale)' : 'Modalità: dry-run')
  console.log('Caricamento riferimenti file_url dal database…')
  const refs = await fetchAllFileUrlPaths(sb)
  console.log(`  Path referenziati in DB: ${refs.size}`)

  console.log('Elenco oggetti nel bucket documenti…')
  const objects = await listAllStorageObjects(sb)
  console.log(`  Oggetti in storage: ${objects.length}`)

  const orphans = objects.filter((o) => !refs.has(o.name))
  const orphanBytes = orphans.reduce((s, o) => s + o.size, 0)

  console.log(`\nOrfani: ${orphans.length} file, ${formatBytes(orphanBytes)}`)

  if (orphans.length === 0) {
    console.log('Nessun file orfano da rimuovere.')
    return
  }

  const sample = orphans.slice(0, 10).map((o) => `  - ${o.name} (${formatBytes(o.size)})`)
  console.log('\nEsempio (max 10):')
  console.log(sample.join('\n'))

  if (!apply) {
    console.log('\nDry-run completato. Per cancellare: node scripts/purge-storage-orphans.mjs --apply')
    return
  }

  console.log(`\nCancellazione in batch da ${batch}…`)
  let deleted = 0
  let failed = 0

  for (let i = 0; i < orphans.length; i += batch) {
    const chunk = orphans.slice(i, i + batch).map((o) => o.name)
    try {
      await removeBatch(sb, chunk)
      deleted += chunk.length
      process.stdout.write(
        `\r  Progresso: ${deleted}/${orphans.length} (${formatBytes(
          orphans.slice(0, deleted).reduce((s, o) => s + o.size, 0),
        )})`,
      )
    } catch (e) {
      failed += chunk.length
      console.error(`\n  Errore batch ${i}-${i + chunk.length}: ${e.message}`)
    }
  }

  console.log(`\n\nFatto. Cancellati: ${deleted}, errori: ${failed}`)
  if (deleted > 0) {
    const remaining = await listAllStorageObjects(sb)
    const remBytes = remaining.reduce((s, o) => s + o.size, 0)
    console.log(`Storage residuo: ${remaining.length} file, ${formatBytes(remBytes)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
