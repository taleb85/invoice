-- Logo fornitore: URL pubblico HTTPS (sito, CDN, Supabase Storage, ecc.)
ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.fornitori.logo_url IS 'URL pubblico dell''immagine logo (PNG/JPG/SVG); opzionale, UI usa le iniziali se assente o non caricabile.';
