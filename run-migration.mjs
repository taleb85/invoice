// run-migration.mjs
// Esegue la migrazione direttamente sul database Supabase.
// Utilizzo:
//   DB_PASSWORD=<password-del-db> node run-migration.mjs

import postgres from 'postgres'

const REF = 'dubocvwsdzrqrrxsedas'
const DB_PASSWORD = process.env.DB_PASSWORD

if (!DB_PASSWORD) {
  console.error('Manca DB_PASSWORD. Eseguilo così:')
  console.error('  DB_PASSWORD=<password> node run-migration.mjs')
  console.error('\nTrovi la password in:')
  console.error('  Supabase Dashboard → Project Settings → Database → "Database password"')
  process.exit(1)
}

const sql = postgres({
  host: `aws-0-eu-west-1.pooler.supabase.com`,
  port: 5432,
  database: 'postgres',
  username: `postgres.${REF}`,
  password: DB_PASSWORD,
  ssl: 'require',
  max: 1,
})

const STATEMENTS = [
  `create table if not exists public.documenti_da_processare (
    id            uuid        primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    fornitore_id  uuid        references public.fornitori(id) on delete set null,
    sede_id       uuid        references public.sedi(id)     on delete set null,
    mittente      text        not null,
    oggetto_mail  text,
    file_url      text        not null,
    file_name     text,
    content_type  text,
    data_documento date,
    stato         text        not null default 'in_attesa'
                    check (stato in ('in_attesa', 'associato', 'scartato')),
    bolla_id      uuid        references public.bolle(id) on delete set null,
    fattura_id    uuid        references public.fatture(id) on delete set null,
    note          text
  )`,
  `alter table public.documenti_da_processare enable row level security`,
  `drop policy if exists "documenti_processare: select" on public.documenti_da_processare`,
  `drop policy if exists "documenti_processare: insert" on public.documenti_da_processare`,
  `drop policy if exists "documenti_processare: update" on public.documenti_da_processare`,
  `drop policy if exists "documenti_processare: delete" on public.documenti_da_processare`,
  `create policy "documenti_processare: select" on public.documenti_da_processare for select to authenticated using (public.is_admin() or sede_id = public.get_user_sede())`,
  `create policy "documenti_processare: insert" on public.documenti_da_processare for insert to authenticated with check (public.is_admin() or sede_id = public.get_user_sede())`,
  `create policy "documenti_processare: update" on public.documenti_da_processare for update to authenticated using (public.is_admin() or sede_id = public.get_user_sede())`,
  `create policy "documenti_processare: delete" on public.documenti_da_processare for delete to authenticated using (public.is_admin() or sede_id = public.get_user_sede())`,
  `alter table public.log_sincronizzazione enable row level security`,
  `drop policy if exists "log: select" on public.log_sincronizzazione`,
  `drop policy if exists "log: insert" on public.log_sincronizzazione`,
  `drop policy if exists "log: update" on public.log_sincronizzazione`,
  `drop policy if exists "log: delete" on public.log_sincronizzazione`,
  `create policy "log: select" on public.log_sincronizzazione for select to authenticated using (public.is_admin() or fornitore_id in (select id from public.fornitori where sede_id = public.get_user_sede()) or fornitore_id is null)`,
  `create policy "log: insert" on public.log_sincronizzazione for insert to authenticated with check (true)`,
  `create policy "log: update" on public.log_sincronizzazione for update to authenticated using (public.is_admin())`,
  `create policy "log: delete" on public.log_sincronizzazione for delete to authenticated using (public.is_admin() or fornitore_id in (select id from public.fornitori where sede_id = public.get_user_sede()))`,
  `create index if not exists idx_fornitori_email on public.fornitori (lower(email))`,
  `create index if not exists idx_fornitore_emails_email on public.fornitore_emails (lower(email))`,
  `create index if not exists idx_bolle_fornitore_stato on public.bolle (fornitore_id, stato)`,
  `create index if not exists idx_fatture_bolla_id on public.fatture (bolla_id)`,
  `create index if not exists idx_documenti_stato on public.documenti_da_processare (stato, created_at desc)`,
  `create index if not exists idx_documenti_fornitore_stato on public.documenti_da_processare (fornitore_id, stato)`,
  `create index if not exists idx_log_data on public.log_sincronizzazione (data desc)`,
]

let ok = 0
let fail = 0
for (const stmt of STATEMENTS) {
  const label = stmt.trim().slice(0, 60).replace(/\s+/g, ' ')
  try {
    await sql.unsafe(stmt)
    console.log(`✅  ${label}`)
    ok++
  } catch (e) {
    console.error(`❌  ${label}`)
    console.error(`    ${e.message}`)
    fail++
  }
}

await sql.end()
console.log(`\n✅ ${ok} eseguiti  ${fail > 0 ? `❌ ${fail} falliti` : '— nessun errore'}`)
process.exit(fail > 0 ? 1 : 0)
