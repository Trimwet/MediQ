-- ============================================================================
-- Fix #6: Re-grant EXECUTE on book_appointment() after the function was
-- dropped and recreated in migration 20260820300000 with a different return
-- type (uuid → public.appointments).
--
-- In PostgreSQL, function grants are bound to the exact function signature.
-- Dropping and recreating a function removes all prior grants, so the
-- GRANT from the init migration no longer applies to the new version.
-- Anonymous (unauthenticated) visitors can no longer self-book until this is
-- applied.
-- ============================================================================

GRANT EXECUTE ON FUNCTION
  public.book_appointment(text, text, text, timestamptz, uuid, text)
TO anon, authenticated;
