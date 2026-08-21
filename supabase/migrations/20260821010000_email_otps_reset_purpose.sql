-- Extend the email OTP purpose enum to include password resets.
-- Applied after 20260821000000_email_otps.sql, so both fresh installs and
-- already-migrated databases end up with the same constraint.
ALTER TABLE public.email_otps DROP CONSTRAINT IF EXISTS email_otps_purpose_check;
ALTER TABLE public.email_otps
  ADD CONSTRAINT email_otps_purpose_check
  CHECK (purpose IN ('signin', 'signup', 'reset'));