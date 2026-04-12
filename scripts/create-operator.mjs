/**
 * Crea l'operatore "Staff Mediterraneo" con PIN 1234 legato alla sede Mediterraneo - TEST.
 * Esegui con: node scripts/create-operator.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dubocvwsdzrqrrxsedas.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Ym9jdndzZHpycXJyeHNlZGFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5ODgwMiwiZXhwIjoyMDkxMTc0ODAyfQ.7-095FKFB_jNi5zTtOSyHJH-9ZR1x0_R0Nx01Gi_gbQ'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const OPERATOR_NAME = 'Staff Mediterraneo'
const PIN           = '1234'
const SEDE_ID       = '6cfbdfaa-2a48-408d-996b-0c5a592f74bc'  // Mediterraneo - TEST

async function main() {
  console.log('👤 Creazione operatore "Staff Mediterraneo"…\n')

  // ─── 1. Controlla se esiste già un profilo con questo nome ──────────────
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .ilike('full_name', OPERATOR_NAME)
    .maybeSingle()

  if (existing) {
    console.log(`⚠ Operatore già presente (id=${existing.id}, email=${existing.email})`)
    console.log('  Aggiorno solo la sede e il ruolo…')

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ sede_id: SEDE_ID, role: 'operatore', full_name: OPERATOR_NAME })
      .eq('id', existing.id)

    if (updErr) { console.error('❌ Errore update profilo:', updErr.message); process.exit(1) }
    console.log('  ✓ Profilo aggiornato.')
    printSummary(existing.email)
    return
  }

  // ─── 2. Genera email interna (mai visibile all'operatore) ───────────────
  const slug     = OPERATOR_NAME.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')
  const rand     = Math.random().toString(36).slice(2, 7)
  const intEmail = `${slug}_${rand}@interno.fluxo`

  console.log(`📧 Email interna: ${intEmail}`)

  // ─── 3. Crea l'utente in Supabase Auth ──────────────────────────────────
  const { data: newUser, error: authErr } = await supabase.auth.admin.createUser({
    email:         intEmail,
    password:      PIN,
    email_confirm: true,
    user_metadata: { full_name: OPERATOR_NAME, display_name: OPERATOR_NAME },
  })

  if (authErr) {
    console.error('❌ Errore creazione Auth user:', authErr.message)
    process.exit(1)
  }

  const userId = newUser.user.id
  console.log(`✓ Auth user creato (id=${userId})`)

  // ─── 4. Aggiorna il profilo (row già creata da trigger) ─────────────────
  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      sede_id:   SEDE_ID,
      role:      'operatore',
      full_name: OPERATOR_NAME,
      email:     intEmail,
    })
    .eq('id', userId)

  if (profErr) {
    console.error('❌ Errore update profilo:', profErr.message)
    console.log('  Provo con insert…')
    const { error: insErr } = await supabase
      .from('profiles')
      .insert([{ id: userId, sede_id: SEDE_ID, role: 'operatore', full_name: OPERATOR_NAME, email: intEmail }])
    if (insErr) { console.error('❌ Errore insert profilo:', insErr.message); process.exit(1) }
  }

  console.log('✓ Profilo operatore configurato.')
  printSummary(intEmail)
}

function printSummary(email) {
  console.log('\n' + '─'.repeat(50))
  console.log('✅ Operatore pronto!\n')
  console.log(`  Nome visualizzato : ${OPERATOR_NAME}`)
  console.log(`  PIN               : ${PIN}`)
  console.log(`  Sede              : Mediterraneo - TEST`)
  console.log(`  Email interna     : ${email}`)
  console.log('─'.repeat(50))
  console.log('\nPer accedere, vai su /login e:')
  console.log('  1. Inserisci nome: "Staff Mediterraneo"')
  console.log('  2. Inserisci PIN: 1234')
  console.log('  → Il sistema ti porta direttamente nella sede Mediterraneo - TEST\n')
}

main().catch(err => { console.error('💥 Errore:', err); process.exit(1) })
