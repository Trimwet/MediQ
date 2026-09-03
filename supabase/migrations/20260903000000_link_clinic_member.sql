-- ============================================================================
-- 20260903 — link_clinic_member
--
-- Inviting someone whose auth account already exists (e.g. re-invited at a
-- second clinic, or invited after self-signing up at /sign-up) cannot be
-- completed from the anon browser client: the client never sees the existing
-- user's id, so clinic_members + profiles.role + doctors.user_id were all
-- skipped (audit BB-04 / repos TODO on doctors.user_id).
--
-- This RPC closes that gap server-side:
--   1. verifies the caller is a clinic admin (or global admin),
--   2. resolves the auth user by email (SECURITY DEFINER can read auth.users),
--   3. upserts clinic_members,
--   4. syncs profiles.role,
--   5. backfills doctors.user_id so RLS user_is_this_doctor matches by id
--      instead of falling back to email.
--
-- Callers that hit the "already been registered" path in the staff dialog
-- invoke it via supabase.rpc('link_clinic_member', …). It is idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_clinic_member(
  p_clinic_id uuid,
  p_email    text,
  p_role     text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_role    user_role;
BEGIN
  -- Authorize: global admin OR admin of the target clinic.
  IF NOT (is_admin() OR user_is_clinic_admin(p_clinic_id)) THEN
    RAISE EXCEPTION 'Forbidden: only clinic admins can link members';
  END IF;

  IF p_role NOT IN ('admin', 'front_desk', 'doctor') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
  v_role := p_role::user_role;

  -- Resolve the existing account (auth.user emails are stored lowercase).
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Membership (upsert so re-invites / role changes are idempotent).
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (p_clinic_id, v_user_id, v_role)
  ON CONFLICT (clinic_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- Keep the profile role in sync (RBAC has_role reads profiles.role).
  UPDATE public.profiles
  SET role = v_role
  WHERE id = v_user_id
    AND role <> v_role;

  -- Doctors: link directory rows to the auth account so user_is_this_doctor
  -- matches on user_id (email is the fallback branch only).
  UPDATE public.doctors
  SET user_id = v_user_id
  WHERE lower(email) = lower(p_email)
    AND (user_id IS NULL OR user_id <> v_user_id);

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_clinic_member(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_clinic_member(uuid, text, text) TO authenticated;
