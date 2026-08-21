-- ============================================================================
-- MediQ — Reminder Logs + Due Reminders Function
-- Date: 2026-08-22
-- Purpose: Add reminder_logs table to track sent appointment reminders and
--          a get_due_reminders() helper that selects appointments due for a
--          24h or 2h reminder within a configurable window.
--
-- Design:
--   - reminder_logs is idempotent via unique(appointment_id, type) — a
--     duplicate insert from a retry simply errors on the constraint.
--   - get_due_reminders() is SECURITY DEFINER so it can be called by the
--     Edge Function (service role) without RLS interference.
--   - Clinic scoping: the table carries clinic_id (set null on delete)
--     and the function returns clinic_id for downstream email routing.
--
-- Cron setup (done manually in Supabase Dashboard):
--   Schedule: every 5 minutes
--   Target:   POST https://<project-ref>.supabase.co/functions/v1/send-appointment-reminders
--   Headers:  Authorization: Bearer <service-role-anon-key>
-- ============================================================================

-- ==========================
-- 1. TABLE
-- ==========================

CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('24h', '2h')),
  sent_at        timestamptz NOT NULL DEFAULT now(),
  channel        text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'in_app')),
  status         text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  clinic_id      uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  UNIQUE (appointment_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_appointment_id
  ON public.reminder_logs (appointment_id);

-- ==========================
-- 2. RLS
-- ==========================

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminder_logs_select_roles
  ON public.reminder_logs FOR SELECT
  USING (is_admin() OR has_role('front_desk'));

-- ==========================
-- 3. GRANTS
-- ==========================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_logs TO authenticated;
REVOKE ALL ON public.reminder_logs FROM anon;

-- ==========================
-- 4. get_due_reminders()
-- ==========================
-- Returns appointments that need a reminder of the given type within the
-- specified window.  An appointment is "due" if:
--   - status is pending or booked (active, not yet completed/cancelled)
--   - patient_email is set (we need somewhere to send the reminder)
--   - scheduled_for falls within the window:
--       now() + interval -<window>  ...  now() + interval +<window>
--     offset from the target time (24h or 2h before the appointment)
--   - No existing reminder_logs row for the same appointment + type
--     (idempotency guard)

CREATE OR REPLACE FUNCTION public.get_due_reminders(
  p_type text,
  p_window_minutes int DEFAULT 5
)
RETURNS TABLE (
  appointment_id uuid,
  patient_email  text,
  patient_name   text,
  doctor_name    text,
  scheduled_for  timestamptz,
  clinic_id      uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    a.id,
    a.patient_email,
    a.patient_name,
    a.doctor_name,
    a.scheduled_for,
    a.clinic_id
  FROM public.appointments a
  WHERE a.status IN ('pending', 'booked')
    AND a.patient_email IS NOT NULL
    AND a.scheduled_for BETWEEN
          now() + (CASE WHEN p_type = '24h' THEN interval '24 hours'
                        WHEN p_type = '2h'  THEN interval '2 hours'
                   END)
          - (p_window_minutes || ' minutes')::interval
        AND
          now() + (CASE WHEN p_type = '24h' THEN interval '24 hours'
                        WHEN p_type = '2h'  THEN interval '2 hours'
                   END)
          + (p_window_minutes || ' minutes')::interval
    AND NOT EXISTS (
      SELECT 1
      FROM public.reminder_logs r
      WHERE r.appointment_id = a.id
        AND r.type = p_type
    )
  ORDER BY a.scheduled_for;
$$;

COMMENT ON FUNCTION public.get_due_reminders(text, int) IS
  'Returns appointments due for a reminder (24h or 2h) within the given '
  'window. SECURITY DEFINER so the Edge Function can call it without RLS. '
  'Idempotent: an appointment that already has a reminder_logs row for '
  'this type is excluded.';

GRANT EXECUTE ON FUNCTION public.get_due_reminders(text, int)
  TO authenticated, service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
