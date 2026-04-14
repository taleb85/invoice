-- Eventi flusso Scanner AI (/bolle/new): elaborazione hub e salvataggio in archivio.
-- Dashboard: conteggi giornalieri per sede (indipendenti dalla singola scheda fornitore).

create table if not exists public.scanner_flow_events (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references public.sedi (id) on delete cascade,
  created_at timestamptz not null default now(),
  step text not null check (
    step in (
      'ai_elaborata',
      'archiviata_bolla',
      'archiviata_fattura'
    )
  )
);

create index if not exists idx_scanner_flow_events_sede_created
  on public.scanner_flow_events (sede_id, created_at desc);

comment on table public.scanner_flow_events is
  'Traccia scansioni: ai_elaborata = risposta OK dell’hub OCR; archiviata_* = insert bolle/fatture da scanner.';

alter table public.scanner_flow_events enable row level security;

drop policy if exists "scanner_flow_events: select" on public.scanner_flow_events;
create policy "scanner_flow_events: select" on public.scanner_flow_events
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
  );

drop policy if exists "scanner_flow_events: insert" on public.scanner_flow_events;
create policy "scanner_flow_events: insert" on public.scanner_flow_events
  for insert to authenticated
  with check (
    public.is_admin()
    or sede_id = public.get_user_sede()
  );
