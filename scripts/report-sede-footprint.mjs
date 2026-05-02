/**
 * Report approssimativo: righe DB + storage bucket documenti per sede.
 * Uso: node scripts/report-sede-footprint.mjs  (richiede .env.local con service role)
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.local')

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
    if ((kind !== 'public' && kind !== 'sign' && kind !== 'authenticated') || !bucket)
      return null
    const objectPath = parts.slice(i + 3).map(decodeURIComponent).join('/')
    return objectPath || null
  } catch {
    return null
  }
}

const env = loadEnv(envPath)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(url, key)

/**
 * Elenco paginato oggetti nel bucket `documenti` (solo root: nomi senza `/`).
 * Se in futuro usate path con sottocartelle, va esteso un walk ricorsivo.
 */
async function loadDocumentiSizesFlatBucket(sb) {
  const map = new Map()
  const limit = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await sb.storage.from('documenti').list('', {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) {
      console.warn('List storage bucket documenti:', error.message)
      break
    }
    const chunk = data ?? []
    for (const entry of chunk) {
      if (!entry?.name) continue
      if (entry.id == null && entry.metadata == null) continue
      const sz =
        entry.metadata &&
        typeof entry.metadata === 'object' &&
        entry.metadata.size != null
          ? Number(entry.metadata.size)
          : 0
      map.set(entry.name, Number.isFinite(sz) ? sz : 0)
    }
    if (chunk.length < limit) break
    offset += limit
    if (offset > 500_000) break
  }
  return map
}

async function countTable(table, sedeCol, sedeId) {
  const { count, error } = await sb
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(sedeCol, sedeId)
  if (error) return { table, error: error.message }
  return { table, count: count ?? 0 }
}

async function main() {
  const { data: sedi, error: sediErr } = await sb
    .from('sedi')
    .select('id, nome')
    .order('nome')

  if (sediErr) {
    console.error(sediErr.message)
    process.exit(1)
  }

  if (!sedi?.length) {
    console.log('Nessuna sede nel progetto.')
    return
  }

  const sizeByName = await loadDocumentiSizesFlatBucket(sb)
  if (sizeByName.size === 0) {
    console.warn(
      'Nessun file listato al root del bucket documenti (vuoto, permessi, o path in sottocartelle).',
    )
  }

  let totalBucketBytes = 0
  for (const v of sizeByName.values()) totalBucketBytes += v

  for (const sede of sedi) {
    const id = sede.id
    const nome = sede.nome

    const [
      fornitori,
      bolle,
      fatture,
      documenti,
      conferme,
      statements,
      activity,
      logSync,
    ] = await Promise.all([
      countTable('fornitori', 'sede_id', id),
      countTable('bolle', 'sede_id', id),
      countTable('fatture', 'sede_id', id),
      countTable('documenti_da_processare', 'sede_id', id),
      countTable('conferme_ordine', 'sede_id', id),
      countTable('statements', 'sede_id', id).catch(() => ({
        table: 'statements',
        count: 0,
      })),
      countTable('activity_log', 'sede_id', id).catch(() => ({
        table: 'activity_log',
        count: 0,
      })),
      countTable('log_sincronizzazione', 'sede_id', id).catch(() => ({
        table: 'log_sincronizzazione',
        count: 0,
      })),
    ])

    const paths = new Set()
    const addUrls = (rows) => {
      for (const r of rows ?? []) {
        const p = parseStoragePath(r.file_url)
        if (p) paths.add(p)
      }
    }

    const [bRows, fRows, dRows, cRows, sRows] = await Promise.all([
      sb.from('bolle').select('file_url').eq('sede_id', id).not('file_url', 'is', null),
      sb.from('fatture').select('file_url').eq('sede_id', id).not('file_url', 'is', null),
      sb
        .from('documenti_da_processare')
        .select('file_url')
        .eq('sede_id', id)
        .not('file_url', 'is', null),
      sb
        .from('conferme_ordine')
        .select('file_url')
        .eq('sede_id', id)
        .not('file_url', 'is', null),
      sb
        .from('statements')
        .select('file_url')
        .eq('sede_id', id)
        .not('file_url', 'is', null)
        .then((r) => r)
        .catch(() => ({ data: [] })),
    ])

    addUrls(bRows.data)
    addUrls(fRows.data)
    addUrls(dRows.data)
    addUrls(cRows.data)
    addUrls(sRows.data)

    let bytesReferenced = 0
    let missingMeta = 0
    for (const p of paths) {
      const base = p.includes('/') ? p.split('/').pop() : p
      const sz = sizeByName.get(p) ?? (base ? sizeByName.get(base) : undefined)
      if (sz === undefined) missingMeta++
      else bytesReferenced += sz
    }

    console.log('\n── Sede:', nome)
    console.log('   id:', id)
    console.log(
      '   Righe (approssimazione workload DB):',
      JSON.stringify(
        {
          fornitori: fornitori.count ?? fornitori.error,
          bolle: bolle.count ?? bolle.error,
          fatture: fatture.count ?? fatture.error,
          documenti_da_processare: documenti.count ?? documenti.error,
          conferme_ordine: conferme.count ?? conferme.error,
          statements: statements.count ?? statements.error,
          activity_log: activity.count ?? activity.error,
          log_sincronizzazione: logSync.count ?? logSync.error,
        },
        null,
        2,
      ),
    )
    console.log('   Path allegati distinti (bucket documenti) da DB:', paths.size)
    console.log(
      '   Stima dimensione file collegati (somma size da list bucket):',
      bytesReferenced > 0
        ? `${(bytesReferenced / (1024 * 1024)).toFixed(2)} MB (${bytesReferenced.toLocaleString()} byte)`
        : paths.size > 0 && sizeByName.size === 0
          ? 'non calcolabile (list bucket vuota)'
          : paths.size === 0
            ? 'nessun file_url in DB per questa sede'
            : '0 (path in DB non trovati nel bucket — verifica path o sottocartelle)',
    )
    if (missingMeta > 0 && sizeByName.size > 0) {
      console.log(
        '   Nota:',
        missingMeta,
        'path da DB senza corrispondenza nel bucket (nomi diversi, file rimossi, o cartelle annidate).',
      )
    }
  }

  if (totalBucketBytes > 0) {
    console.log(
      '\n── Totale bucket documenti (somma list root):',
      `${(totalBucketBytes / (1024 * 1024)).toFixed(2)} MB`,
      `(${totalBucketBytes.toLocaleString()} byte, ~${sizeByName.size} oggetti)`,
    )
  }

  console.log(
    '\nNota: dimensione database PostgreSQL totale non è inclusa (serve dashboard Supabase → Database → utilizzo).',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
