-- Email OTP codes for the 2FA step on sign-in / sign-up.
--
-- Codes are stored hashed (never plaintext) and are only touched by the
-- send-otp / verify-otp Edge Functions using the service role, so no RLS
-- policies or grants are needed — the table is fully locked down.
CREATE TABLE IF NOT EXISTS public.email_otps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  purpose     text NOT NULL CHECK (purpose IN ('signin', 'signup', 'reset')),
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_otps_lookup_idx
  ON public.email_otps (email, purpose, created_at DESC);

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;