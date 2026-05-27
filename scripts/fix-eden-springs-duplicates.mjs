#!/usr/bin/env node
/**
 * Bonifica Eden Springs UK — Account No. come numero fattura + duplicati (diretto su Supabase).
 *
 *   node scripts/fix-eden-springs-duplicates.mjs --sede-id=<uuid> [--dry-run] [--fornitore-id=<uuid>]
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

function strength(f) {
  let s = 0
  if (f.bolla_id) s += 1000
  const num = f.numero_fattura?.trim()
  if (num && !numeroLooksLikeUkAccount(num)) s += 100
  if (f.importo != null) s += 10
  if (f.approval_status === 'approved') s += 5
  return s
}

function pickKeep(group) {
  return [...group].sort((a, b) => {
    const ds = strength(b) - strength(a)
    if (ds !== 0) return ds
    return String(a.id).localeCompare(String(b.id))
  })[0]
}

function buildPlan(fatture, nameMap) {
  const clear_numero = []
  for (const f of fatture) {
    const nome = f.fornitore_id ? nameMap.get(f.fornitore_id) : null
    if (fatturaNumeroIsMisused(f.numero_fattura, nome)) {
      clear_numero.push({ fattura_id: f.id, old_numero: f.numero_fattura.trim(), fornitore_nome: nome })
    }
  }

  const deleteIdSet = new Set()
  const duplicate_groups = []

  const byFile = new Map()
  for (const f of fatture) {
    if (!f.file_url) continue
    const arr = byFile.get(f.file_url) ?? []
    arr.push(f)
    byFile.set(f.file_url, arr)
  }
  for (const [file_url, items] of byFile) {
    if (items.length < 2) continue
    const keep = pickKeep(items)
    const delete_ids = items.filter((x) => x.id !== keep.id).map((x) => x.id)
    delete_ids.forEach((id) => deleteIdSet.add(id))
    duplicate_groups.push({ group_key: `file:${file_url}`, keep_id: keep.id, delete_ids, count: items.length })
  }

  const byNumero = new Map()
  for (const f of fatture) {
    if (deleteIdSet.has(f.id)) continue
    const num = f.numero_fattura?.trim()
    if (!num || !f.fornitore_id || !f.data) continue
    const k = `${f.fornitore_id}|${f.data}|${num.toLowerCase()}`
    const arr = byNumero.get(k) ?? []
    arr.push(f)
    byNumero.set(k, arr)
  }
  for (const [k, items] of byNumero) {
    if (items.length < 2) continue
    const keep = pickKeep(items)
    const delete_ids = items.filter((x) => x.id !== keep.id).map((x) => x.id)
    delete_ids.forEach((id) => deleteIdSet.add(id))
    duplicate_groups.push({ group_key: `numero:${k}`, keep_id: keep.id, delete_ids, count: items.length })
  }

  const byDay = new Map()
  for (const f of fatture) {
    if (deleteIdSet.has(f.id)) continue
    if (!f.fornitore_id || !f.data) continue
    const k = `${f.fornitore_id}|${f.data}`
    const arr = byDay.get(k) ?? []
    arr.push(f)
    byDay.set(k, arr)
  }
  for (const [k, items] of byDay) {
    if (items.length < 3) continue
    const keep = pickKeep(items)
    const delete_ids = items.filter((x) => x.id !== keep.id).map((x) => x.id)
    const fresh = delete_ids.filter((id) => !deleteIdSet.has(id))
    if (!fresh.length) continue
    fresh.forEach((id) => deleteIdSet.add(id))
    duplicate_groups.push({ group_key: `cluster:${k}`, keep_id: keep.id, delete_ids: fresh, count: items.length })
  }

  return { clear_numero, duplicate_groups, delete_ids: [...deleteIdSet] }
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
  console.error('Uso: node scripts/fix-eden-springs-duplicates.mjs --sede-id=<uuid> [--dry-run] [--fornitore-id=<uuid>]')
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
  .order('data', { ascending: true })
  .order('id', { ascending: true })
  .limit(5000)

if (fErr) {
  console.error(fErr.message)
  process.exit(1)
}

const rows = fatture ?? []
const { data: fnRows } = await supabase.from('fornitori').select('id, nome, display_name').in('id', fornitoreIds)
const nameMap = new Map()
for (const f of fnRows ?? []) nameMap.set(f.id, f.display_name || f.nome)

const plan = buildPlan(rows, nameMap)

console.log(`${dryRun ? '[DRY-RUN]' : '[APPLY]'} Eden Springs — ${rows.length} fatture, ${plan.clear_numero.length} numeri da azzerare, ${plan.delete_ids.length} duplicati da eliminare`)

if (dryRun) {
  console.log(JSON.stringify({ fornitore_ids: fornitoreIds, plan }, null, 2))
  process.exit(0)
}

let cleared = 0
for (const c of plan.clear_numero) {
  if (plan.delete_ids.includes(c.fattura_id)) continue
  const { error } = await supabase.from('fatture').update({ numero_fattura: null }).eq('id', c.fattura_id)
  if (!error) cleared++
}

if (plan.delete_ids.length) {
  await supabase
    .from('statement_rows')
    .update({ fattura_id: null, fattura_numero: null })
    .in('fattura_id', plan.delete_ids)
  await supabase.from('statements').update({ linked_fattura_id: null }).in('linked_fattura_id', plan.delete_ids)
}

let deleted = 0
for (let i = 0; i < plan.delete_ids.length; i += 200) {
  const slice = plan.delete_ids.slice(i, i + 200)
  const { count } = await supabase.from('fatture').delete({ count: 'exact' }).in('id', slice)
  deleted += count ?? slice.length
}

console.log(JSON.stringify({ ok: true, cleared_numero: cleared, deleted_duplicates: deleted, fornitore_ids: fornitoreIds }, null, 2))
