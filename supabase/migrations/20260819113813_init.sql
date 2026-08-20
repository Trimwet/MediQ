-- ============================================================================
-- MediQ — Initial Schema Migration
-- Date: 2026-08-19
-- Purpose: Core tables, enums, RLS policies, helper functions, and the
--          book_appointment() RPC for the MediQ clinic management app.
-- All enum values and column names are sourced 1:1 from mediq-admin zod
-- schemas (src/features/*/schema.ts) and rbac.ts (src/config/rbac.ts).
--
-- NOTE: facility_settings table is SKIPPED. The facility-form.tsx only has
-- a Zustand-client-side toggle (trackRooms) and a roomLabel string — no
-- persistent server-side facility settings.
--
-- Security notes:
--   - profiles UPDATE policy prevents role escalation (own-row preserves role).
--   - Booking goes through book_appointment() RPC (anonymous-safe, status locked).
--   - Function EXECUTE grants follow least-privilege (trigger-only funcs ungranted).
--
-- Bootstrap the first admin after the first user signs up:
--   UPDATE public.profiles SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = '<admin-email>' LIMIT 1);
-- Run this in the Supabase Dashboard SQL Editor.
-- ============================================================================

-- ==========================
-- 1. ENUMS
-- ==========================

CREATE TYPE user_role AS ENUM (
  'admin',
  'front_desk',
  'doctor',
  'patient'
);

CREATE TYPE appointment_status AS ENUM (
  'pending',
  'booked',
  'arrived',
  'in_progress',
  'completed',
  'no_show',
  'cancelled',
  'rejected'
);

CREATE TYPE queue_status AS ENUM (
  'waiting',
  'called',
  'in_room',
  'done',
  'left'
);

CREATE TYPE doctor_status AS ENUM (
  'active',
  'away'
);

CREATE TYPE staff_role AS ENUM (
  'front_desk',
  'admin',
  'doctor'
);

CREATE TYPE staff_status AS ENUM (
  'active',
  'inactive'
);

CREATE TYPE room_type AS ENUM (
  'consultation',
  'procedure',
  'recovery'
);

CREATE TYPE room_status AS ENUM (
  'available',
  'occupied',
  'cleaning'
);

CREATE TYPE notification_type AS ENUM (
  'appointment',
  'queue',
  'summary',
  'system'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'push',
  'sms',
  'in_app'
);

-- ==========================
-- 2. TABLES
-- ==========================

-- 2a. profiles (extends auth.users)
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'patient',
  full_name  text      NOT NULL DEFAULT '',
  phone      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2b. patients
CREATE TABLE patients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text      NOT NULL,
  phone      text      NOT NULL,
  email      text,
  last_visit timestamptz,
  visits     integer   NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX patients_email_unique_idx
  ON patients (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX patients_name_idx
  ON patients (name);

-- 2c. doctors
CREATE TABLE doctors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name           text      NOT NULL,
  specialization text      NOT NULL CHECK (specialization IN (
    'Cardiology', 'Pediatrics', 'General Practice',
    'Dermatology', 'Neurology', 'Orthopedics'
  )),
  email          text      NOT NULL UNIQUE,
  status         doctor_status NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- NOTE: todayAppointments is a derived count, NOT a column.

-- 2d. staff
CREATE TABLE staff (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  role       staff_role  NOT NULL,
  phone      text        NOT NULL,
  email      text        NOT NULL UNIQUE,
  status     staff_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2e. rooms
CREATE TABLE rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number     text      NOT NULL UNIQUE,
  type       room_type NOT NULL,
  status     room_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2f. appointments
CREATE TABLE appointments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name     text              NOT NULL,
  patient_email    text,
  doctor_id        uuid REFERENCES doctors(id) ON DELETE RESTRICT,
  doctor_name      text,
  scheduled_for    timestamptz       NOT NULL,
  status           appointment_status NOT NULL DEFAULT 'pending',
  reason           text,
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX appointments_scheduled_for_idx ON appointments (scheduled_for);
CREATE INDEX appointments_status_idx        ON appointments (status);
CREATE INDEX appointments_doctor_id_idx     ON appointments (doctor_id);
CREATE INDEX appointments_patient_email_idx ON appointments (lower(patient_email));

-- 2g. queue_entries
CREATE TABLE queue_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid REFERENCES appointments(id) ON DELETE SET NULL,
  patient_name    text      NOT NULL,
  appointment_time timestamptz NOT NULL,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  called_at       timestamptz,
  doctor_name     text      NOT NULL DEFAULT '',
  room_id         uuid REFERENCES rooms(id) ON DELETE SET NULL,
  status          queue_status NOT NULL DEFAULT 'waiting',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX queue_entries_status_checked_in_idx
  ON queue_entries (status, checked_in_at);

-- 2h. notifications
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       notification_type    NOT NULL,
  channel    notification_channel NOT NULL,
  title      text NOT NULL,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2i. notification_recipients (junction table)
CREATE TABLE notification_recipients (
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read            boolean NOT NULL DEFAULT false,
  read_at         timestamptz,
  PRIMARY KEY (notification_id, user_id)
);

-- facility_settings SKIPPED — see header comment.

-- ==========================
-- 3. FUNCTIONS & TRIGGERS
-- ==========================

-- 3a. set_updated_at() trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger: profiles.updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3b. has_role() — SECURITY DEFINER to avoid RLS recursion on profiles
CREATE OR REPLACE FUNCTION public.has_role(p_role text)
RETURNS boolean
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = p_role::user_role
  );
$$;

COMMENT ON FUNCTION public.has_role(text) IS
  'SECURITY DEFINER: checks if the current auth user has the given role. '
  'Must be SECURITY DEFINER because policies on profiles would otherwise recurse.';

-- 3c. is_admin() convenience wrapper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT public.has_role('admin');
$$;

-- 3d. handle_new_user() — auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    'patient'::user_role,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

-- Trigger: auto-create profile row when a new auth user signs up
-- Staff promotion is done manually via SQL UPDATE.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3e. book_appointment() — anonymous/self-service booking RPC
-- Atomic patient upsert + appointment insert; status locked to 'pending'.
-- This is the entry point for BookingRepository.book in mediq-admin/src/data/repos.ts.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_name          text,
  p_email         text,
  p_phone         text,
  p_scheduled_for timestamptz,
  p_doctor_id     uuid DEFAULT NULL,
  p_reason        text DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_email text;
  v_doctor_name   text;
  v_id            uuid;
BEGIN
  v_patient_email := lower(p_email);

  -- Upsert patient (partial unique index on lower(email) WHERE email IS NOT NULL)
  INSERT INTO public.patients (name, phone, email)
  SELECT p_name, p_phone, v_patient_email
  WHERE NOT EXISTS (
    SELECT 1 FROM public.patients WHERE lower(email) = v_patient_email AND email IS NOT NULL
  );

  -- Resolve doctor name from the doctors table (never trust client input)
  IF p_doctor_id IS NOT NULL THEN
    SELECT name INTO v_doctor_name
    FROM public.doctors
    WHERE id = p_doctor_id;
  END IF;

  INSERT INTO public.appointments (
    patient_name, patient_email, doctor_id, doctor_name,
    scheduled_for, status, reason
  ) VALUES (
    p_name, v_patient_email, p_doctor_id, v_doctor_name,
    p_scheduled_for, 'pending'::appointment_status, p_reason
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.book_appointment(text,text,text,timestamptz,uuid,text) IS
  'Anonymous/self-service booking entry point. Atomic patient upsert + appointment insert. '
  'Status is locked to pending — never client-supplied. Email is lowercased. '
  'Doctor name resolved from doctors table, not client input.';

-- 3f. mark_notification_read() / mark_all_notifications_read()
-- SECURITY INVOKER: RLS applies (user can only update their own recipients row).
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  UPDATE public.notification_recipients
  SET read = true, read_at = now()
  WHERE notification_id = p_notification_id
    AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
SECURITY INVOKER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  UPDATE public.notification_recipients
  SET read = true, read_at = now()
  WHERE user_id = auth.uid()
    AND read = false;
$$;

-- ==========================
-- 4. ROW-LEVEL SECURITY
-- ==========================

ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

-- --------------------------
-- profiles policies
-- --------------------------

-- SELECT: own profile or admin
CREATE POLICY profiles_select_own_or_admin
  ON profiles FOR SELECT
  USING (id = auth.uid() OR is_admin());

-- INSERT: admin only (no self-registration of arbitrary profiles)
CREATE POLICY profiles_insert_admin
  ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- UPDATE: own profile or admin; role changes require admin (self-update preserves role)
CREATE POLICY profiles_update_own_or_admin
  ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (
    is_admin()
    OR (id = auth.uid()
        AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- DELETE: admin only
CREATE POLICY profiles_delete_admin
  ON profiles FOR DELETE
  USING (is_admin());

-- --------------------------
-- patients policies
-- --------------------------

CREATE POLICY patients_select_roles
  ON patients FOR SELECT
  USING (is_admin() OR has_role('front_desk') OR has_role('doctor'));

CREATE POLICY patients_insert_roles
  ON patients FOR INSERT
  WITH CHECK (is_admin() OR has_role('front_desk'));

CREATE POLICY patients_update_roles
  ON patients FOR UPDATE
  USING (is_admin() OR has_role('front_desk'))
  WITH CHECK (is_admin() OR has_role('front_desk'));

CREATE POLICY patients_delete_roles
  ON patients FOR DELETE
  USING (is_admin() OR has_role('front_desk'));

-- --------------------------
-- doctors policies
-- --------------------------

CREATE POLICY doctors_select_roles
  ON doctors FOR SELECT
  USING (is_admin() OR has_role('front_desk') OR has_role('doctor'));

CREATE POLICY doctors_insert_admin
  ON doctors FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY doctors_update_admin
  ON doctors FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY doctors_delete_admin
  ON doctors FOR DELETE
  USING (is_admin());

-- --------------------------
-- staff policies
-- --------------------------

CREATE POLICY staff_select_staff
  ON staff FOR SELECT
  USING (is_admin() OR has_role('front_desk') OR has_role('doctor'));

CREATE POLICY staff_insert_admin
  ON staff FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY staff_update_admin
  ON staff FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY staff_delete_admin
  ON staff FOR DELETE
  USING (is_admin());

-- --------------------------
-- rooms policies
-- --------------------------

CREATE POLICY rooms_select_roles
  ON rooms FOR SELECT
  USING (is_admin() OR has_role('front_desk') OR has_role('doctor'));

CREATE POLICY rooms_insert_admin
  ON rooms FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY rooms_update_admin
  ON rooms FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY rooms_delete_admin
  ON rooms FOR DELETE
  USING (is_admin());

-- --------------------------
-- appointments policies
-- --------------------------

-- SELECT: admin/front_desk see all; doctor sees own (by user_id match);
--         patient sees rows matching their auth email.
CREATE POLICY appointments_select_roles
  ON appointments FOR SELECT
  USING (
    is_admin()
    OR has_role('front_desk')
    OR (has_role('doctor')
        AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()))
    OR (lower(patient_email) = lower(auth.jwt()->>'email'))
  );

-- INSERT: admin or front_desk only. Patient self-booking goes through
-- book_appointment() RPC (status locked to 'pending', no RLS bypass needed).
CREATE POLICY appointments_insert_admin
  ON appointments FOR INSERT
  WITH CHECK (
    is_admin()
    OR has_role('front_desk')
  );

-- UPDATE: admin or front_desk only
CREATE POLICY appointments_update_roles
  ON appointments FOR UPDATE
  USING (is_admin() OR has_role('front_desk'))
  WITH CHECK (is_admin() OR has_role('front_desk'));

-- DELETE: admin or front_desk only
CREATE POLICY appointments_delete_roles
  ON appointments FOR DELETE
  USING (is_admin() OR has_role('front_desk'));

-- --------------------------
-- queue_entries policies
-- --------------------------

CREATE POLICY queue_entries_select_roles
  ON queue_entries FOR SELECT
  USING (is_admin() OR has_role('front_desk') OR has_role('doctor'));

CREATE POLICY queue_entries_insert_roles
  ON queue_entries FOR INSERT
  WITH CHECK (is_admin() OR has_role('front_desk'));

CREATE POLICY queue_entries_update_roles
  ON queue_entries FOR UPDATE
  USING (is_admin() OR has_role('front_desk'))
  WITH CHECK (is_admin() OR has_role('front_desk'));

CREATE POLICY queue_entries_delete_roles
  ON queue_entries FOR DELETE
  USING (is_admin() OR has_role('front_desk'));

-- --------------------------
-- notifications policies
-- --------------------------

-- SELECT: recipient of the notification, admin, or front_desk/doctor
CREATE POLICY notifications_select_roles
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notification_recipients r
      WHERE r.notification_id = id AND r.user_id = auth.uid()
    )
    OR is_admin()
    OR has_role('front_desk')
    OR has_role('doctor')
  );

-- INSERT: admin only
CREATE POLICY notifications_insert_admin
  ON notifications FOR INSERT
  WITH CHECK (is_admin());

-- NOTE: no UPDATE policy on notifications — staff don't edit notification content;
-- the read flag lives on notification_recipients (mark_notification_read RPC).

-- DELETE: admin only
CREATE POLICY notifications_delete_admin
  ON notifications FOR DELETE
  USING (is_admin());

-- --------------------------
-- notification_recipients policies
-- --------------------------

-- SELECT: own rows only
CREATE POLICY notification_recipients_select_own
  ON notification_recipients FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: admin only
CREATE POLICY notification_recipients_insert_admin
  ON notification_recipients FOR INSERT
  WITH CHECK (is_admin());

-- NOTE: no UPDATE policy on notification_recipients — read flag updated via
-- mark_notification_read() / mark_all_notifications_read() RPCs (RLS applies).

-- DELETE: admin only
CREATE POLICY notification_recipients_delete_admin
  ON notification_recipients FOR DELETE
  USING (is_admin());

-- facility_settings SKIPPED — see header comment.

-- ==========================
-- 5. GRANTS
-- ==========================

-- Revoke everything from anon and PUBLIC; let RLS + authenticated grant gate access.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;

-- Allow authenticated users to use the public schema and interact with tables.
-- Row-level access is gated by policies above; these are the privilege-level gates.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO authenticated;

-- Future migration tables inherit secure defaults
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ==========================
-- 6. FUNCTION EXECUTION GRANTS
-- ==========================

-- Revoke EXECUTE on all public functions from PUBLIC (trigger-only funcs don't need grants)
REVOKE EXECUTE ON FUNCTION
  public.set_updated_at(),
  public.has_role(text),
  public.is_admin(),
  public.handle_new_user(),
  public.book_appointment(text,text,text,timestamptz,uuid,text),
  public.mark_notification_read(uuid),
  public.mark_all_notifications_read()
FROM PUBLIC;

-- Grant EXECUTE on helper/RPC functions to authenticated users
-- set_updated_at and handle_new_user are trigger-only — no EXECUTE grant needed.
GRANT EXECUTE ON FUNCTION
  public.has_role(text),
  public.is_admin(),
  public.mark_notification_read(uuid),
  public.mark_all_notifications_read()
TO authenticated;

-- book_appointment is the public booking entry point — grant to anon AND authenticated
GRANT EXECUTE ON FUNCTION
  public.book_appointment(text,text,text,timestamptz,uuid,text)
TO anon, authenticated;
