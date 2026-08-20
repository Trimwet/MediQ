-- ============================================================================
-- MediQ -- Fix: staff RLS
-- Date: 2026-08-20
-- Fixes the 406 error when a non-admin visits /admin/staff.
-- ============================================================================

-- Drop the admin-only select policy and replace with one that lets all
-- clinic staff (admin, front_desk, doctor) read the staff directory.
DROP POLICY IF EXISTS staff_select_admin ON staff;

CREATE POLICY staff_select_staff
  ON staff FOR SELECT
  USING (is_admin() OR has_role('front_desk') OR has_role('doctor'));