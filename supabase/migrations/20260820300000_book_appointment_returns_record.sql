-- Fix: Modify book_appointment to return the full appointment record so the frontend
-- doesn't need to do a separate SELECT (which can fail due to RLS if the user isn't authenticated
-- or if they book for a different email).

DROP FUNCTION IF EXISTS public.book_appointment(text,text,text,timestamptz,uuid,text);

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_name          text,
  p_email         text,
  p_phone         text,
  p_scheduled_for timestamptz,
  p_doctor_id     uuid DEFAULT NULL,
  p_reason        text DEFAULT NULL
)
RETURNS public.appointments
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $body
DECLARE
  v_patient_email text;
  v_doctor_name   text;
  v_appointment   public.appointments;
BEGIN
  v_patient_email := lower(p_email);

  INSERT INTO public.patients (name, phone, email)
  VALUES (p_name, p_phone, v_patient_email)
  ON CONFLICT (lower(email))
    WHERE email IS NOT NULL
  DO UPDATE SET
    name  = EXCLUDED.name,
    phone = EXCLUDED.phone;

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
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$body;