-- Migration: fornitore_contatti
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.fornitore_contatti (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fornitore_id uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  ruolo        text,
  email        text,
  telefono     text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.fornitore_contatti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contatti_select" ON public.fornitore_contatti
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "contatti_insert" ON public.fornitore_contatti
  FOR INSERT WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "contatti_update" ON public.fornitore_contatti
  FOR UPDATE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "contatti_delete" ON public.fornitore_contatti
  FOR DELETE USING (auth.role() IN ('authenticated', 'service_role'));

CREATE INDEX IF NOT EXISTS idx_fornitore_contatti_fornitore
  ON public.fornitore_contatti(fornitore_id);
