-- ============================================================
-- BuildSmart AI — Fix: is_admin() must be VOLATILE
-- ============================================================
-- WHY:
--   The current public.is_admin() is declared STABLE but its body
--   contains SET LOCAL row_security = off.  PostgreSQL rejects SET
--   inside a non-VOLATILE function with:
--     "SET is not allowed in a non-volatile function"
--
--   This breaks the Admin Dashboard's contractor-loading path because
--   the admin SELECT policy on contractor_profiles calls is_admin(),
--   which tries to execute SET LOCAL and fails.
--
-- WHAT this migration does:
--   Changes is_admin() from STABLE to VOLATILE.  Everything else
--   stays identical: LANGUAGE plpgsql, SECURITY DEFINER,
--   search_path, row_security bypass, case-insensitive ADMIN check,
--   NULL auth.uid() guard.
--
--   VOLATILE is the correct volatility for a function that:
--     - reads from a table whose contents change over time (profiles)
--     - uses SET LOCAL to temporarily change a session setting
--     - depends on auth.uid() which varies per request
--
-- IDEMPOTENT — safe to run multiple times.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SET LOCAL row_security = off;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(TRIM(COALESCE(p.role, ''))) = 'ADMIN'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMIT;
