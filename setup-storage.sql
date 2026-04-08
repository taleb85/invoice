-- =============================================================
-- Setup Storage – bucket pubblico "documenti"
-- Esegui questo script nell'SQL Editor del tuo progetto Supabase
-- =============================================================

-- 1. Crea il bucket "documenti" come pubblico
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documenti',
  'documenti',
  true,                                    -- accesso pubblico in lettura
  10485760,                                -- limite 10 MB per file
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set public            = true,
      file_size_limit   = 10485760,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','application/pdf'];

-- 2. Policy: lettura pubblica (chiunque può leggere i file)
create policy "Lettura pubblica documenti"
  on storage.objects for select
  using (bucket_id = 'documenti');

-- 3. Policy: inserimento aperto a tutti (autenticati e anonimi)
create policy "Inserimento pubblico documenti"
  on storage.objects for insert
  with check (bucket_id = 'documenti');

-- 4. Policy: eliminazione aperta a tutti
create policy "Eliminazione pubblica documenti"
  on storage.objects for delete
  using (bucket_id = 'documenti');
