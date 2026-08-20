-- ============================================================================
-- Fix #3: Ensure doctors.user_id is linked for any new doctor row whose email
-- already has an auth account at insert time.
--
-- Problem: The sync_staff_role_to_profile trigger (on the staff table) links
-- doctors.user_id when a *staff* row is inserted/updated. But if someone adds
-- a doctor directly via the doctors table (e.g. through the admin UI's doctor
-- dialog), there is no staff-table INSERT to fire that trigger, so
-- doctors.user_id stays NULL and the doctor's RLS policy returns empty.
--
-- Fix: Add a dedicated BEFORE INSERT trigger on the doctors table itself that
-- resolves user_id from auth.users at insert time, and an AFTER UPDATE trigger
-- that does the same when the email changes.
-- ============================================================================

-- 3a. Trigger function: link doctors.user_id on INSERT or email UPDATE.
CREATE OR REPLACE FUNCTION public.link_doctor_user_id()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Only attempt link when user_id is not already set (or on email change).
  IF NEW.user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = NEW.email
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    NEW.user_id := v_user_id;

    -- Also ensure the profile role is 'doctor'.
    UPDATE public.profiles
    SET role = 'doctor'::user_role
    WHERE id = v_user_id
      AND role <> 'doctor'::user_role;
  END IF;

  RETURN NEW;
END;
$$;

-- 3b. Fire the link function BEFORE INSERT so the inserted row already has
--     user_id populated (no separate UPDATE needed).
DROP TRIGGER IF EXISTS on_doctor_insert ON public.doctors;
CREATE TRIGGER on_doctor_insert
  BEFORE INSERT ON public.doctors
  FOR EACH ROW
  EXECUTE FUNCTION public.link_doctor_user_id();

-- 3c. Also fire on UPDATE in case the doctor's email is corrected later.
DROP TRIGGER IF EXISTS on_doctor_update ON public.doctors;
CREATE TRIGGER on_doctor_update
  BEFORE UPDATE OF email ON public.doctors
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.link_doctor_user_id();

-- 3d. Back-fill: link any existing doctor rows that still have NULL user_id.
UPDATE public.doctors d
SET user_id = (
  SELECT id FROM auth.users u WHERE u.email = d.email LIMIT 1
)
WHERE d.user_id IS NULL;
