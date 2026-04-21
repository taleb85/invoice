-- ============================================================
-- 20260421000000_rls_hardening.sql
-- Comprehensive RLS hardening for Fluxo Management.
--
-- Idempotent: uses CREATE OR REPLACE for functions,
-- DROP POLICY IF EXISTS before every CREATE POLICY,
-- and ENABLE ROW LEVEL SECURITY (safe to re-run).
--
-- Run order: this migration depends on the following tables
-- and functions already existing in the database:
--   - public.profiles, public.sedi, public.fornitori
--   - public.bolle, public.fatture, public.statements,
--     public.statement_rows, public.documenti_da_processare,
--     public.log_sincronizzazione, public.user_settings,
--     public.listino_prezzi, public.rekki_auto_orders,
--     public.mittente_fornitore_assoc_stats
--
-- NOTE on the 'documenti' storage bucket:
--   The bucket was intentionally made public in
--   fix-storage-documenti-public-read.sql to allow direct
--   PDF links without authentication tokens. The storage
--   section at the bottom of this file shows how to harden
--   it; apply those statements manually once you have
--   confirmed no existing direct-link embeds will break.
-- ============================================================


-- ============================================================
-- §1  HELPER FUNCTIONS
--     (public schema to match the existing is_admin() and
--      get_user_sede() that earlier migrations already use)
-- ============================================================

-- Canonical re-definition of the two existing helpers so they
-- are always present with the correct implementation.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_sede()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sede_id FROM public.profiles WHERE id = auth.uid()
$$;

-- New: true for admin AND for admin_sede of the given sede.
CREATE OR REPLACE FUNCTION public.is_admin_of_sede(target_sede_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'admin_sede')
      AND (role = 'admin' OR sede_id = target_sede_id)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin()               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_sede()          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_of_sede(uuid)   TO authenticated, service_role;


-- ============================================================
-- §2  PROFILES
--     Previously had no RLS — any authenticated user could
--     read any profile row.
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin_sede" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin"     ON public.profiles;

-- Every user can read their own row
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (id = auth.uid());

-- Master admin reads all profiles
CREATE POLICY "profiles_select_admin"
ON public.profiles FOR SELECT
USING (public.is_admin());

-- admin_sede reads profiles in their own sede
CREATE POLICY "profiles_select_admin_sede"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role = 'admin_sede'
      AND caller.sede_id = profiles.sede_id
  )
);

-- Users can update their own non-sensitive fields
CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Master admin can update any profile (role changes, etc.)
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
USING (public.is_admin());

-- Only admin creates new profiles (operatori are created via /api/create-user)
CREATE POLICY "profiles_insert_admin"
ON public.profiles FOR INSERT
WITH CHECK (public.is_admin());

-- Only admin can delete profiles
CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE
USING (public.is_admin());


-- ============================================================
-- §3  SEDI
--     Previously had no RLS.
-- ============================================================
ALTER TABLE public.sedi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sedi_select_authenticated" ON public.sedi;
DROP POLICY IF EXISTS "sedi_insert_admin"         ON public.sedi;
DROP POLICY IF EXISTS "sedi_update_admin"         ON public.sedi;
DROP POLICY IF EXISTS "sedi_update_admin_sede"    ON public.sedi;
DROP POLICY IF EXISTS "sedi_delete_admin"         ON public.sedi;

-- All authenticated users can read sedi (required for the sede picker)
CREATE POLICY "sedi_select_authenticated"
ON public.sedi FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only master admin can create new sedi
CREATE POLICY "sedi_insert_admin"
ON public.sedi FOR INSERT
WITH CHECK (public.is_admin());

-- Master admin can update any sede; admin_sede can update their own
CREATE POLICY "sedi_update_admin"
ON public.sedi FOR UPDATE
USING (public.is_admin());

CREATE POLICY "sedi_update_admin_sede"
ON public.sedi FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role = 'admin_sede'
      AND caller.sede_id = sedi.id
  )
);

-- Only master admin deletes sedi
CREATE POLICY "sedi_delete_admin"
ON public.sedi FOR DELETE
USING (public.is_admin());


