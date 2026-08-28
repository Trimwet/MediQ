-- Fix patient appointments RLS: patients have no clinic_members row, so
-- user_in_clinic(clinic_id) is always false for them. The 20260821 clinic
-- migration incorrectly required user_in_clinic for the patient email branch,
-- making patients unable to see their own bookings (hence "No upcoming" + checklist stuck).

-- Drop the broken policies
DROP POLICY IF EXISTS appointments_select_clinic ON public.appointments;
DROP POLICY IF EXISTS appointments_update_clinic ON public.appointments;

-- Recreate SELECT: patient can see own rows WITHOUT needing clinic membership;
-- staff still needs clinic membership.
CREATE POLICY appointments_select_clinic
  ON public.appointments FOR SELECT
  USING (
    lower(patient_email) = lower(auth.jwt()->>'email')
    OR (
      user_in_clinic(clinic_id)
      AND (
        is_admin()
        OR has_role('front_desk')
        OR (has_role('doctor') AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
      )
    )
  );

-- Recreate UPDATE: patient cancel does NOT require clinic membership; staff still does.
CREATE POLICY appointments_update_clinic
  ON public.appointments FOR UPDATE
  USING (
    lower(patient_email) = lower(auth.jwt()->>'email')
    OR (
      user_in_clinic(clinic_id)
      AND (
        is_admin()
        OR has_role('front_desk')
        OR (lower(patient_email) = lower(auth.jwt()->>'email'))
      )
    )
  )
  WITH CHECK (
    lower(patient_email) = lower(auth.jwt()->>'email') AND status = 'cancelled'
    OR (
      user_in_clinic(clinic_id)
      AND (
        is_admin()
        OR has_role('front_desk')
        OR (lower(patient_email) = lower(auth.jwt()->>'email') AND status = 'cancelled')
      )
    )
  );

-- Ensure the booking-method flow is also covered: when a patient books via /book
-- and then creates an account with the same email, they immediately see that pending
-- appointment as upcoming.
