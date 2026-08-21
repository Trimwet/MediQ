-- ============================================================================
-- MediQ — Self-Serve Clinic Creation RPC
-- Date: 2026-08-23
-- Purpose: Allow any authenticated user to create a new clinic and become its
--          admin. Previously, only global admins (is_admin()) could INSERT
--          into public.clinics. This RPC is SECURITY DEFINER so it bypasses
--          the clinics INSERT policy while still enforcing auth + validation.
--
-- Idempotent: uses CREATE OR REPLACE. No RLS changes needed.
-- ============================================================================

-- ==========================
-- 1. create_clinic RPC
-- ==========================

CREATE OR REPLACE FUNCTION public.create_clinic(
  p_name  text,
  p_slug  text,
  p_plan  text DEFAULT 'professional'
)
RETURNS public.clinics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clinic clinics;
  v_slug   text;
  v_plan   text;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate name
  IF p_name IS NULL OR char_length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Clinic name must be at least 2 characters';
  END IF;

  IF char_length(p_name) > 80 THEN
    RAISE EXCEPTION 'Clinic name too long';
  END IF;

  -- Normalize and validate slug
  v_slug := lower(trim(p_slug));

  IF v_slug IS NULL OR v_slug = '' THEN
    RAISE EXCEPTION 'Slug is required';
  END IF;

  IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Slug must be lowercase alphanumeric with hyphens (e.g. lagos-family)';
  END IF;

  IF char_length(v_slug) < 3 OR char_length(v_slug) > 63 THEN
    RAISE EXCEPTION 'Slug must be 3-63 characters';
  END IF;

  IF v_slug IN ('api','admin','auth','create-clinic','sign-in','sign-up','book','dashboard','settings') THEN
    RAISE EXCEPTION 'Slug is reserved';
  END IF;

  -- Validate plan
  v_plan := lower(coalesce(p_plan, 'professional'));

  IF v_plan NOT IN ('starter','professional','enterprise') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  -- Check slug not taken
  IF EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'Slug already taken';
  END IF;

  -- Insert clinic
  INSERT INTO public.clinics (name, slug, plan, status)
  VALUES (trim(p_name), v_slug, v_plan, 'active')
  RETURNING * INTO v_clinic;

  -- Insert membership as admin
  INSERT INTO public.clinic_members (clinic_id, user_id, role)
  VALUES (v_clinic.id, auth.uid(), 'admin'::user_role);

  RETURN v_clinic;
END;
$$;

-- ==========================
-- 2. Comment
-- ==========================

COMMENT ON FUNCTION public.create_clinic(text, text, text) IS
  'Self-serve clinic creation. Any authenticated user can create a clinic '
  'and becomes its admin. Validates name (2-80 chars), slug (3-63, lowercase '
  'alphanumeric + hyphens, not reserved, unique), and plan (starter/professional/enterprise). '
  'SECURITY DEFINER: bypasses clinics INSERT policy.';

-- ==========================
-- 3. Grants
-- ==========================

GRANT EXECUTE ON FUNCTION public.create_clinic(text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_clinic(text, text, text) FROM anon, PUBLIC;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
