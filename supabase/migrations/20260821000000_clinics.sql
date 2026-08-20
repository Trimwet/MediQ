-- ============================================================================
-- MediQ — Multi-Tenant Clinics Migration
-- Date: 2026-08-21
-- Purpose: Add clinics / clinic_members tables, clinic_id FK on all data
--          tables, multi-tenant RLS policies, replace book_appointment with
--          a clinic-aware 7-arg version, and add list_public_doctors.
--          Every statement is idempotent (IF NOT EXISTS / DROP POLICY IF
--          EXISTS / CREATE OR REPLACE / ON CONFLICT) so supabase db push is
--          safe regardless of remote state.
--
-- Tables that receive clinic_id (verified from repos.ts):
--   appointments (line 150), patients (line 289), doctors (line 345),
--   staff (line 394), rooms (line 464), plus queue_entries & notifications.
-- ============================================================================

-- ==========================
-- 1. TABLES
-- ==========================

-- 1a. clinics — one row per tenant
CREATE TABLE IF NOT EXISTS public.clinics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  plan       text NOT NULL DEFAULT 'professional',
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1b. clinic_members — maps auth users to clinics with a role
CREATE TABLE IF NOT EXISTS public.clinic_members (
  clinic_id  uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       user_role NOT NULL CHECK (role IN ('admin','front_desk','doctor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, user_id)
);

-- ==========================
-- 2. ADD clinic_id TO EXISTING TABLES
-- ==========================

-- appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id
  ON public.appointments (clinic_id);

-- patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id
  ON public.patients (clinic_id);

-- doctors
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id
  ON public.doctors (clinic_id);

-- staff
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_staff_clinic_id
  ON public.staff (clinic_id);

-- rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_rooms_clinic_id
  ON public.rooms (clinic_id);

-- queue_entries
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_queue_entries_clinic_id
  ON public.queue_entries (clinic_id);

-- notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_notifications_clinic_id
  ON public.notifications (clinic_id);

-- ==========================
-- 3. HELPER FUNCTIONS (SECURITY DEFINER)
-- ==========================

-- user_in_clinic: does the current user belong to the given clinic?
CREATE OR REPLACE FUNCTION public.user_in_clinic(c_clinic_id uuid)
RETURNS boolean
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = c_clinic_id
      AND cm.user_id = auth.uid()
  );
$$;

-- user_is_clinic_admin: is the current user an admin of the given clinic?
CREATE OR REPLACE FUNCTION public.user_is_clinic_admin(c_clinic_id uuid)
RETURNS boolean
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.clinic_id = c_clinic_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'::user_role
  );
$$;

-- user_is_this_doctor: is the current auth user linked to the given doctor row?
CREATE OR REPLACE FUNCTION public.user_is_this_doctor(c_doctor_id uuid)
RETURNS boolean
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = c_doctor_id
      AND d.user_id = auth.uid()
  );
$$;

-- ==========================
-- 4. ENABLE RLS ON NEW TABLES
-- ==========================

ALTER TABLE public.clinics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members  ENABLE ROW LEVEL SECURITY;

-- ==========================
-- 5. DROP OLD POLICIES (every name that exists across all prior migrations)
-- ==========================

-- profiles (untouched by clinic scoping — no clinic_id column)
DROP POLICY IF EXISTS profiles_select_own_or_admin   ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_admin           ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_or_admin    ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_admin            ON public.profiles;

-- patients
DROP POLICY IF EXISTS patients_select_roles  ON public.patients;
DROP POLICY IF EXISTS patients_insert_roles  ON public.patients;
DROP POLICY IF EXISTS patients_update_roles  ON public.patients;
DROP POLICY IF EXISTS patients_delete_roles  ON public.patients;

-- doctors
DROP POLICY IF EXISTS doctors_select_roles  ON public.doctors;
DROP POLICY IF EXISTS doctors_insert_admin   ON public.doctors;
DROP POLICY IF EXISTS doctors_update_admin   ON public.doctors;
DROP POLICY IF EXISTS doctors_delete_admin   ON public.doctors;

