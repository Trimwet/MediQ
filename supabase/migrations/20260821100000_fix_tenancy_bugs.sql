-- ============================================================================
-- MediQ — Fix migration #3 (tenancy audit fixes)
-- Date: 2026-08-21
-- Purpose: Fix bugs found by a security audit in the multi-tenant clinics
--          feature.  All statements are idempotent (DROP IF EXISTS /
--          CREATE OR REPLACE / CASCADE where needed).
--
-- Bugs fixed:
--   1. Cancel-rewrite: the UPDATE policy's WITH CHECK only constrains
--      status, so patients could overwrite arbitrary appointment fields
--      while cancelling.  Added a BEFORE UPDATE trigger.
--   2. Notification read: clinics migration dropped
--      notification_recipients_update_own; the SECURITY INVOKER RPCs then
--      silently update 0 rows.  Recreated as SECURITY DEFINER (safe —
--      uuid input only, auth.uid() filter, no injection vector).
--   3. Case-sensitive email matching: sync_staff_role_to_profile,
--      handle_new_user, and link_doctor_user_id all use bare email =
--      comparisons which fail when auth.users.email has different casing.
--      All lookups changed to lower(email) = lower(...).
--   4. link_doctor_user_id early-return: returned early when user_id was
--      already set, even on UPDATE OF email.  When email changes the
--      mapping must be re-resolved.  Fixed: only skip on INSERT.
--   5. staff_select_staff duplicate: clinics migration replaces it with
--      staff_select_clinic; safety re-drop for stale state.
-- ============================================================================

-- ============================================================================
-- 1. CANCEL-PROTECTION TRIGGER
-- ============================================================================
-- Without this, the appointments UPDATE policy (WITH CHECK only constrains
-- status to 'cancelled') allows patients to overwrite patient_name,
-- patient_email, doctor_id, doctor_name, scheduled_for, reason, and
-- rejection_reason in the same UPDATE that sets status = 'cancelled'.

CREATE OR REPLACE FUNCTION public.protect_appointment_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
  THEN
    IF NEW.patient_name    IS DISTINCT FROM OLD.patient_name
       OR NEW.patient_email IS DISTINCT FROM OLD.patient_email
       OR NEW.doctor_id     IS DISTINCT FROM OLD.doctor_id
       OR NEW.doctor_name   IS DISTINCT FROM OLD.doctor_name
       OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
       OR NEW.reason        IS DISTINCT FROM OLD.reason
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    THEN
      RAISE EXCEPTION 'Cancellation may not modify other appointment fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_appointment_cancel_protect ON public.appointments;
CREATE TRIGGER on_appointment_cancel_protect
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_appointment_cancel();

-- ============================================================================
-- 2. NOTIFICATION READ FIX — SECURITY DEFINER
-- ============================================================================
-- The clinics migration (20260821000000) dropped
-- notification_recipients_update_own.  The mark_* RPCs are SECURITY
-- INVOKER, so UPDATEs now silently affect 0 rows (no UPDATE policy
-- = RLS denies the write).
--
-- Recreating as SECURITY DEFINER is safe:
--   • The only input is a typed uuid (no SQL injection possible).
--   • auth.uid() returns the calling user's JWT uid even in DEFINER
--     context (Supabase-specific, not affected by session_user change).
--   • RLS could not constrain which columns change (read, read_at) —
--     the function already locks those columns.

DROP POLICY IF EXISTS notification_recipients_update_own
  ON public.notification_recipients;

DROP FUNCTION IF EXISTS public.mark_notification_read(uuid);
CREATE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  UPDATE public.notification_recipients
  SET read = true, read_at = now()
  WHERE notification_id = p_notification_id
    AND user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.mark_notification_read(uuid) IS
  'SECURITY DEFINER: marks a single notification as read for the calling '
  'user.  Safe because the only input is a typed uuid and auth.uid() '
  'filters to the caller''s own rows.  RLS could not constrain column '
  'values (read, read_at), so SECURITY DEFINER is required.';

DROP FUNCTION IF EXISTS public.mark_all_notifications_read();
CREATE FUNCTION public.mark_all_notifications_read()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  UPDATE public.notification_recipients
  SET read = true, read_at = now()
  WHERE user_id = auth.uid()
    AND read = false;
$$;

COMMENT ON FUNCTION public.mark_all_notifications_read() IS
  'SECURITY DEFINER: marks all unread notifications as read for the '
  'calling user.  No parameters — auth.uid() provides the user filter.';

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read()
  TO authenticated;

