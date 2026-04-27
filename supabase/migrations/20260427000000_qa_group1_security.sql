-- QA 2026-04-27 — Gruppo 1 (sicurezza)
-- Idempotente dove possibile.

-- ── 1.1 Revoca esecuzione funzioni SECURITY DEFINER da anon (PostgREST /rest/v1/rpc/…)
REVOKE EXECUTE ON FUNCTION public.bolla_has_rekki_prezzo_flag(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_sede() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;

-- ── 1.2 handle_new_user: stessa logica di multi-sede.sql, con search_path fisso
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'operatore')
  ON CONFLICT (id) DO UPDATE SET email = new.email;
  RETURN new;
END;
$$;

-- is_admin / get_user_sede: body già in 20260421000000 con SET search_path = public

-- ── 1.3 Storage: niente lettura “pubblica” su objects senza autenticazione
DROP POLICY IF EXISTS "Lettura pubblica documenti" ON storage.objects;
DROP POLICY IF EXISTS "documenti_read_authenticated" ON storage.objects;

CREATE POLICY "documenti_read_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documenti');

-- Nota: il bucket può restare public=true; link /object/public/… usano getPublicUrl.
-- Per togliere listing anon su API Storage e seguire pienamente il QA, valuta bucket private + signed URL (§16 in rls_hardening).

-- ── 1.4–1.5 Policy legacy aperte (se create fuori dalle migration in repo)
DROP POLICY IF EXISTS "documenti_visibilita_totale" ON public.documenti_da_processare;
DROP POLICY IF EXISTS "Accesso totale per utenti autenticati" ON public.statements;
DROP POLICY IF EXISTS "Accesso totale per utenti autenticati" ON public.statement_rows;

-- ── 1.6 mittente_fornitore_assoc_stats: da service-only a per-sede
DROP POLICY IF EXISTS "mittente_assoc_all_sede" ON public.mittente_fornitore_assoc_stats;

CREATE POLICY "mittente_assoc_all_sede"
  ON public.mittente_fornitore_assoc_stats
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = mittente_fornitore_assoc_stats.fornitore_id
        AND (
          public.is_admin()
          OR public.is_admin_of_sede(f.sede_id)
          OR (f.sede_id IS NOT NULL AND f.sede_id = public.get_user_sede())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = fornitore_id
        AND (
          public.is_admin()
          OR public.is_admin_of_sede(f.sede_id)
          OR (f.sede_id IS NOT NULL AND f.sede_id = public.get_user_sede())
        )
    )
  );

-- 3.4 (parziale) — duplicati segnalati in QA
DROP POLICY IF EXISTS "Authenticated: insert log" ON public.log_sincronizzazione;
DROP POLICY IF EXISTS "Authenticated: update log" ON public.log_sincronizzazione;
DROP POLICY IF EXISTS "listino_select"           ON public.listino_prezzi;

SELECT pg_notify('pgrst', 'reload schema');
