-- Alcuni database hanno la tabella `fatture` senza `updated_at` (schema antico).
-- Aggiunge la colonna con default così non si rompe nulla e resta allineato a `supabase/schema.sql`.

alter table public.fatture
  add column if not exists updated_at timestamptz not null default now();
