-- ============================================================================
-- MediQ — Fix migration #2
-- Date: 2026-08-20
-- Fixes:
--   1. Add UNIQUE constraint on doctors.user_id so each auth user maps to at
--      most one doctor directory entry. Without this the RLS sub-query that
--      scopes appointments to a doctor could match multiple rows.
--   2. Add UPDATE policy on notification_recipients so that
--      mark_notification_read() and mark_all_notifications_read()
--      (both SECURITY INVOKER) can actually write — without an UPDATE policy
--      the UPDATE statement silently affects 0 rows.
-- ============================================================================

-- 1. UNIQUE constraint: each Supabase auth user links to at most one doctor.
--    Use a partial unique index so NULLs are still allowed (un-linked doctors).
CREATE UNIQUE INDEX IF NOT EXISTS doctors_user_id_unique_idx
  ON public.doctors (user_id)
  WHERE user_id IS NOT NULL;

-- 2. UPDATE policy: users may update their own notification_recipients rows.
--    This is intentionally narrow — only the read/read_at columns are
--    meaningful to update, and the RPCs (SECURITY INVOKER) enforce that.
CREATE POLICY notification_recipients_update_own
  ON notification_recipients FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
