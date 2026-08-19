-- Fix: book_appointment() upsert — ON CONFLICT ON CONSTRAINT cannot reference
-- a unique INDEX (patients_email_unique_idx). Replace with NOT EXISTS guard.
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

  -- Upsert patient (partial unique index on lower(email) WHERE email IS NOT NULL)
  INSERT INTO public.patients (name, phone, email)
  SELECT p_name, p_phone, v_patient_email
  WHERE NOT EXISTS (
    SELECT 1 FROM public.patients WHERE lower(email) = v_patient_email AND email IS NOT NULL
  );

  -- Resolve doctor name from the doctors table (never trust client input)
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
