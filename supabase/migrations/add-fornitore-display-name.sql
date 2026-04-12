-- Nome breve opzionale per UI compatte (barra mobile, elenchi). Se NULL si usa `nome`.
ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.fornitori.display_name IS 'Optional short label for compact UI; falls back to nome when empty.';