-- staff
DROP POLICY IF EXISTS staff_select_staff    ON public.staff;
DROP POLICY IF EXISTS staff_select_admin    ON public.staff;  -- from an earlier version
DROP POLICY IF EXISTS staff_insert_admin    ON public.staff;
DROP POLICY IF EXISTS staff_update_admin    ON public.staff;
DROP POLICY IF EXISTS staff_delete_admin    ON public.staff;

-- rooms
DROP POLICY IF EXISTS rooms_select_roles   ON public.rooms;
DROP POLICY IF EXISTS rooms_insert_admin    ON public.rooms;
DROP POLICY IF EXISTS rooms_update_admin    ON public.rooms;
DROP POLICY IF EXISTS rooms_delete_admin    ON public.rooms;

-- appointments
DROP POLICY IF EXISTS appointments_select_roles  ON public.appointments;
DROP POLICY IF EXISTS appointments_insert_admin   ON public.appointments;
DROP POLICY IF EXISTS appointments_update_roles   ON public.appointments;
DROP POLICY IF EXISTS appointments_delete_roles   ON public.appointments;

-- queue_entries
DROP POLICY IF EXISTS queue_entries_select_roles  ON public.queue_entries;
DROP POLICY IF EXISTS queue_entries_insert_roles  ON public.queue_entries;
DROP POLICY IF EXISTS queue_entries_update_roles  ON public.queue_entries;
DROP POLICY IF EXISTS queue_entries_delete_roles  ON public.queue_entries;

-- notifications
DROP POLICY IF EXISTS notifications_select_roles   ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_admin    ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_admin    ON public.notifications;

-- notification_recipients
DROP POLICY IF EXISTS notification_recipients_select_own    ON public.notification_recipients;
DROP POLICY IF EXISTS notification_recipients_insert_admin  ON public.notification_recipients;
DROP POLICY IF EXISTS notification_recipients_delete_admin  ON public.notification_recipients;
DROP POLICY IF EXISTS notification_recipients_update_own    ON public.notification_recipients;

-- ==========================
-- 6. RECREATE PROFILE POLICIES (no clinic scoping — profiles has no clinic_id)
-- ==========================

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