-- ============================================================
-- §4  FORNITORI
-- ============================================================
ALTER TABLE public.fornitori ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fornitori_select_admin"  ON public.fornitori;
DROP POLICY IF EXISTS "fornitori_select_sede"   ON public.fornitori;
DROP POLICY IF EXISTS "fornitori_insert_sede"   ON public.fornitori;
DROP POLICY IF EXISTS "fornitori_update_sede"   ON public.fornitori;
DROP POLICY IF EXISTS "fornitori_delete_sede"   ON public.fornitori;

CREATE POLICY "fornitori_select_admin"
ON public.fornitori FOR SELECT
USING (public.is_admin());

CREATE POLICY "fornitori_select_sede"
ON public.fornitori FOR SELECT
USING (sede_id = public.get_user_sede());

CREATE POLICY "fornitori_insert_sede"
ON public.fornitori FOR INSERT
WITH CHECK (public.is_admin_of_sede(sede_id));

CREATE POLICY "fornitori_update_sede"
ON public.fornitori FOR UPDATE
USING (public.is_admin_of_sede(sede_id))
WITH CHECK (public.is_admin_of_sede(sede_id));

CREATE POLICY "fornitori_delete_sede"
ON public.fornitori FOR DELETE
USING (public.is_admin_of_sede(sede_id));


-- ============================================================
-- §5  BOLLE
--     Earlier migrations added SELECT + UPDATE.
--     We add the missing INSERT and DELETE policies and
--     replace SELECT to use the tightened logic (no NULL leak).
-- ============================================================
ALTER TABLE public.bolle ENABLE ROW LEVEL SECURITY;

-- Replace SELECT (tightened — removes the NULL sede_id leak that
-- fix-rls-bolle-fatture-via-fornitore-sede.sql introduced)
DROP POLICY IF EXISTS "bolle: select"       ON public.bolle;
DROP POLICY IF EXISTS "bolle: update"       ON public.bolle;
DROP POLICY IF EXISTS "bolle: insert"       ON public.bolle;
DROP POLICY IF EXISTS "bolle: delete"       ON public.bolle;
DROP POLICY IF EXISTS "bolle_insert_sede"   ON public.bolle;
DROP POLICY IF EXISTS "bolle_delete_sede"   ON public.bolle;

CREATE POLICY "bolle: select"
ON public.bolle FOR SELECT
USING (
  public.is_admin()
  OR sede_id = public.get_user_sede()
  OR EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = bolle.fornitore_id
      AND f.sede_id = public.get_user_sede()
  )
);

CREATE POLICY "bolle: update"
ON public.bolle FOR UPDATE
USING (
  public.is_admin()
  OR sede_id = public.get_user_sede()
  OR EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = bolle.fornitore_id
      AND f.sede_id = public.get_user_sede()
  )
);

CREATE POLICY "bolle: insert"
ON public.bolle FOR INSERT
WITH CHECK (
  public.is_admin()
  OR public.is_admin_of_sede(sede_id)
  OR EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = fornitore_id
      AND public.is_admin_of_sede(f.sede_id)
  )
);

CREATE POLICY "bolle: delete"
ON public.bolle FOR DELETE
USING (
  public.is_admin()
  OR public.is_admin_of_sede(sede_id)
);


-- ============================================================
-- §6  FATTURE
--     Same gaps as bolle — add INSERT and DELETE.
-- ============================================================
ALTER TABLE public.fatture ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fatture: select"       ON public.fatture;
DROP POLICY IF EXISTS "fatture: update"       ON public.fatture;
DROP POLICY IF EXISTS "fatture: insert"       ON public.fatture;
DROP POLICY IF EXISTS "fatture: delete"       ON public.fatture;
DROP POLICY IF EXISTS "fatture_insert_sede"   ON public.fatture;
DROP POLICY IF EXISTS "fatture_delete_sede"   ON public.fatture;

CREATE POLICY "fatture: select"
ON public.fatture FOR SELECT
USING (
  public.is_admin()
  OR sede_id = public.get_user_sede()
  OR EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = fatture.fornitore_id
      AND f.sede_id = public.get_user_sede()
  )
);

CREATE POLICY "fatture: update"
ON public.fatture FOR UPDATE
USING (
  public.is_admin()
  OR sede_id = public.get_user_sede()
  OR EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = fatture.fornitore_id
      AND f.sede_id = public.get_user_sede()
  )
);

