#!/usr/bin/env node
/**
 * Azzera coda documenti, log sync, opzionalmente fatture/bolle/fornitori.
 *
 * Prerequisiti:
 *   NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Legge .env.local se le variabili non sono già nell’ambiente.
 *
 * Uso:
 *   node scripts/reset-email-scan-state.mjs
 *   node scripts/reset-email-scan-state.mjs --purge-all-logs
 *   node scripts/reset-email-scan-state.mjs --with-bozze
 *   node scripts/reset-email-scan-state.mjs --with-fatture-non-verificate
 *
 * Elimina TUTTI i fornitori (e quindi tutte le fatture e tutte le bolle: vincoli RESTRICT):
 *   node scripts/reset-email-scan-state.mjs --with-fornitori
 *   (azzera anche tutto il log, come --purge-all-logs)
 *
 * Combinazione “tutto” precedente + fornitori:
 *   node scripts/reset-email-scan-state.mjs --with-fornitori
 *
 * Poi: dalla app rilancia la sincronizzazione email (anche mail già lette, nella finestra IMAP).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const DUMMY_UUID = '00000000-0000-0000-0000-000000000000'

function loadEnvLocal() {
  const p = resolve(root, '.env.local')
  if (!existsSync(p)) return
  const text = readFileSync(p, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

const purgeAllLogs = process.argv.includes('--purge-all-logs')
const withBozze = process.argv.includes('--with-bozze')
const withFattureNonVerificate = process.argv.includes('--with-fatture-non-verificate')
const withFornitori = process.argv.includes('--with-fornitori')

const effectivePurgeAllLogs = purgeAllLogs || withFornitori

async function main() {
  if (!url || !key) {
    console.error(
      'Mancano NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.',
    )
    process.exit(1)
  }

  const supabase = createClient(url, key)

  console.log('Eliminazione righe in documenti_da_processare…')
  const { error: e1 } = await supabase.from('documenti_da_processare').delete().neq('id', DUMMY_UUID)
  if (e1) {
    console.error('Errore documenti_da_processare:', e1.message)
    process.exit(1)
  }

  if (effectivePurgeAllLogs) {
    console.log('Eliminazione di tutte le righe in log_sincronizzazione…')
    const { error: e2 } = await supabase.from('log_sincronizzazione').delete().neq('id', DUMMY_UUID)
    if (e2) {
      console.error('Errore log_sincronizzazione:', e2.message)
      process.exit(1)
    }
  } else {
    console.log('Eliminazione log con scan_attachment_fingerprint valorizzato…')
    const { error: e2 } = await supabase
      .from('log_sincronizzazione')
      .delete()
      .not('scan_attachment_fingerprint', 'is', null)
    if (e2) {
      console.error('Errore log_sincronizzazione (fingerprint):', e2.message)
      process.exit(1)
    }
  }

  if (withFornitori) {
    console.log('Eliminazione di tutte le fatture (--with-fornitori, vincoli verso bolle)…')
    const { error: eF } = await supabase.from('fatture').delete().neq('id', DUMMY_UUID)
    if (eF) {
      console.error('Errore fatture:', eF.message)
      process.exit(1)
    }
    console.log('Eliminazione di tutte le bolle…')
    const { error: eB } = await supabase.from('bolle').delete().neq('id', DUMMY_UUID)
    if (eB) {
      console.error('Errore bolle:', eB.message)
      process.exit(1)
    }
    console.log('Eliminazione di tutti i fornitori (fornitore_emails / listino / contatti: CASCADE)…')
    const { error: eFo } = await supabase.from('fornitori').delete().neq('id', DUMMY_UUID)
    if (eFo) {
      console.error('Errore fornitori:', eFo.message)
      process.exit(1)
    }
  } else {
    if (withFattureNonVerificate) {
      console.log(
        'Eliminazione fatture con verificata_estratto_conto = false (--with-fatture-non-verificate)…',
      )
      const { error: eF } = await supabase
        .from('fatture')
        .delete()
        .eq('verificata_estratto_conto', false)
      if (eF) {
        console.error('Errore fatture non verificate:', eF.message)
        process.exit(1)
      }
    }

    if (withBozze) {
      console.log('Eliminazione bolle in stato bozza (--with-bozze)…')
      const { error: e3 } = await supabase.from('bolle').delete().eq('stato', 'bozza')
      if (e3) {
        console.error('Errore bolle bozza:', e3.message)
        process.exit(1)
      }
    }
  }

  console.log('\nFatto.')
  console.log('1) Segna come NON LETTE le email da riprocessare (IMAP).')
  console.log('2) Avvia “Sincronizza email” dalla dashboard o dalla pagina Log.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