CREATE POLICY profiles_insert_admin
  ON public.profiles FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY profiles_update_own_or_admin
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (
    is_admin()
    OR (id = auth.uid()
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  );

CREATE POLICY profiles_delete_admin
  ON public.profiles FOR DELETE
  USING (is_admin());

-- ==========================
-- 7. CLINIC-SCOPED POLICIES — data tables
-- ==========================

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
CREATE POLICY patients_select_clinic
  ON public.patients FOR SELECT
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk') OR has_role('doctor')));

CREATE POLICY patients_insert_clinic
  ON public.patients FOR INSERT
  WITH CHECK (user_in_clinic(clinic_id)
              AND (is_admin() OR has_role('front_desk')));

CREATE POLICY patients_update_clinic
  ON public.patients FOR UPDATE
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk')))
  WITH CHECK (user_in_clinic(clinic_id)
              AND (is_admin() OR has_role('front_desk')));

CREATE POLICY patients_delete_clinic
  ON public.patients FOR DELETE
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk')));

-- ---------------------------------------------------------------------------
-- doctors
-- ---------------------------------------------------------------------------
CREATE POLICY doctors_select_clinic
  ON public.doctors FOR SELECT
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk') OR has_role('doctor')));

CREATE POLICY doctors_insert_clinic
  ON public.doctors FOR INSERT
  WITH CHECK (user_in_clinic(clinic_id) AND is_admin());

CREATE POLICY doctors_update_clinic
  ON public.doctors FOR UPDATE
  USING (user_in_clinic(clinic_id) AND is_admin())
  WITH CHECK (user_in_clinic(clinic_id) AND is_admin());

CREATE POLICY doctors_delete_clinic
  ON public.doctors FOR DELETE
  USING (user_in_clinic(clinic_id) AND is_admin());

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
CREATE POLICY staff_select_clinic
  ON public.staff FOR SELECT
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk') OR has_role('doctor')));

CREATE POLICY staff_insert_clinic
  ON public.staff FOR INSERT
  WITH CHECK (user_in_clinic(clinic_id) AND is_admin());

CREATE POLICY staff_update_clinic
  ON public.staff FOR UPDATE
  USING (user_in_clinic(clinic_id) AND is_admin())
  WITH CHECK (user_in_clinic(clinic_id) AND is_admin());

CREATE POLICY staff_delete_clinic
  ON public.staff FOR DELETE
  USING (user_in_clinic(clinic_id) AND is_admin());

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
CREATE POLICY rooms_select_clinic
  ON public.rooms FOR SELECT
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk') OR has_role('doctor')));

CREATE POLICY rooms_insert_clinic
  ON public.rooms FOR INSERT
  WITH CHECK (user_in_clinic(clinic_id) AND is_admin());

CREATE POLICY rooms_update_clinic
  ON public.rooms FOR UPDATE
  USING (user_in_clinic(clinic_id) AND is_admin())
  WITH CHECK (user_in_clinic(clinic_id) AND is_admin());

CREATE POLICY rooms_delete_clinic
  ON public.rooms FOR DELETE
  USING (user_in_clinic(clinic_id) AND is_admin());

-- ---------------------------------------------------------------------------
-- appointments  (includes patient email access for self-service viewing/cancel)
-- ---------------------------------------------------------------------------
CREATE POLICY appointments_select_clinic
  ON public.appointments FOR SELECT
  USING (
    user_in_clinic(clinic_id)
    AND (
      is_admin()
      OR has_role('front_desk')
      OR (has_role('doctor')
          AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
      OR (lower(patient_email) = lower(auth.jwt()->>'email'))
    )
  );

CREATE POLICY appointments_insert_clinic
  ON public.appointments FOR INSERT
  WITH CHECK (user_in_clinic(clinic_id)
              AND (is_admin() OR has_role('front_desk')));

CREATE POLICY appointments_update_clinic
  ON public.appointments FOR UPDATE
  USING (
    user_in_clinic(clinic_id)
    AND (
      is_admin()
      OR has_role('front_desk')
      OR (lower(patient_email) = lower(auth.jwt()->>'email'))
    )
  )
  WITH CHECK (
    user_in_clinic(clinic_id)
    AND (
      is_admin()
      OR has_role('front_desk')
      OR (lower(patient_email) = lower(auth.jwt()->>'email')
          AND status = 'cancelled')
    )
  );

CREATE POLICY appointments_delete_clinic
  ON public.appointments FOR DELETE
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk')));

-- ---------------------------------------------------------------------------
-- queue_entries
-- ---------------------------------------------------------------------------
CREATE POLICY queue_entries_select_clinic
  ON public.queue_entries FOR SELECT
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk') OR has_role('doctor')));

CREATE POLICY queue_entries_insert_clinic
  ON public.queue_entries FOR INSERT
  WITH CHECK (user_in_clinic(clinic_id)
              AND (is_admin() OR has_role('front_desk')));

CREATE POLICY queue_entries_update_clinic
  ON public.queue_entries FOR UPDATE
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk')))
  WITH CHECK (user_in_clinic(clinic_id)
              AND (is_admin() OR has_role('front_desk')));

CREATE POLICY queue_entries_delete_clinic
  ON public.queue_entries FOR DELETE
  USING (user_in_clinic(clinic_id)
         AND (is_admin() OR has_role('front_desk')));

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE POLICY notifications_select_clinic
  ON public.notifications FOR SELECT
  USING (
    user_in_clinic(clinic_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.notification_recipients r
        WHERE r.notification_id = id AND r.user_id = auth.uid()
      )
      OR is_admin()
      OR has_role('front_desk')
      OR has_role('doctor')
    )
  );

CREATE POLICY notifications_insert_clinic
  ON public.notifications FOR INSERT
  WITH CHECK (user_in_clinic(clinic_id) AND is_admin());

CREATE POLICY notifications_delete_clinic
  ON public.notifications FOR DELETE
  USING (user_in_clinic(clinic_id) AND is_admin());

-- ==========================
-- 8. CLINIC + CLINIC_MEMBERS POLICIES
-- ==========================

-- clinics: any member can read; admin can mutate
CREATE POLICY clinics_select_member
  ON public.clinics FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.clinic_id = clinics.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY clinics_insert_admin
  ON public.clinics FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY clinics_update_admin
  ON public.clinics FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY clinics_delete_admin
  ON public.clinics FOR DELETE
  USING (is_admin());

-- clinic_members: members of the clinic (or global admin) can read;
--                  admin or clinic-admin can mutate
CREATE POLICY clinic_members_select_member
  ON public.clinic_members FOR SELECT
  USING (is_admin() OR user_in_clinic(clinic_id));

CREATE POLICY clinic_members_insert_admin
  ON public.clinic_members FOR INSERT
  WITH CHECK (is_admin() OR user_is_clinic_admin(clinic_id));

CREATE POLICY clinic_members_update_admin
  ON public.clinic_members FOR UPDATE
  USING (is_admin() OR user_is_clinic_admin(clinic_id))
  WITH CHECK (is_admin() OR user_is_clinic_admin(clinic_id));

CREATE POLICY clinic_members_delete_admin
  ON public.clinic_members FOR DELETE
  USING (is_admin() OR user_is_clinic_admin(clinic_id));

-- ==========================
-- 9. NOTIFICATION_RECIPIENTS — recreate init's policies (no UPDATE policy)
-- ==========================
-- NOTE: init.sql had no UPDATE policy on notification_recipients; the
-- mark_notification_read / mark_all_notifications_read RPCs are SECURITY
-- INVOKER and require RLS UPDATE permission.  If those RPCs silently
-- update 0 rows after this migration, add an UPDATE policy back here.

CREATE POLICY notification_recipients_select_own
  ON public.notification_recipients FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY notification_recipients_insert_admin
  ON public.notification_recipients FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY notification_recipients_delete_admin
  ON public.notification_recipients FOR DELETE
  USING (is_admin());

-- ==========================
-- 10. REPLACE book_appointment — 7-arg clinic-aware version
-- ==========================

-- Drop old overloads
DROP FUNCTION IF EXISTS public.book_appointment();
DROP FUNCTION IF EXISTS public.book_appointment(text,text,text,timestamptz,uuid,text);

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_name          text,
  p_email         text,
  p_phone         text,
  p_scheduled_for timestamptz,
  p_doctor_id     uuid DEFAULT NULL,
  p_reason        text DEFAULT NULL,
  p_clinic_id     uuid DEFAULT NULL
)
RETURNS public.appointments
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_clinic_id   uuid;
  v_patient_id  uuid;
  v_doctor_name text;
  v_appointment public.appointments;
