#!/usr/bin/env node
/**
 * Aggiorna profiles.role con il service role (by-pass RLS). Utile se il salvataggio dalla UI fallisce.
 *
 * Uso:
 *   node scripts/set-operator-role.mjs [nomeParziale] [ruolo]
 *
 * Esempi:
 *   node scripts/set-operator-role.mjs taleb admin_sede
 *   node scripts/set-operator-role.mjs TALEB operatore
 *
 * Variabili (da .env.local o ambiente):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ALLOWED = ['operatore', 'admin_sede', 'admin']

function loadEnvLocal(p) {
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envMerged = { ...process.env, ...loadEnvLocal(resolve(root, '.env.local')) }
const url = envMerged.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = envMerged.SUPABASE_SERVICE_ROLE_KEY?.trim()

const namePattern = (process.argv[2] ?? 'taleb').trim()
const roleTarget = (process.argv[3] ?? 'admin_sede').trim().toLowerCase()

if (!url || !key) {
  console.error('❌ Imposta NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local o shell).')
  process.exit(1)
}

if (!ALLOWED.includes(roleTarget)) {
  console.error(`❌ Ruolo non valido: ${roleTarget}. Ammessi: ${ALLOWED.join(', ')}`)
  process.exit(1)
}

async function main() {
  const supabase = createClient(url, key)
  const needle = namePattern.replace(/%/g, '').trim()
  if (!needle) {
    console.error('❌ Nome vuoto.')
    process.exit(1)
  }

  const upper = needle.toUpperCase()

  let pool = []
  const eqRes = await supabase
    .from('profiles')
    .select('id,full_name,email,role,sede_id')
    .eq('full_name', upper)
  if (!eqRes.error && (eqRes.data?.length ?? 0) > 0) {
    pool = eqRes.data ?? []
  }
  if (pool.length === 0) {
    const likeRes = await supabase
      .from('profiles')
      .select('id,full_name,email,role,sede_id')
      .ilike('full_name', `%${needle}%`)
    if (likeRes.error) {
      console.error('❌ Query profili:', likeRes.error.message)
      process.exit(1)
    }
    pool = likeRes.data ?? []
  }
  const interno = pool.filter((r) => String(r.email ?? '').includes('@interno.fluxo'))
  if (interno.length >= 1) pool = interno

  if (pool.length === 0) {
    console.error(`❌ Nessun profilo trovato per "${needle}".`)
    process.exit(1)
  }

  if (pool.length > 1) {
    console.error(`❌ Troppi profili (${pool.length}), specifica meglio il nome o correggi manualmente in SQL:\n`)
    for (const r of pool) {
      console.error(`   id=${r.id} name=${r.full_name} email=${r.email} role=${r.role} sede_id=${r.sede_id}`)
    }
    process.exit(1)
  }

  const row = pool[0]

  const { data: updated, error: upErr } = await supabase
    .from('profiles')
    .update({ role: roleTarget })
    .eq('id', row.id)
    .select('id,full_name,email,role,sede_id')
    .maybeSingle()

  if (upErr) {
    console.error('❌ Aggiornamento:', upErr.message)
    if (/check constraint|profiles_role_check/i.test(upErr.message)) {
      console.error('\n   Suggerimento: il CHECK su profiles.role sul DB non include il ruolo richiesto.')
      console.error('   Esegui le migration Supabase del repo (o aggiungi il valore nel CHECK sul progetto).')
    }
    process.exit(1)
  }

  console.log('✓ Profilo aggiornato:\n', JSON.stringify(updated, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
