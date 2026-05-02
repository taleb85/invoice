-- Toggle backup settimanale (cron) — lettura in src/lib/backup-automation.ts

INSERT INTO public.configurazioni_app (chiave, valore, descrizione)
VALUES (
  'backup_automatico_attivo',
  'true',
  'Abilita il backup CSV settimanale automatico (lunedì 02:00 UTC) avviato dal cron.'
)
ON CONFLICT (chiave) DO NOTHING;

SELECT pg_notify('pgrst', 'reload schema');
