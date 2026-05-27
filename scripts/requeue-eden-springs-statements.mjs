#!/usr/bin/env node
/**
 * Eden Springs: elimina fatture fantasma e rimette i PDF in coda come statement.
 *
 *   node scripts/requeue-eden-springs-statements.mjs --sede-id=<uuid> [--dry-run] [--fornitore-id=<uuid>]
 *
 * Dopo l'apply, apri la scheda fornitore → Verifica (Estratti Conto) oppure
 * /statements/verifica — l'app elabora i PDF in sospeso con is_statement=true.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = resolve(ROOT, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

function supplierNameLooksLikeEdenSprings(name) {
  return /\beden\s*springs\b/i.test(String(name ?? ''))
}

function numeroLooksLikeUkAccount(numero) {
  const n = String(numero ?? '').trim()
  if (!n) return false
  return /^\d{8,10}$/.test(n.replace(/\s/g, ''))
}

function fatturaNumeroIsMisused(numero, fornitoreNome) {
  if (!numeroLooksLikeUkAccount(numero)) return false
  if (supplierNameLooksLikeEdenSprings(fornitoreNome)) return true
  return /^\d{9}$/.test(String(numero).replace(/\s/g, ''))
}

function docMeta(doc) {
  return doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
    ? doc.metadata
    : {}
}

function docLooksLikeMisclassifiedStatement(doc) {
  const meta = docMeta(doc)
  if (meta.tipo_documento === 'estratto_conto') return true
  if (meta.pending_kind_reclassified_from === 'statement') return true
  if (meta.pending_kind === 'statement') return true
  const fn = doc.file_name?.trim() ?? ''
  if (/^INV_\d+_\d{8}_E\.pdf$/i.test(fn)) return true
  return false
}

function fatturaLooksLikePhantomStatement(f, fornitoreNome) {
  if (f.bolla_id) return false
  const num = f.numero_fattura?.trim()
  if (!num) return true
  return fatturaNumeroIsMisused(num, fornitoreNome)
}

function docRequeueStrength(doc) {
  let s = 0
  if (doc.fornitore_id) s += 100
  if (doc.is_statement) s += 50
  if (doc.stato === 'associato') s += 20
  else if (doc.stato === 'da_processare' || doc.stato === 'in_attesa' || doc.stato === 'da_associare') s += 30
  if (docMeta(doc).estrazione_utile === true) s += 10
  if (docMeta(doc).tipo_documento === 'estratto_conto') s += 5
  return s
}

function buildRequeuePlan(fatture, documenti, nameMap) {
  const delete_fattura_ids = fatture
    .filter((f) => {
      const nome = f.fornitore_id ? nameMap.get(f.fornitore_id) : null
      return fatturaLooksLikePhantomStatement(f, nome)
    })
    .map((f) => f.id)

  const fileUrlsFromFatture = new Set(
    fatture.filter((f) => f.file_url?.trim()).map((f) => f.file_url.trim()),
  )

  const candidateDocs = documenti.filter(
    (d) =>
      d.file_url?.trim() &&
      (docLooksLikeMisclassifiedStatement(d) || fileUrlsFromFatture.has(d.file_url.trim())),
  )

  const byFile = new Map()
  for (const d of candidateDocs) {
    const url = d.file_url.trim()
    const arr = byFile.get(url) ?? []
    arr.push(d)
    byFile.set(url, arr)
  }

  const requeue = []
  const skip_doc_ids = []
  for (const [file_url, items] of byFile) {
    const keep = [...items].sort((a, b) => {
      const ds = docRequeueStrength(b) - docRequeueStrength(a)
      if (ds !== 0) return ds
      return String(a.id).localeCompare(String(b.id))
    })[0]
    requeue.push({ doc_id: keep.id, file_url, file_name: keep.file_name })
    for (const d of items) {
      if (d.id !== keep.id) skip_doc_ids.push(d.id)
    }
  }

  return { delete_fattura_ids, requeue, skip_doc_ids }
}

loadEnv()

const dryRun = process.argv.includes('--dry-run')
let sedeId = null
let fornitoreId = null
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--sede-id=')) sedeId = a.slice('--sede-id='.length)
  if (a.startsWith('--fornitore-id=')) fornitoreId = a.slice('--fornitore-id='.length)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Mancano NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!sedeId) {
  console.error(
    'Uso: node scripts/requeue-eden-springs-statements.mjs --sede-id=<uuid> [--dry-run] [--fornitore-id=<uuid>]',
  )
  process.exit(1)
}

const supabase = createClient(url, key)

let fornitoreIds = []
if (fornitoreId) {
  fornitoreIds = [fornitoreId]
} else {
  const { data: allF } = await supabase.from('fornitori').select('id, nome, display_name')
  fornitoreIds = (allF ?? [])
    .filter((f) => supplierNameLooksLikeEdenSprings(f.display_name || f.nome))
    .map((f) => f.id)
}

if (!fornitoreIds.length) {
  console.log('Nessun fornitore Eden Springs trovato.')
  process.exit(0)
}

const { data: fatture, error: fErr } = await supabase
  .from('fatture')
  .select(
    'id, fornitore_id, sede_id, data, importo, numero_fattura, file_url, bolla_id, approval_status',
  )
  .eq('sede_id', sedeId)
  .in('fornitore_id', fornitoreIds)
  .limit(5000)

if (fErr) {
  console.error(fErr.message)
  process.exit(1)
}

const { data: documenti, error: dErr } = await supabase
  .from('documenti_da_processare')
  .select('id, file_url, file_name, stato, fornitore_id, fattura_id, metadata, is_statement')
  .eq('sede_id', sedeId)
  .in('fornitore_id', fornitoreIds)
  .limit(5000)

if (dErr) {
  console.error(dErr.message)
  process.exit(1)
}

const { data: fnRows } = await supabase.from('fornitori').select('id, nome, display_name').in('id', fornitoreIds)
const nameMap = new Map()
for (const f of fnRows ?? []) nameMap.set(f.id, f.display_name || f.nome)

const plan = buildRequeuePlan(fatture ?? [], documenti ?? [], nameMap)

console.log(
  `${dryRun ? '[DRY-RUN]' : '[APPLY]'} Eden Springs statement requeue — ` +
    `${plan.delete_fattura_ids.length} fatture fantasma, ${plan.requeue.length} PDF in coda statement`,
)

if (dryRun) {
  console.log(JSON.stringify({ fornitore_ids: fornitoreIds, plan }, null, 2))
  process.exit(0)
}

if (plan.delete_fattura_ids.length) {
  await supabase
    .from('statement_rows')
    .update({ fattura_id: null, fattura_numero: null })
    .in('fattura_id', plan.delete_fattura_ids)
  await supabase
    .from('statements')
    .update({ linked_fattura_id: null })
    .in('linked_fattura_id', plan.delete_fattura_ids)
  await supabase
    .from('documenti_da_processare')
    .update({ fattura_id: null })
    .in('fattura_id', plan.delete_fattura_ids)

  for (let i = 0; i < plan.delete_fattura_ids.length; i += 200) {
    const slice = plan.delete_fattura_ids.slice(i, i + 200)
    await supabase.from('fatture').delete().in('id', slice)
  }
}

for (const item of plan.requeue) {
  const doc = (documenti ?? []).find((d) => d.id === item.doc_id)
  const prevMeta = docMeta(doc ?? {})
  const nextMeta = {
    ...prevMeta,
    pending_kind: 'statement',
    tipo_documento: 'estratto_conto',
  }
  if (
    typeof nextMeta.numero_fattura === 'string' &&
    fatturaNumeroIsMisused(nextMeta.numero_fattura, nameMap.get(doc?.fornitore_id ?? '') ?? null)
  ) {
    delete nextMeta.numero_fattura
  }

  await supabase
    .from('documenti_da_processare')
    .update({
      is_statement: true,
      stato: 'da_processare',
      fattura_id: null,
      bolla_id: null,
      metadata: nextMeta,
    })
    .eq('id', item.doc_id)
}

if (plan.skip_doc_ids.length) {
  await supabase
    .from('documenti_da_processare')
    .update({ is_statement: false, stato: 'associato', fattura_id: null })
    .in('id', plan.skip_doc_ids)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      sede_id: sedeId,
      fornitore_ids: fornitoreIds,
      deleted_phantom_fatture: plan.delete_fattura_ids.length,
      requeued_statements: plan.requeue.length,
      skipped_duplicate_docs: plan.skip_doc_ids.length,
      next_step:
        'Apri Eden Springs → tab Verifica (Estratti Conto) oppure /statements/verifica per elaborare i PDF.',
    },
    null,
    2,
  ),
)
