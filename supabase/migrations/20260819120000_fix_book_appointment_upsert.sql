-- Fix: book_appointment() upsert — use INSERT … ON CONFLICT DO UPDATE so that
-- returning patients have their name and phone kept current.
-- The partial unique index (patients_email_unique_idx) on lower(email) WHERE
-- email IS NOT NULL is referenced via the expression form of ON CONFLICT.
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_name          text,
  p_email         text,
  p_phone         text,
  p_scheduled_for timestamptz,
  p_doctor_id     uuid DEFAULT NULL,
  p_reason        text DEFAULT NULL
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_email text;
  v_doctor_name   text;
  v_id            uuid;
BEGIN
  v_patient_email := lower(p_email);

  -- Upsert patient: insert on first booking, update name/phone on repeat visits
  -- so returning patients always have their latest contact details recorded.
  INSERT INTO public.patients (name, phone, email)
  VALUES (p_name, p_phone, v_patient_email)
  ON CONFLICT (lower(email))
    WHERE email IS NOT NULL
  DO UPDATE SET
    name  = EXCLUDED.name,
    phone = EXCLUDED.phone;

  -- Resolve doctor name from the doctors table (never trust client input).
  IF p_doctor_id IS NOT NULL THEN
    SELECT name INTO v_doctor_name
    FROM public.doctors
    WHERE id = p_doctor_id;
  END IF;

  INSERT INTO public.appointments (
    patient_name, patient_email, doctor_id, doctor_name,
    scheduled_for, status, reason
  ) VALUES (
    p_name, v_patient_email, p_doctor_id, v_doctor_name,
    p_scheduled_for, 'pending'::appointment_status, p_reason
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.book_appointment(text,text,text,timestamptz,uuid,text) IS
  'Anonymous/self-service booking entry point. Atomic patient upsert + appointment insert. '
  'Status is locked to pending — never client-supplied. Email is lowercased. '
  'Repeat bookings update name and phone. Doctor name resolved from doctors table.';
