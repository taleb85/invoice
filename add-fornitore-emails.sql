-- Tabella alias email per fornitore
create table if not exists public.fornitore_emails (
  id           uuid primary key default gen_random_uuid(),
  fornitore_id uuid not null references public.fornitori(id) on delete cascade,
  email        text not null,
  label        text,
  created_at   timestamptz not null default now(),
  unique (fornitore_id, email)
);

alter table public.fornitore_emails enable row level security;

-- Admin e operatori della stessa sede possono leggere
create policy "Lettura fornitore_emails per sede" on public.fornitore_emails
  for select using (
    exists (
      select 1 from public.fornitori f
      join public.profiles pr on pr.sede_id = f.sede_id
      where f.id = fornitore_emails.fornitore_id
        and pr.id = auth.uid()
    )
  );

-- Solo admin possono inserire/aggiornare/eliminare
create policy "Scrittura fornitore_emails solo admin" on public.fornitore_emails
  for all using (
    exists (
      select 1 from public.fornitori f
      join public.profiles pr on pr.sede_id = f.sede_id
      where f.id = fornitore_emails.fornitore_id
        and pr.id = auth.uid()
        and pr.role = 'admin'
    )
  );