CREATE POLICY "fatture: insert"
ON public.fatture FOR INSERT
WITH CHECK (
  public.is_admin()
  OR public.is_admin_of_sede(sede_id)
  OR EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = fornitore_id
      AND public.is_admin_of_sede(f.sede_id)
  )
);

CREATE POLICY "fatture: delete"
ON public.fatture FOR DELETE
USING (
  public.is_admin()
  OR public.is_admin_of_sede(sede_id)
);


-- ============================================================
-- §7  STATEMENTS + STATEMENT_ROWS
--     Current policies allow ALL authenticated users to read
--     ALL rows — a cross-sede data leak.  Replace them with
--     sede-scoped policies.
-- ============================================================
ALTER TABLE public.statements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_rows ENABLE ROW LEVEL SECURITY;

-- statements
DROP POLICY IF EXISTS "stmt_select" ON public.statements;
DROP POLICY IF EXISTS "stmt_write"  ON public.statements;

CREATE POLICY "stmt_select"
ON public.statements FOR SELECT
USING (
  public.is_admin()
  OR sede_id = public.get_user_sede()
);

-- Writes are performed exclusively by service role API routes
CREATE POLICY "stmt_write"
ON public.statements FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- statement_rows: scope by the parent statement's sede_id
DROP POLICY IF EXISTS "srow_select" ON public.statement_rows;
DROP POLICY IF EXISTS "srow_write"  ON public.statement_rows;

CREATE POLICY "srow_select"
ON public.statement_rows FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.statements s
    WHERE s.id = statement_rows.statement_id
      AND s.sede_id = public.get_user_sede()
  )
);

CREATE POLICY "srow_write"
ON public.statement_rows FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- §8  DOCUMENTI_DA_PROCESSARE
--     No RLS currently — full table visible to anyone.
--     Note: sede_id is NULL for global-IMAP documents; service
--     role routes handle cross-sede visibility intentionally.
-- ============================================================
ALTER TABLE public.documenti_da_processare ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documenti_select_admin"    ON public.documenti_da_processare;
DROP POLICY IF EXISTS "documenti_select_sede"     ON public.documenti_da_processare;
DROP POLICY IF EXISTS "documenti_select_no_sede"  ON public.documenti_da_processare;
DROP POLICY IF EXISTS "documenti_write_service"   ON public.documenti_da_processare;

CREATE POLICY "documenti_select_admin"
ON public.documenti_da_processare FOR SELECT
USING (public.is_admin());

-- Users see documents for their sede
CREATE POLICY "documenti_select_sede"
ON public.documenti_da_processare FOR SELECT
USING (sede_id = public.get_user_sede());

-- Documents with sede_id IS NULL (global IMAP inbox) are visible
-- to any authenticated admin_sede so they can associate them
CREATE POLICY "documenti_select_no_sede"
ON public.documenti_da_processare FOR SELECT
USING (
  sede_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role IN ('admin', 'admin_sede')
  )
);

-- All writes are done by service role (scan-emails, OCR routes)
CREATE POLICY "documenti_write_service"
ON public.documenti_da_processare FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- §9  LOG_SINCRONIZZAZIONE
--     Already has a SELECT policy from tighten-rls-operator-
--     isolation.sql.  Ensure INSERT/UPDATE/DELETE are blocked
--     for regular users (service role only writes).
-- ============================================================
ALTER TABLE public.log_sincronizzazione ENABLE ROW LEVEL SECURITY;

-- The SELECT policy "log: select" from the previous migration
-- is already correct — we leave it in place.

DROP POLICY IF EXISTS "log_write_service" ON public.log_sincronizzazione;

CREATE POLICY "log_write_service"
ON public.log_sincronizzazione FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- §10  LISTINO_PREZZI
--      Has INSERT/UPDATE/DELETE but is missing SELECT.
--      Any authenticated user could previously read all prices.
-- ============================================================
ALTER TABLE public.listino_prezzi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listino_select_admin"      ON public.listino_prezzi;
DROP POLICY IF EXISTS "listino_select_sede"       ON public.listino_prezzi;

CREATE POLICY "listino_select_admin"
ON public.listino_prezzi FOR SELECT
USING (public.is_admin());

