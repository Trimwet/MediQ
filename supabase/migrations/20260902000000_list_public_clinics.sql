-- ============================================================================
-- MediQ — Public Clinics List RPC
-- Date: 2026-09-02
-- Purpose: Expose active clinics for public / anon booking page dropdown
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_public_clinics()
RETURNS TABLE (id uuid, name text, slug text)
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT c.id, c.name, c.slug
  FROM public.clinics c
  WHERE c.status = 'active'
  ORDER BY c.name;
$$;

COMMENT ON FUNCTION public.list_public_clinics() IS
  'Returns active clinics for public booking selection.';

GRANT EXECUTE ON FUNCTION public.list_public_clinics()
TO anon, authenticated;