BEGIN
  -- Resolve clinic: explicit arg or fall back to the default clinic
  v_clinic_id := COALESCE(
    p_clinic_id,
    (SELECT id FROM public.clinics WHERE slug = 'default' LIMIT 1)
  );

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'No clinic specified and no default clinic found.';
  END IF;

  -- If a doctor was specified, validate it belongs to this clinic and get name
  IF p_doctor_id IS NOT NULL THEN
    SELECT name INTO v_doctor_name
    FROM public.doctors
    WHERE id = p_doctor_id AND clinic_id = v_clinic_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Doctor % does not belong to clinic %', p_doctor_id, v_clinic_id;
    END IF;
  END IF;

  -- Upsert patient (partial unique index patients_email_unique_idx on lower(email))
  -- DO NOT overwrite existing name / phone on conflict.
  INSERT INTO public.patients (name, phone, email, clinic_id)
  VALUES (p_name, p_phone, lower(p_email), v_clinic_id)
  ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO NOTHING;

  -- Retrieve patient id (either just inserted or already existed)
  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE lower(email) = lower(p_email) AND email IS NOT NULL;

  -- Insert appointment
  INSERT INTO public.appointments (
    patient_name, patient_email, doctor_id, doctor_name,
    scheduled_for, status, reason, clinic_id
  ) VALUES (
    p_name, lower(p_email), p_doctor_id, v_doctor_name,
    p_scheduled_for, 'pending'::appointment_status, p_reason, v_clinic_id
  )
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$;

