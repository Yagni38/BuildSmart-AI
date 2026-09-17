-- ============================================================
-- BuildSmart AI — Phase 7: verification_status column
-- ============================================================
-- Adds verification_status column to public.profiles table
-- Default value is PENDING for new contractor registrations
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'PENDING'
  CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED'));

COMMIT;