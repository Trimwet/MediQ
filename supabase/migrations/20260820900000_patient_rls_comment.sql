-- ============================================================================
-- Fix #12: Clarify why anonymous patient inserts work during self-service
-- booking despite the patients_insert_roles RLS policy requiring admin or
-- front_desk.
--
-- book_appointment() is declared SECURITY DEFINER, meaning it runs with the
-- privileges of the function owner (postgres / service role), not the caller.
-- RLS is therefore not applied to the INSERT INTO patients ... inside the
-- function body, regardless of the caller's role.
--
-- This is intentional and correct. The trade-off is that book_appointment()
-- must be carefully audited to avoid unintended privilege escalation — it
-- already locks status to 'pending', lowercases emails, and resolves doctor
-- names from the DB rather than trusting client input.
--
-- If book_appointment() were ever changed to SECURITY INVOKER, anonymous
-- patient inserts would silently fail (0 rows inserted, no error) because the
-- patients_insert_roles policy blocks anon. This comment exists to make that
-- risk explicit for future contributors.
--
-- No schema changes in this migration — documentation only.
-- ============================================================================

COMMENT ON FUNCTION public.book_appointment(text,text,text,timestamptz,uuid,text) IS
  'Anonymous/self-service booking entry point. '
  'SECURITY DEFINER: runs as the function owner, bypassing RLS for the '
  'internal patient upsert and appointment insert. '
  'Status is locked to pending — never client-supplied. '
  'Email is lowercased. Doctor name resolved from doctors table, not client input. '
  'If changed to SECURITY INVOKER, anonymous patient inserts will silently fail '
  'because patients_insert_roles blocks anon.';