-- ============================================================================
-- 3. CASE-INSENSITIVE EMAIL MATCHING
-- ============================================================================
-- auth.users.email is normalised by Supabase, but staff/doctors rows may
-- store mixed-case emails.  All lookups switched to
-- lower(email) = lower(...) for robustness.

-- ---------------------------------------------------------------------------
-- 3a. sync_staff_role_to_profile()
-- Latest version (20260820700000): DECLARE v_user_id, links/unlinks
-- doctors.  DROP + CREATE required: same SECURITY DEFINER, but DROP+CREATE
-- is safer for signature certainty when replacing the body.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.sync_staff_role_to_profile() CASCADE;
CREATE FUNCTION public.sync_staff_role_to_profile()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT id INTO v_user_id
      FROM auth.users
     WHERE lower(email) = lower(NEW.email)
     LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      UPDATE public.profiles
         SET role = NEW.role::text::user_role
       WHERE id = v_user_id;

      IF NEW.role = 'doctor' THEN
        UPDATE public.doctors
           SET user_id = v_user_id
         WHERE lower(email) = lower(NEW.email)
           AND user_id IS NULL;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO v_user_id
      FROM auth.users
     WHERE lower(email) = lower(OLD.email)
     LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      UPDATE public.profiles
         SET role = 'patient'::user_role
       WHERE id = v_user_id;

      IF OLD.role = 'doctor' THEN
        UPDATE public.doctors
           SET user_id = NULL
         WHERE user_id = v_user_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- CASCADE dropped the trigger — recreate it.
DROP TRIGGER IF EXISTS on_staff_change ON public.staff;
CREATE TRIGGER on_staff_change
  AFTER INSERT OR UPDATE OR DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_staff_role_to_profile();

-- ---------------------------------------------------------------------------
-- 3b. handle_new_user()
-- Staff lookup + doctor link must use lower().
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_role user_role;
BEGIN
  v_role := COALESCE(
    (SELECT role::text::user_role
       FROM public.staff
      WHERE lower(email) = lower(NEW.email)
      LIMIT 1),
    'patient'::user_role
  );

  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone'
  );

  IF v_role = 'doctor'::user_role THEN
    UPDATE public.doctors
       SET user_id = NEW.id
     WHERE lower(email) = lower(NEW.email)
       AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- CASCADE dropped the trigger — recreate it.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3c. link_doctor_user_id() — case-insensitive + early-return fix
--
-- Bug: old code returned early when NEW.user_id IS NOT NULL, even on
-- UPDATE OF email.  When the email changes the old mapping may be stale
-- and must be re-resolved.
--
-- Fix: only skip on INSERT when user_id is already set; on UPDATE (which
-- fires only WHEN NEW.email IS DISTINCT FROM OLD.email) always re-resolve.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.link_doctor_user_id() CASCADE;
CREATE FUNCTION public.link_doctor_user_id()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- INSERT: skip if user_id already set (defensive).
  -- UPDATE OF email: always re-resolve — the trigger fires because email
  -- changed, so the old user_id may no longer be correct.
  IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(NEW.email)
   LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    NEW.user_id := v_user_id;

    UPDATE public.profiles
       SET role = 'doctor'::user_role
     WHERE id = v_user_id
       AND role <> 'doctor'::user_role;
  END IF;

  RETURN NEW;
END;
$$;

-- CASCADE dropped both triggers — recreate them.
DROP TRIGGER IF EXISTS on_doctor_insert ON public.doctors;
CREATE TRIGGER on_doctor_insert
  BEFORE INSERT ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.link_doctor_user_id();

DROP TRIGGER IF EXISTS on_doctor_update ON public.doctors;
CREATE TRIGGER on_doctor_update
  BEFORE UPDATE OF email ON public.doctors
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.link_doctor_user_id();

-- ============================================================================
-- 4. DEDUPLICATE staff SELECT policy
-- ============================================================================
-- Clinics migration creates staff_select_clinic and drops
-- staff_select_staff.  Safety re-drop for stale state.

DROP POLICY IF EXISTS staff_select_staff ON public.staff;

-- ============================================================================
-- 5. BACKFILL — case-insensitive doctor ↔ auth linking
-- ============================================================================
-- Prior migrations used case-sensitive email matching; re-run with lower()
-- to catch any missed links.

UPDATE public.doctors d
   SET user_id = (
     SELECT id FROM auth.users u
      WHERE lower(u.email) = lower(d.email)
      LIMIT 1
   )
 WHERE d.user_id IS NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