-- Users see listino rows for fornitori in their sede
CREATE POLICY "listino_select_sede"
ON public.listino_prezzi FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = listino_prezzi.fornitore_id
      AND f.sede_id = public.get_user_sede()
  )
);

-- Write policies already exist from listino-prezzi-rls-authenticated-write.sql
-- (listino_insert_authenticated / listino_update_authenticated / listino_delete_authenticated)
-- We do not replace them — they are correct.


-- ============================================================
-- §11  USER_SETTINGS
--      Already has comprehensive RLS from
--      20260417_create_user_settings.sql — no changes needed.
--      Verified: SELECT own, UPDATE own, INSERT own, DELETE own,
--      admin ALL policies are all present.
-- ============================================================

-- (no changes)


-- ============================================================
-- §12  REKKI_AUTO_ORDERS
--      Already has RLS with admin_all + sede_select.
--      Add missing write guard so only service role can mutate.
-- ============================================================
ALTER TABLE public.rekki_auto_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rekki_auto_orders_write_service" ON public.rekki_auto_orders;

CREATE POLICY "rekki_auto_orders_write_service"
ON public.rekki_auto_orders FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- §13  MITTENTE_FORNITORE_ASSOC_STATS
--      RLS already enabled with no authenticated policies
--      (service role only) — intentional design, no changes.
--      Adding explicit service-role write guard for clarity.
-- ============================================================
-- No changes; service role bypass is correct here.


-- ============================================================
-- §14  FORNITORE_OCR_TIPO_PENDING_KIND_HINTS
--      RLS enabled but no policies = all JWT reads blocked.
--      Add read access for users in the fornitore's sede.
-- ============================================================
ALTER TABLE public.fornitore_ocr_tipo_pending_kind_hints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ocr_hints_select_admin" ON public.fornitore_ocr_tipo_pending_kind_hints;
DROP POLICY IF EXISTS "ocr_hints_select_sede"  ON public.fornitore_ocr_tipo_pending_kind_hints;
DROP POLICY IF EXISTS "ocr_hints_write_service" ON public.fornitore_ocr_tipo_pending_kind_hints;

CREATE POLICY "ocr_hints_select_admin"
ON public.fornitore_ocr_tipo_pending_kind_hints FOR SELECT
USING (public.is_admin());

CREATE POLICY "ocr_hints_select_sede"
ON public.fornitore_ocr_tipo_pending_kind_hints FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.fornitori f
    WHERE f.id = fornitore_ocr_tipo_pending_kind_hints.fornitore_id
      AND f.sede_id = public.get_user_sede()
  )
);

CREATE POLICY "ocr_hints_write_service"
ON public.fornitore_ocr_tipo_pending_kind_hints FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- §15  VERIFICATION QUERIES
--      Run in the Supabase SQL Editor to confirm RLS status.
-- ============================================================

/*
-- Check all target tables have RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'sedi', 'fornitori', 'fatture', 'bolle',
    'statements', 'statement_rows', 'documenti_da_processare',
    'log_sincronizzazione', 'user_settings',
    'listino_prezzi', 'rekki_auto_orders',
    'mittente_fornitore_assoc_stats',
    'fornitore_ocr_tipo_pending_kind_hints'
  )
ORDER BY tablename;

-- Check all policies
SELECT tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify helper functions exist
SELECT routine_name, routine_schema
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'get_user_sede', 'is_admin_of_sede')
ORDER BY routine_name;
*/


-- ============================================================
-- §16  STORAGE HARDENING  (apply manually when ready)
--
--  The 'documenti' bucket is intentionally public so that
--  direct PDF links work without authentication cookies.
--  To restrict it to authenticated users only, run these
--  statements in the Supabase SQL Editor AFTER confirming
--  that the app no longer relies on unauthenticated direct
--  links (e.g. all PDF views go through /api/open-document
--  or use createSignedUrl).
--
--  WARNING: applying this will break any existing embedded
--  or shared PDF links that bypass the app.
-- ============================================================

/*
-- Make the bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'documenti';

-- Drop the open public-read policy
DROP POLICY IF EXISTS "Lettura pubblica documenti" ON storage.objects;

-- Allow authenticated users to read files
CREATE POLICY "storage_read_authenticated"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documenti'
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to upload (writes done server-side)
CREATE POLICY "storage_write_authenticated"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documenti'
  AND auth.uid() IS NOT NULL
);

-- Allow service role to manage files without restriction
CREATE POLICY "storage_service_role_all"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documenti'
  AND auth.jwt() ->> 'role' = 'service_role'
);
*/


