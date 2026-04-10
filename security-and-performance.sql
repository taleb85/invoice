-- ============================================================
-- security-and-performance.sql
-- Eseguire nel SQL Editor di Supabase
-- ============================================================
-- Contiene:
--   1. Tabella documenti_da_processare (allegati email da revisionare)
--   2. RLS su log_sincronizzazione e documenti_da_processare
--   3. Indici di performance
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. Tabella documenti_da_processare
--    Raccoglie gli allegati email in attesa di revisione manuale
-- ──────────────────────────────────────────────────────────────
create table if not exists public.documenti_da_processare (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  fornitore_id  uuid        references public.fornitori(id) on delete set null,
  sede_id       uuid        references public.sedi(id)     on delete set null,
  mittente      text        not null,
  oggetto_mail  text,
  file_url      text        not null,
  file_name     text,
  content_type  text,
  data_documento date,          -- estratta via OCR
  stato         text        not null default 'in_attesa'
                  check (stato in ('in_attesa', 'associato', 'scartato')),
  bolla_id      uuid        references public.bolle(id) on delete set null,
  fattura_id    uuid        references public.fatture(id) on delete set null,
  note          text
);

alter table public.documenti_da_processare enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 2. RLS — documenti_da_processare
-- ──────────────────────────────────────────────────────────────
drop policy if exists "documenti_processare: select" on public.documenti_da_processare;
drop policy if exists "documenti_processare: insert" on public.documenti_da_processare;
drop policy if exists "documenti_processare: update" on public.documenti_da_processare;
drop policy if exists "documenti_processare: delete" on public.documenti_da_processare;

create policy "documenti_processare: select" on public.documenti_da_processare
  for select to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "documenti_processare: insert" on public.documenti_da_processare
  for insert to authenticated
  with check (public.is_admin() or sede_id = public.get_user_sede());

create policy "documenti_processare: update" on public.documenti_da_processare
  for update to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "documenti_processare: delete" on public.documenti_da_processare
  for delete to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());


-- ──────────────────────────────────────────────────────────────
-- 3. RLS — log_sincronizzazione
-- ──────────────────────────────────────────────────────────────
alter table public.log_sincronizzazione enable row level security;

drop policy if exists "log: select" on public.log_sincronizzazione;
drop policy if exists "log: insert" on public.log_sincronizzazione;
drop policy if exists "log: update" on public.log_sincronizzazione;
drop policy if exists "log: delete" on public.log_sincronizzazione;

-- Admin vede tutto; operatore vede i log del proprio fornitore (via sede)
create policy "log: select" on public.log_sincronizzazione
  for select to authenticated
  using (
    public.is_admin()
    or fornitore_id in (
      select id from public.fornitori where sede_id = public.get_user_sede()
    )
    or fornitore_id is null  -- log "fornitore non trovato" visibili a tutti gli autenticati
  );

create policy "log: insert" on public.log_sincronizzazione
  for insert to authenticated
  with check (true);  -- insert gestito lato server (service_role / anon con RLS skip)

create policy "log: update" on public.log_sincronizzazione
  for update to authenticated
  using (public.is_admin());

create policy "log: delete" on public.log_sincronizzazione
  for delete to authenticated
  using (
    public.is_admin()
    or fornitore_id in (
      select id from public.fornitori where sede_id = public.get_user_sede()
    )
  );


-- ──────────────────────────────────────────────────────────────
-- 4. Indici di performance
-- ──────────────────────────────────────────────────────────────

-- Ricerca fornitore per email (usata in ogni scansione IMAP)
create index if not exists idx_fornitori_email
  on public.fornitori (lower(email));

-- Ricerca alias email per fornitore
create index if not exists idx_fornitore_emails_email
  on public.fornitore_emails (lower(email));

-- Bolle per fornitore e stato (query più frequenti)
create index if not exists idx_bolle_fornitore_stato
  on public.bolle (fornitore_id, stato);

-- Fatture per bolla
create index if not exists idx_fatture_bolla_id
  on public.fatture (bolla_id);

-- Documenti per stato (per la coda di revisione)
create index if not exists idx_documenti_stato
  on public.documenti_da_processare (stato, created_at desc);

-- Documenti per fornitore e stato
create index if not exists idx_documenti_fornitore_stato
  on public.documenti_da_processare (fornitore_id, stato);

-- Log per data (ordinamento più frequente)
create index if not exists idx_log_data
  on public.log_sincronizzazione (data desc);
