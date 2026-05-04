-- Checkpoint sync IMAP storica (batch mensili) per sede
ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS imap_sync_checkpoint date;

COMMENT ON COLUMN public.sedi.imap_sync_checkpoint IS
  'Ultimo giorno (UTC) coperto da una sync storica a chunk; la successiva riprende dal giorno successivo.';
