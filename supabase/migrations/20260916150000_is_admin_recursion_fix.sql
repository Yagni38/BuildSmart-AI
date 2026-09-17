-- ============================================================
-- BuildSmart AI — Fix: profiles_select_approved_contractors policy
--              still has inlined old is_admin() body
-- ============================================================
-- WHY this follow-up migration is needed:
--
--   When the original public.is_admin() was LANGUAGE sql + STABLE,
--   Postgres inlined its body into the profiles_select_approved_contractors
--   policy at CREATE POLICY time.  The policy's stored qual became:
--
--     ... OR (EXISTS (SELECT 1 FROM profiles p
--          WHERE ((p.id = auth.uid()) AND (p.role = 'ADMIN'::text)))))
--
--   That is a direct SELECT FROM public.profiles with no RLS bypass —
--   exactly the recursion vector.  Replacing the function definition
--   with a LANGUAGE plpgsql version (migration 20260916150000) did NOT
--   change the already-inlined policy text.  The policy still calls the
--   raw recursive SQL, not the function.
--
-- WHAT this migration does:
--   1. Drops and recreates profiles_select_approved_contractors so its
--      USING clause calls public.is_admin() by name.  Because is_admin()
--      is now LANGUAGE plpgsql, Postgres will NOT inline it, and the
--      function's SET LOCAL row_security = off will bypass RLS for the
--      inner SELECT.
--   2. Leaves every other profiles policy untouched.
--
-- IDEMPOTENT — safe to run multiple times.
-- ============================================================

BEGIN;

-- Recreate the SELECT policy so it calls public.is_admin() instead of
-- carrying the inlined LANGUAGE sql body.  The policy logic is identical
-- to the original; only the mechanism of calling is_admin() changes from
-- inlined SQL to a function reference that Postgres will not inline.
DROP POLICY IF EXISTS "profiles_select_approved_contractors" ON public.profiles;

CREATE POLICY "profiles_select_approved_contractors"
  ON public.profiles FOR SELECT
  USING (
    (role = 'CONTRACTOR' AND verification_status IN ('VERIFIED', 'APPROVED')) OR
    auth.uid() = id OR
    public.is_admin()
COMMIT;
  );

COMMIT;
