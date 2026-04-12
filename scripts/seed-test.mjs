/**
 * Seed script: crea la sede "Mediterraneo - TEST" con fornitori, bolle e fattura di test.
 * Esegui con: node scripts/seed-test.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dubocvwsdzrqrrxsedas.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Ym9jdndzZHpycXJyeHNlZGFzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5ODgwMiwiZXhwIjoyMDkxMTc0ODAyfQ.7-095FKFB_jNi5zTtOSyHJH-9ZR1x0_R0Nx01Gi_gbQ'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const today = new Date().toISOString().slice(0, 10)

async function seed() {
  console.log('🌱 Avvio seed Mediterraneo - TEST…\n')

  // ─── 1. SEDE ────────────────────────────────────────────────────────────────
  console.log('📍 Creo sede "Mediterraneo - TEST"…')

  // Controlla se esiste già per evitare duplicati
  const { data: existing } = await supabase
    .from('sedi')
    .select('id, nome')
    .eq('nome', 'Mediterraneo - TEST')
    .maybeSingle()

  let sedeId
  if (existing) {
    sedeId = existing.id
    console.log(`   ↳ Sede già presente (id=${sedeId}), riutilizzo.`)
  } else {
    const { data: newSede, error: sedeErr } = await supabase
      .from('sedi')
      .insert([{
        nome:          'Mediterraneo - TEST',
        country_code:  'UK',
        imap_host:     'imap.gmail.com',
        imap_port:     993,
        imap_user:     'talubagrande@gmail.com',
        imap_password: 'mock-app-password-placeholder',
      }])
      .select('id')
      .single()

    if (sedeErr) { console.error('❌ Errore creazione sede:', sedeErr.message); process.exit(1) }
    sedeId = newSede.id
    console.log(`   ↳ Creata! id=${sedeId}`)
  }

  // ─── 2. FORNITORI ───────────────────────────────────────────────────────────
  console.log('\n🏢 Creo fornitori…')

  async function upsertFornitore(nome) {
    const { data: ex } = await supabase
      .from('fornitori').select('id').eq('nome', nome).eq('sede_id', sedeId).maybeSingle()
    if (ex) { console.log(`   ↳ "${nome}" già presente (id=${ex.id})`); return ex.id }
    const { data, error } = await supabase
      .from('fornitori').insert([{ nome, sede_id: sedeId, email: `${nome.toLowerCase().replace(/\s+/g,'-')}@example.com` }]).select('id').single()
    if (error) { console.error(`   ❌ "${nome}":`, error.message); process.exit(1) }
    console.log(`   ↳ "${nome}" creato (id=${data.id})`)
    return data.id
  }

  const oralBId  = await upsertFornitore('Oral-B UK')
  const amalfiId = await upsertFornitore('Amalfi Produce London')

  // ─── 3. BOLLE ───────────────────────────────────────────────────────────────
  console.log('\n📦 Creo bolle…')

  async function upsertBolla({ numero_bolla, fornitore_id, importo, stato }) {
    const { data: ex } = await supabase
      .from('bolle').select('id').eq('numero_bolla', numero_bolla).eq('sede_id', sedeId).maybeSingle()
    if (ex) { console.log(`   ↳ Bolla ${numero_bolla} già presente (id=${ex.id})`); return ex.id }
    const { data, error } = await supabase
      .from('bolle')
      .insert([{ numero_bolla, fornitore_id, sede_id: sedeId, data: today, importo, stato, file_url: '' }])
      .select('id').single()
    if (error) { console.error(`   ❌ Bolla ${numero_bolla}:`, error.message); process.exit(1) }
    console.log(`   ↳ Bolla #${numero_bolla} creata (id=${data.id}, £${importo})`)
    return data.id
  }

  const bollaOBId  = await upsertBolla({ numero_bolla: 'OB-TEST-01', fornitore_id: oralBId,  importo: 25.00,  stato: 'in attesa'  })
  const bollaAM01Id = await upsertBolla({ numero_bolla: 'AM-01',      fornitore_id: amalfiId, importo: 80.00,  stato: 'completato' })
  const bollaAM02Id = await upsertBolla({ numero_bolla: 'AM-02',      fornitore_id: amalfiId, importo: 120.00, stato: 'completato' })

  // Soppresso, ma utile per verifiche future
  void bollaOBId

  // ─── 4. FATTURA ─────────────────────────────────────────────────────────────
  console.log('\n🧾 Creo fattura #INV-AM-101…')

  let fatturaId
  const { data: exF } = await supabase
    .from('fatture').select('id').eq('numero_fattura', 'INV-AM-101').eq('sede_id', sedeId).maybeSingle()

  if (exF) {
    fatturaId = exF.id
    console.log(`   ↳ Fattura già presente (id=${fatturaId}), riutilizzo.`)
  } else {
    const { data: newF, error: fErr } = await supabase
      .from('fatture')
      .insert([{
        fornitore_id:             amalfiId,
        bolla_id:                 bollaAM01Id,  // backward compat
        sede_id:                  sedeId,
        data:                     today,
        numero_fattura:           'INV-AM-101',
        importo:                  200.00,
        verificata_estratto_conto: false,
        file_url:                 '',
      }])
      .select('id').single()

    if (fErr) { console.error('❌ Errore fattura:', fErr.message); process.exit(1) }
    fatturaId = newF.id
    console.log(`   ↳ Fattura #INV-AM-101 creata (id=${fatturaId}, £200.00)`)
  }

  // ─── 5. JUNCTION fattura_bolle ───────────────────────────────────────────────
  console.log('\n🔗 Collego bolle AM-01 + AM-02 alla fattura…')

  for (const [bollaId, label] of [[bollaAM01Id, 'AM-01'], [bollaAM02Id, 'AM-02']]) {
    const { data: exJ } = await supabase
      .from('fattura_bolle').select('fattura_id')
      .eq('fattura_id', fatturaId).eq('bolla_id', bollaId).maybeSingle()

    if (exJ) {
      console.log(`   ↳ Link fattura ↔ ${label} già presente`)
    } else {
      const { error: jErr } = await supabase
        .from('fattura_bolle').insert([{ fattura_id: fatturaId, bolla_id: bollaId }])
      if (jErr) console.warn(`   ⚠ Link ${label}:`, jErr.message)
      else      console.log(`   ↳ Collegato ${label} ✓`)
    }
  }

  // ─── RIEPILOGO ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed completato!\n')
  console.log('─────────────────────────────────────────')
  console.log(`Sede ID  : ${sedeId}`)
  console.log(`Oral-B UK: ${oralBId}`)
  console.log(`Amalfi   : ${amalfiId}`)
  console.log(`Fattura  : ${fatturaId}`)
  console.log('─────────────────────────────────────────')
  console.log('\nNel browser, vai su Sedi → "Mediterraneo - TEST" per vedere i dati.\n')
  console.log('Per testare la Riconcilia, incolla nel campo testo:')
  console.log('  INV-AM-101 200.00')
  console.log('  OB-TEST-01 25.00')
  console.log()
}

seed().catch(err => { console.error('💥 Seed fallito:', err); process.exit(1) })
