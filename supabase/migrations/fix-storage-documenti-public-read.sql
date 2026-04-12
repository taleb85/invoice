-- Bucket "documenti" leggibile pubblicamente (link diretti /object/public/… senza cookie).
-- Idempotente: ripristina lettura se qualche policy l’aveva ristretta.

update storage.buckets
set public = true
where id = 'documenti';

drop policy if exists "Lettura pubblica documenti" on storage.objects;

create policy "Lettura pubblica documenti"
  on storage.objects
  for select
  using (bucket_id = 'documenti');