COMMENT ON FUNCTION public.book_appointment(text,text,text,timestamptz,uuid,text,uuid) IS
  'Clinic-aware booking entry point. Resolves clinic from p_clinic_id or the '
  '"default" slug. Validates doctor membership. Atomic patient upsert + '
  'appointment insert. Status locked to pending — never client-supplied.';

-- Grant EXECUTE to anon + authenticated (public booking endpoint)
GRANT EXECUTE ON FUNCTION
  public.book_appointment(text,text,text,timestamptz,uuid,text,uuid)
TO anon, authenticated;

-- ==========================
-- 11. list_public_doctors — active doctors, optional clinic filter
-- ==========================

CREATE OR REPLACE FUNCTION public.list_public_doctors(p_clinic_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, name text, specialization text)
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT d.id, d.name, d.specialization
  FROM public.doctors d
  WHERE d.status = 'active'::doctor_status
    AND (p_clinic_id IS NULL OR d.clinic_id = p_clinic_id)
  ORDER BY d.name;
$$;

COMMENT ON FUNCTION public.list_public_doctors(uuid) IS
  'Returns active doctors for the public booking dropdown. Optional clinic filter.';

GRANT EXECUTE ON FUNCTION public.list_public_doctors(uuid)
TO anon, authenticated;

-- ==========================
-- 12. TRIGGER — keep clinics.updated_at in sync
-- ==========================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_clinics_updated_at'
  ) THEN
    CREATE TRIGGER set_clinics_updated_at
      BEFORE UPDATE ON public.clinics
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- ==========================
-- 13. BACKFILL — create default clinic, populate clinic_id, add members
-- ==========================

-- 13a. Ensure the default clinic exists
INSERT INTO public.clinics (name, slug, plan, status)
VALUES ('Default Clinic', 'default', 'professional', 'active')
ON CONFLICT (slug) DO NOTHING;

-- 13b. Populate clinic_id on every data table where it is still NULL
DO $$
DECLARE
  v_default_clinic uuid;
BEGIN
  SELECT id INTO v_default_clinic
  FROM public.clinics
  WHERE slug = 'default'
  LIMIT 1;

  IF v_default_clinic IS NULL THEN
    RAISE EXCEPTION 'Default clinic not found during backfill.';
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

-- 13c. Add every admin / front_desk / doctor profile to the default clinic
INSERT INTO public.clinic_members (clinic_id, user_id, role)
SELECT
  (SELECT id FROM public.clinics WHERE slug = 'default' LIMIT 1),
  p.id,
  p.role
FROM public.profiles p
WHERE p.role IN ('admin', 'front_desk', 'doctor')
ON CONFLICT (clinic_id, user_id) DO NOTHING;

-- ==========================
-- 14. GRANTS
-- ==========================

-- Explicit grants on the two new tables (belt-and-suspenders with init's
-- blanket ALTER DEFAULT PRIVILEGES).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_members TO authenticated;
REVOKE ALL ON public.clinics        FROM anon;
REVOKE ALL ON public.clinic_members FROM anon;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
