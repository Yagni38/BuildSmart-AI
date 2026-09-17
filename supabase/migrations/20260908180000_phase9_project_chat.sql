-- ============================================================
-- BuildSmart AI — Phase 9: Project Chat (schema + RLS)
-- ============================================================
-- IDEMPOTENT migration — safe to run multiple times (Supabase SQL Editor or
-- supabase db push).
--
-- 1. Adds receiver_id + read_at columns to public.messages.
-- 2. Helper function to mark messages as read.
-- 3. Existing RLS policies (Phase 6) already enforce participant-only access:
--    - SELECT: is_project_participant(project_id)
--    - INSERT: sender_id = auth.uid() AND is_project_participant(project_id)
--    - UPDATE/DELETE: sender_id = auth.uid()
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) messages: receiver_id + read_at
-- ------------------------------------------------------------
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id uuid;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Index for unread-message lookups
CREATE INDEX IF NOT EXISTS idx_messages_receiver_read
  ON public.messages (receiver_id, read_at)
  WHERE receiver_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2) Helper: mark a message as read by the receiving participant
--    (only the intended receiver may set read_at).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_message_as_read(p_message_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.messages m
  SET read_at = now()
  WHERE m.id = p_message_id
    AND m.receiver_id = auth.uid()
    AND m.read_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.mark_message_as_read(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 3) Helper: mark all messages in a project as read for the
--    current user (bulk "conversation opened" marker).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_project_messages_read(p_project_id uuid)
RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH updated AS (
    UPDATE public.messages m
    SET read_at = now()
    WHERE m.project_id = p_project_id
      AND m.receiver_id = auth.uid()
      AND m.read_at IS NULL
    RETURNING m.id
  )
  SELECT count(*) FROM updated;
$$;

GRANT EXECUTE ON FUNCTION public.mark_project_messages_read(uuid) TO authenticated;

COMMIT;
