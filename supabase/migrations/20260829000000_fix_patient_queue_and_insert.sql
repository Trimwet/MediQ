-- ============================================================================
-- MediQ — Fix patient queue RLS + patients self-insert + clinic_id tightening
-- Date: 2026-08-29
-- Fixes:
--   Critical 1 (queue RLS no patient): queue_entries_select_clinic had no
--     patient branch. Patients have no clinic_members row, so
--     user_in_clinic(clinic_id) is always false. Add patient visibility via
--     appointment_id -> appointments.patient_email join. Queue has no
--     patient_email column; the only secure link is appointment_id.
--     Uses EXISTS (SELECT 1 FROM appointments WHERE id = queue_entries.appointment_id
--       AND lower(patient_email)=lower(auth.jwt()->>'email')).
--     Rationale: clinic staff still need user_in_clinic + role; patients get
--     their own queue entry without needing membership. Covers the live
--     queue_entries banner (myAppointments fallback alone is not realtime).
--
--   High 3 (patients insert blocked): authRepository.signUp inserts into
--     patients with clinic_id = NULL, but patients_insert_clinic requires
--     user_in_clinic(clinic_id) AND (admin/front_desk). Patients satisfy
--     neither, so the row is RLS-blocked and silently missing. Add a
--     permissive patients_insert_own policy that allows any authenticated user
--     to insert their own row where lower(email)=lower(auth.jwt()->>'email')
--     AND clinic_id IS NULL. Bookings later claim the row with clinic_id.
--     Mirrors mediq-admin/supabase/migrations/20260825 hardening which had
--     this policy but the canonical supabase/migrations tree did not.
--
--   Critical 2 / High 7 (clinic_id nullable): appointments.clinic_id (and
--     6 sibling tables) was added nullable in 20260821000000 and never
--     tightened. NULL rows are staff-invisible (user_in_clinic(NULL)=false)
--     but patient-visible via email branch -> silent data loss. This migration
--     backfills any remaining NULLs to the default clinic and enforces
--     NOT NULL on appointments.clinic_id. Remaining tables are backfilled
--     but left nullable with warnings until an orphan sweep confirms safety.
--
-- Idempotency: all DDL uses IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================================

-- ==========================
-- 1. QUEUE ENTRIES — patient-visible RLS (Critical 1)
-- ==========================

-- Helpful indexes for the EXISTS subquery
CREATE INDEX IF NOT EXISTS idx_queue_entries_appointment_id
  ON public.queue_entries (appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_email_lower
  ON public.appointments (lower(patient_email));

-- Drop the clinic-only policy (and any prior patient policy)
DROP POLICY IF EXISTS queue_entries_select_clinic ON public.queue_entries;
DROP POLICY IF EXISTS queue_entries_select_patient ON public.queue_entries;

-- Recreate SELECT with patient branch via appointment_id join.
-- Staff: user_in_clinic + role (admin/front_desk/doctor)
-- Patient: owns the appointment linked by appointment_id
CREATE POLICY queue_entries_select_clinic
  ON public.queue_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = queue_entries.appointment_id
        AND lower(a.patient_email) = lower(auth.jwt()->>'email')
    )
    OR (
      user_in_clinic(clinic_id)
      AND (is_admin() OR has_role('front_desk') OR has_role('doctor'))
    )
  );

-- ==========================
-- 2. PATIENTS — self-insert for sign-up (High 3 / Critical 3)
-- ==========================

DROP POLICY IF EXISTS patients_insert_own ON public.patients;

-- Allow any authenticated user to insert their own patient directory row.
-- clinic_id IS NULL is required: the row is unclaimed until first booking
-- (book_appointment does UPDATE patients SET clinic_id = v_clinic_id WHERE
-- lower(email)=lower(p_email)). Without the IS NULL guard, patients could
-- claim arbitrary clinic_ids.
CREATE POLICY patients_insert_own
  ON public.patients FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND lower(email) = lower(auth.jwt()->>'email')
    AND clinic_id IS NULL
  );

-- ==========================
-- 3. CLINIC_ID — backfill + NOT NULL tightening (Critical 2 / F07)
-- ==========================

-- Backfill any remaining NULL clinic_id rows to the default clinic.
-- Mirrors 20260821000000 §13b but is safe to re-run (only touches NULLs).
DO $$
DECLARE
  v_default_clinic uuid;
BEGIN
  SELECT id INTO v_default_clinic
  FROM public.clinics
  WHERE slug = 'default'
  LIMIT 1;

  IF v_default_clinic IS NULL THEN
    RAISE WARNING 'Default clinic not found during 20260829 backfill — skipping clinic_id backfill';
    RETURN;
  END IF;

  UPDATE public.appointments    SET clinic_id = v_default_clinic WHERE clinic_id IS NULL;
  UPDATE public.patients        SET clinic_id = v_default_clinic WHERE clinic_id IS NULL;
  UPDATE public.doctors         SET clinic_id = v_default_clinic WHERE clinic_id IS NULL;
  UPDATE public.staff           SET clinic_id = v_default_clinic WHERE clinic_id IS NULL;
  UPDATE public.rooms           SET clinic_id = v_default_clinic WHERE clinic_id IS NULL;
  UPDATE public.queue_entries   SET clinic_id = v_default_clinic WHERE clinic_id IS NULL;
  UPDATE public.notifications   SET clinic_id = v_default_clinic WHERE clinic_id IS NULL;
END
$$;

-- Enforce NOT NULL on appointments.clinic_id after backfill.
-- Guarded: if orphans remain, emit WARNING instead of failing the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.appointments WHERE clinic_id IS NULL) THEN
    RAISE WARNING 'appointments still has NULL clinic_id rows — NOT NULL not applied (backfill incomplete)';
  ELSE
    BEGIN
      ALTER TABLE public.appointments ALTER COLUMN clinic_id SET NOT NULL;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'Could not SET NOT NULL on appointments.clinic_id: %', SQLERRM;
    END;
  END IF;
END
$$;

-- Document intent for remaining tables (backfilled but not yet hardened to NOT NULL).
-- These are left nullable to allow the backfill WARNING path above to succeed
-- on databases with legacy orphans; tighten to NOT NULL in a follow-up after
-- orphan sweep. See docs/reports/backend-audit-patient.md F07.

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
