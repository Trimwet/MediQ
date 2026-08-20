-- Allow patients to read their own appointments and cancel them.

-- 1. Extend SELECT so patients can see their own rows
DROP POLICY IF EXISTS appointments_select_roles ON appointments;

CREATE POLICY appointments_select_roles
  ON appointments FOR SELECT
  USING (
    is_admin()
    OR has_role('front_desk')
    OR (has_role('doctor')
        AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
    OR (
      auth.uid() IS NOT NULL
      AND patient_email = (
        SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
      )
    )
  );

-- 2. Allow patients to cancel only their own appointments
DROP POLICY IF EXISTS appointments_update_roles ON appointments;

CREATE POLICY appointments_update_roles
  ON appointments FOR UPDATE
  USING (
    is_admin()
    OR has_role('front_desk')
    OR (
      auth.uid() IS NOT NULL
      AND patient_email = (
        SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    is_admin()
    OR has_role('front_desk')
    OR (
      auth.uid() IS NOT NULL
      AND patient_email = (
        SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
      )
      AND status = 'cancelled'
    )
  );