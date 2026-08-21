  -- ============================================================================
  -- MediQ — Security-audit warning fixes (2026-08-21)
  -- Date: 2026-08-21
  -- Purpose: Address the 7 WARNING + 2 INFO findings from the tenancy security
  --          audit.  All statements are idempotent (DROP IF EXISTS /
  --          CREATE OR REPLACE).  No signature changes: 7-arg book_appointment
  --          and list_public_doctors(uuid) are unchanged.
  --
  -- Fixes applied:
  --   W1  book_appointment: validate clinic exists and is active
  --   W2  Appointments SELECT/UPDATE: hoist patient clause outside membership
  --   W3  protect_appointment_cancel: remove rejection_reason pin, add
  --       already-cancelled guard
  --   W4  link_doctor_user_id: clear stale user_id when email has no match
  --   W5  appointments INSERT: reject cross-clinic doctor_id
  --   W6  list_public_doctors: scope NULL filter to default clinic
  --   W7  Clinic-admin role: allow user_is_clinic_admin on clinic-scoped ops
  --   I3  REVOKE EXECUTE FROM PUBLIC on three SECURITY DEFINER helpers
  --   I1  Remove dead v_patient_id variable in book_appointment
  -- ============================================================================


  -- ============================================================================
  -- W1 + I1: book_appointment — active-clinic validation, remove dead variable
  -- ============================================================================
  -- W1: After resolving v_clinic_id, verify the clinic exists AND status='active'
  --     to prevent anon/authenticated callers from writing into any clinic.
  -- I1: Remove unused v_patient_id variable (SELECT INTO result never used).

  DROP FUNCTION IF EXISTS public.book_appointment(text,text,text,timestamptz,uuid,text,uuid);

  CREATE OR REPLACE FUNCTION public.book_appointment(
    p_name          text,
    p_email         text,
    p_phone         text,
    p_scheduled_for timestamptz,
    p_doctor_id     uuid DEFAULT NULL,
    p_reason        text DEFAULT NULL,
    p_clinic_id     uuid DEFAULT NULL
  )
  RETURNS public.appointments
  SECURITY DEFINER
  SET search_path = public, pg_temp
  LANGUAGE plpgsql
  AS $$
  DECLARE
    v_clinic_id   uuid;
    v_doctor_name text;
    v_appointment public.appointments;
  BEGIN
    -- Resolve clinic: explicit arg or fall back to the default clinic
    v_clinic_id := COALESCE(
      p_clinic_id,
      (SELECT id FROM public.clinics WHERE slug = 'default' LIMIT 1)
    );

    IF v_clinic_id IS NULL THEN
      RAISE EXCEPTION 'No clinic specified and no default clinic found.';
    END IF;

    -- W1: Validate the clinic exists and is active
    IF NOT EXISTS (
      SELECT 1 FROM public.clinics
      WHERE id = v_clinic_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Clinic is not active or does not exist';
    END IF;

    -- If a doctor was specified, validate it belongs to this clinic and get name
    IF p_doctor_id IS NOT NULL THEN
      SELECT name INTO v_doctor_name
      FROM public.doctors
      WHERE id = p_doctor_id AND clinic_id = v_clinic_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Doctor % does not belong to clinic %', p_doctor_id, v_clinic_id;
      END IF;
    END IF;

    -- Upsert patient (partial unique index patients_email_unique_idx on lower(email))
    INSERT INTO public.patients (name, phone, email, clinic_id)
    VALUES (p_name, p_phone, lower(p_email), v_clinic_id)
    ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO NOTHING;

    -- Insert appointment
    INSERT INTO public.appointments (
      patient_name, patient_email, doctor_id, doctor_name,
      scheduled_for, status, reason, clinic_id
    ) VALUES (
      p_name, lower(p_email), p_doctor_id, v_doctor_name,
      p_scheduled_for, 'pending'::appointment_status, p_reason, v_clinic_id
    )
    RETURNING * INTO v_appointment;

    RETURN v_appointment;
  END;
  $$;

  COMMENT ON FUNCTION public.book_appointment(text,text,text,timestamptz,uuid,text,uuid) IS
    'Clinic-aware booking entry point. Resolves clinic from p_clinic_id or the '
    '"default" slug. Validates doctor membership and clinic active status. '
    'Atomic patient upsert + appointment insert. Status locked to pending.';

  GRANT EXECUTE ON FUNCTION
    public.book_appointment(text,text,text,timestamptz,uuid,text,uuid)
  TO anon, authenticated;


  -- ============================================================================
  -- W2: Appointments SELECT + UPDATE — hoist patient clause outside membership
  -- ============================================================================
  -- Patients are never clinic members (clinic_members.role CHECK excludes
  -- 'patient').  The patient clause must sit outside user_in_clinic() so that
  -- patients can see and cancel their own appointments without membership.
  -- AND binds tighter than OR, so:
  --   (user_in_clinic(clinic_id) AND staff_check)
  --   OR (lower(patient_email) = lower(auth.jwt()->>'email'))
  -- lets patients through without membership while staff still need membership.

  DROP POLICY IF EXISTS appointments_select_clinic ON public.appointments;
  DROP POLICY IF EXISTS appointments_update_clinic ON public.appointments;

  CREATE POLICY appointments_select_clinic
    ON public.appointments FOR SELECT
    USING (
      user_in_clinic(clinic_id)
      AND (
        is_admin()
        OR has_role('front_desk')
        OR (has_role('doctor') AND user_is_this_doctor(doctor_id))
      )
      OR (lower(patient_email) = lower(auth.jwt()->>'email'))
    );

  CREATE POLICY appointments_update_clinic
    ON public.appointments FOR UPDATE
    USING (
      user_in_clinic(clinic_id)
      AND (
        is_admin()
        OR has_role('front_desk')
      )
      OR (lower(patient_email) = lower(auth.jwt()->>'email'))
    )
    WITH CHECK (
      user_in_clinic(clinic_id)
      AND (
        is_admin()
        OR has_role('front_desk')
      )
      OR (lower(patient_email) = lower(auth.jwt()->>'email')
          AND status = 'cancelled')
    );


  -- ============================================================================
  -- W3: protect_appointment_cancel — refine trigger
  -- ============================================================================
  -- (a) On transition TO cancelled: remove rejection_reason from the pinned
  --     list (staff may legitimately set it in the same UPDATE).  Add role
  --     check so only non-staff are blocked from modifying other fields.
  -- (b) On already-cancelled rows (OLD.status = NEW.status = 'cancelled'):
  --     block changes to patient_name, patient_email, doctor_id, doctor_name,
  --     scheduled_for, and reason.  rejection_reason is still allowed.

  DROP TRIGGER IF EXISTS on_appointment_cancel_protect ON public.appointments;
  DROP FUNCTION IF EXISTS public.protect_appointment_cancel();

  CREATE OR REPLACE FUNCTION public.protect_appointment_cancel()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  AS $$
  BEGIN
    -- Guard 1: Transitioning INTO cancelled
    -- Staff (admin/front_desk/doctor) may set rejection_reason freely.
    -- Non-staff (patients) may not modify other fields during cancellation.
    IF NEW.status = 'cancelled'
      AND OLD.status IS DISTINCT FROM 'cancelled'
    THEN
      IF NOT (public.is_admin() OR public.has_role('front_desk') OR public.has_role('doctor'))
      THEN
        IF NEW.patient_name    IS DISTINCT FROM OLD.patient_name
          OR NEW.patient_email IS DISTINCT FROM OLD.patient_email
          OR NEW.doctor_id     IS DISTINCT FROM OLD.doctor_id
          OR NEW.doctor_name   IS DISTINCT FROM OLD.doctor_name
          OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
          OR NEW.reason        IS DISTINCT FROM OLD.reason
        THEN
          RAISE EXCEPTION 'Cancellation may not modify other appointment fields';
        END IF;
      END IF;
    END IF;

    -- Guard 2: Already cancelled — lock most fields, rejection_reason still allowed
    IF OLD.status = 'cancelled' AND NEW.status = 'cancelled' THEN
      IF NEW.patient_name    IS DISTINCT FROM OLD.patient_name
        OR NEW.patient_email IS DISTINCT FROM OLD.patient_email
        OR NEW.doctor_id     IS DISTINCT FROM OLD.doctor_id
        OR NEW.doctor_name   IS DISTINCT FROM OLD.doctor_name
        OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
        OR NEW.reason        IS DISTINCT FROM OLD.reason
      THEN
        RAISE EXCEPTION 'Cancelled appointment fields are locked';
      END IF;
    END IF;

    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER on_appointment_cancel_protect
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_appointment_cancel();


  -- ============================================================================
  -- W4: link_doctor_user_id — clear stale user_id on email re-link
  -- ============================================================================
  -- When UPDATE OF email fires and the new email matches no auth.users row,
  -- the old user_id was left stale (the former account retains doctor-scoped
  -- RLS visibility).  Fix: SET NEW.user_id = NULL when no match found.

  CREATE OR REPLACE FUNCTION public.link_doctor_user_id()
  RETURNS trigger
  SECURITY DEFINER
  SET search_path = public, pg_temp
  LANGUAGE plpgsql
  AS $$
  DECLARE
    v_user_id uuid;
  BEGIN
    -- INSERT: skip if user_id already set (defensive).
    -- UPDATE OF email: always re-resolve — the trigger fires because email
    -- changed, so the old user_id may no longer be correct.
    IF TG_OP = 'INSERT' AND NEW.user_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_user_id
      FROM auth.users
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
      NEW.user_id := v_user_id;

      UPDATE public.profiles
        SET role = 'doctor'::user_role
      WHERE id = v_user_id
        AND role <> 'doctor'::user_role;
    ELSE
      NEW.user_id := NULL;
    END IF;

    RETURN NEW;
  END;
  $$;


  -- ============================================================================
  -- W5: appointments INSERT — reject cross-clinic doctor_id
  -- ============================================================================
  -- The table-level INSERT policy must ensure that if a doctor_id is supplied,
  -- it belongs to the same clinic as the appointment.  The RPC already validates
  -- this, but the table policy is the backstop.

  DROP POLICY IF EXISTS appointments_insert_clinic ON public.appointments;

  CREATE POLICY appointments_insert_clinic
    ON public.appointments FOR INSERT
    WITH CHECK (
      user_in_clinic(clinic_id)
      AND (is_admin() OR has_role('front_desk'))
      AND (doctor_id IS NULL
          OR EXISTS (SELECT 1 FROM public.doctors d
                      WHERE d.id = doctor_id AND d.clinic_id = clinic_id))
    );


  -- ============================================================================
  -- W6: list_public_doctors — scope NULL filter to default clinic
  -- ============================================================================
  -- When p_clinic_id IS NULL, resolve the default clinic (slug='default')
  -- instead of returning doctors across ALL clinics to anon callers.

  CREATE OR REPLACE FUNCTION public.list_public_doctors(p_clinic_id uuid DEFAULT NULL)
  RETURNS TABLE (id uuid, name text, specialization text)
  SECURITY DEFINER
  STABLE
  SET search_path = public, pg_temp
  LANGUAGE sql
  AS $$
    SELECT d.id, d.name, d.specialization
    FROM public.doctors d
    WHERE d.status = 'active'::doctor_status
      AND d.clinic_id = COALESCE(
        p_clinic_id,
        (SELECT id FROM public.clinics WHERE slug = 'default' LIMIT 1)
      )
    ORDER BY d.name;
  $$;


  -- ============================================================================
  -- W7: Clinic-admin role consistency
  -- ============================================================================
  -- A clinic admin (role 'admin' in clinic_members) can add/remove members
  -- but could not manage doctors, staff, rooms, or their own clinic's plan/
  -- status.  Allow user_is_clinic_admin(clinic_id) alongside is_admin() on
  -- all clinic-scoped admin operations.  clinic DELETE stays global-admin
  -- only (destructive).

  -- --- doctors ---------------------------------------------------------------
  DROP POLICY IF EXISTS doctors_insert_clinic ON public.doctors;
  DROP POLICY IF EXISTS doctors_update_clinic ON public.doctors;
  DROP POLICY IF EXISTS doctors_delete_clinic ON public.doctors;

  CREATE POLICY doctors_insert_clinic
    ON public.doctors FOR INSERT
    WITH CHECK (user_in_clinic(clinic_id)
                AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  CREATE POLICY doctors_update_clinic
    ON public.doctors FOR UPDATE
    USING (user_in_clinic(clinic_id)
          AND (is_admin() OR user_is_clinic_admin(clinic_id)))
    WITH CHECK (user_in_clinic(clinic_id)
                AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  CREATE POLICY doctors_delete_clinic
    ON public.doctors FOR DELETE
    USING (user_in_clinic(clinic_id)
          AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  -- --- staff -----------------------------------------------------------------
  DROP POLICY IF EXISTS staff_insert_clinic ON public.staff;
  DROP POLICY IF EXISTS staff_update_clinic ON public.staff;
  DROP POLICY IF EXISTS staff_delete_clinic ON public.staff;

  CREATE POLICY staff_insert_clinic
    ON public.staff FOR INSERT
    WITH CHECK (user_in_clinic(clinic_id)
                AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  CREATE POLICY staff_update_clinic
    ON public.staff FOR UPDATE
    USING (user_in_clinic(clinic_id)
          AND (is_admin() OR user_is_clinic_admin(clinic_id)))
    WITH CHECK (user_in_clinic(clinic_id)
                AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  CREATE POLICY staff_delete_clinic
    ON public.staff FOR DELETE
    USING (user_in_clinic(clinic_id)
          AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  -- --- rooms -----------------------------------------------------------------
  DROP POLICY IF EXISTS rooms_insert_clinic ON public.rooms;
  DROP POLICY IF EXISTS rooms_update_clinic ON public.rooms;
  DROP POLICY IF EXISTS rooms_delete_clinic ON public.rooms;

  CREATE POLICY rooms_insert_clinic
    ON public.rooms FOR INSERT
    WITH CHECK (user_in_clinic(clinic_id)
                AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  CREATE POLICY rooms_update_clinic
    ON public.rooms FOR UPDATE
    USING (user_in_clinic(clinic_id)
          AND (is_admin() OR user_is_clinic_admin(clinic_id)))
    WITH CHECK (user_in_clinic(clinic_id)
                AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  CREATE POLICY rooms_delete_clinic
    ON public.rooms FOR DELETE
    USING (user_in_clinic(clinic_id)
          AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  -- --- clinics UPDATE (DELETE stays global-admin only) -----------------------
  DROP POLICY IF EXISTS clinics_update_admin ON public.clinics;

  CREATE POLICY clinics_update_admin
    ON public.clinics FOR UPDATE
    USING (is_admin() OR user_is_clinic_admin(id))
    WITH CHECK (is_admin() OR user_is_clinic_admin(id));

  -- --- notifications ---------------------------------------------------------
  DROP POLICY IF EXISTS notifications_insert_clinic ON public.notifications;
  DROP POLICY IF EXISTS notifications_delete_clinic ON public.notifications;

  CREATE POLICY notifications_insert_clinic
    ON public.notifications FOR INSERT
    WITH CHECK (user_in_clinic(clinic_id)
                AND (is_admin() OR user_is_clinic_admin(clinic_id)));

  CREATE POLICY notifications_delete_clinic
    ON public.notifications FOR DELETE
    USING (user_in_clinic(clinic_id)
          AND (is_admin() OR user_is_clinic_admin(clinic_id)));


  -- ============================================================================
  -- I3: REVOKE EXECUTE FROM PUBLIC on SECURITY DEFINER helpers
  -- ============================================================================
  -- These three helpers are SECURITY DEFINER and auth.uid()-scoped, so risk
  -- is low, but least-privilege says remove PUBLIC/anon EXECUTE.  Only
  -- authenticated callers need them (RLS policies run in the user's context).

  REVOKE EXECUTE ON FUNCTION
    public.user_in_clinic(uuid),
    public.user_is_clinic_admin(uuid),
    public.user_is_this_doctor(uuid)
  FROM PUBLIC, anon;

  GRANT EXECUTE ON FUNCTION
    public.user_in_clinic(uuid),
    public.user_is_clinic_admin(uuid),
    public.user_is_this_doctor(uuid)
  TO authenticated;


  -- ============================================================================
  -- END OF MIGRATION
  -- ============================================================================