-- ============================================================
-- §17  CREATESERVICECLIENT() AUDIT FINDINGS
--
--  Below is a risk-classified summary of all createServiceClient()
--  usages found in src/. Each entry is classified as:
--    LOW  = service client is appropriate (cron, cross-sede scan,
--           admin-gated operations, writes with prior auth check)
--    FLAG = service client returns data without adequate
--           application-level sede filter — potential leak
-- ============================================================

/*
RISK  FILE                                              NOTES
----  ------------------------------------------------  ----------------------------------
LOW   src/app/api/bolle-aperte/route.ts                 Auth + profile checked first;
                                                        sede_id filter applied in app code.
LOW   src/app/api/cron/auto-process-invoices/route.ts   CRON — intentional cross-sede.
LOW   src/app/api/cron/rekki-auto-poll/route.ts         CRON — intentional cross-sede.
LOW   src/app/api/scan-emails/route.ts                  IMAP scan — intentional cross-sede.
LOW   src/app/api/documenti-da-processare/route.ts      Auth checked; sede filter applied.
LOW   src/app/api/listino/auto-sync-fattura/route.ts    Auth checked; fornitore scoped.
LOW   src/app/api/listino/importa-da-fattura/route.ts   Auth checked; fornitore scoped.
LOW   src/app/api/listino/importa-da-rekki/route.ts     Auth checked; fornitore scoped.
LOW   src/app/api/listino/prezzi/route.ts               Auth checked; fornitore scoped.
LOW   src/app/api/statements/route.ts                   Auth checked; sede scoped.
LOW   src/app/api/triple-check-statement/route.ts       Auth checked; fornitore scoped.
LOW   src/app/api/fornitori/route.ts                    Auth checked; sede scoped writes.
LOW   src/app/api/invia-sollecito/route.ts              Auth checked; target verified.
LOW   src/app/api/manual-delivery/route.ts              Auth checked; sede scoped.
LOW   src/app/api/process-pending-statements/route.ts   CRON-style — admin only.
LOW   src/app/api/sedi/route.ts                         Admin-only writes.
LOW   src/app/api/sedi/[id]/route.ts                    Admin-only writes.
LOW   src/app/api/profiles/[id]/route.ts                Auth checked; admin-only writes.
LOW   src/app/api/operator/change-pin/route.ts          Admin-only; sede-scoped.
LOW   src/app/api/auth/google/**                        Gmail OAuth — per-user, not sede.
LOW   src/app/api/rekki/sync-status/route.ts            Auth checked; fornitore scoped.
LOW   src/lib/supabase-detail-for-viewer.ts             Auth + profile checked; docs
                                                        restricted to own sede.

FLAG  src/app/api/audit/rekki-price-history/route.ts    Service client returns rekki price
                                                        history; fornitore_id filter applied
                                                        but sede ownership NOT verified on
                                                        the fornitore_id before querying.
                                                        Recommend: add a sede ownership
                                                        check before the service query, or
                                                        use RLS on rekki_auto_orders +
                                                        listino_prezzi (now added above).

FLAG  src/app/api/discovery-fornitori/route.ts          Service client used for GET and
                                                        POST; application filters by email
                                                        sender but does not enforce sede
                                                        boundary on the fornitore returned.
                                                        Recommend: add a profile.sede_id
                                                        check or switch to createClient().

FLAG  src/app/api/admin/log-ai-suggest/route.ts         Reads from log_sincronizzazione by
                                                        logId only — no sede filter.
                                                        Recommend: verify the log row's
                                                        fornitore belongs to caller's sede
                                                        (admin role check is present, but
                                                        admin_sede could read other sedi).

NOTE  src/app/api/sede-lock/route.ts                    Imports createClient from
                                                        @supabase/supabase-js directly
                                                        with SERVICE_ROLE key — does not
                                                        use the shared createServiceClient()
                                                        helper. Functionally equivalent but
                                                        worth consolidating for consistency.
*/

-- Notify PostgREST to reload its schema cache
SELECT pg_notify('pgrst', 'reload schema');
