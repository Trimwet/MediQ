# Security Audit — Tenancy Migrations (2026-08-21)

Audit date: 2026-08-21
Auditor: Cobalt (defensive, read-only)
Scope:
- `supabase/migrations/20260821000000_clinics.sql` (663 lines)
- `supabase/migrations/20260821100000_fix_tenancy_bugs.sql` (330 lines)
Context reviewed: `20260819113813_init.sql` (baseline), `20260819120000`–`20260820900000` (history the new files replace), plus app callers `mediq-admin/src/data/supabase/repos.ts` and `mediq-admin/src/data/hooks.ts`.

## Verdict per file

| File | Verdict | BLOCKER | WARNING | INFO |
|---|---|---|---|---|
| 20260821000000_clinics.sql | SAFE TO DEPLOY with 6 warnings addressed (no privilege escalation, no SQLi, no RLS bypass) | 0 | 6 | 6 |
| 20260821100000_fix_tenancy_bugs.sql | SAFE TO DEPLOY (SECURITY DEFINER conversions are safe; trigger over-broad but not exploitable) | 0 | 1 | 1 |
| Total | | 0 | 7 | 7 |

No BLOCKERs. No privilege-escalation vector found. The SECURITY DEFINER functions are all
parameter-typed (no dynamic SQL), all set `search_path = public, pg_temp`, and all filter on
`auth.uid()` / hardcoded values. The two files are internally consistent and idempotent.

---

## Findings

### WARNING

#### W1. `book_appointment()` lets anon write appointments into ANY clinic (cross-tenant write)
- File: `20260821000000_clinics.sql:511-518` (clinic resolution), `:563` (anon grant)
- `v_clinic_id := COALESCE(p_clinic_id, default)`. No check that the caller is a member of
  `p_clinic_id`, and no check that `clinics.status = 'active'`. Because the function is
  `SECURITY DEFINER` (bypasses RLS), an anonymous caller who knows a clinic UUID — or any
  authenticated member of clinic A — can create a `pending` appointment in any other clinic,
  polluting another tenant's queue. UUIDs are unguessable (gen_random_uuid) so the practical
  risk is authenticated-members-abuse, not mass enumeration, hence WARNING not BLOCKER.
- Fix:
```sql
  -- inside book_appointment, after resolving v_clinic_id:
  IF NOT EXISTS (
    SELECT 1 FROM public.clinics
    WHERE id = v_clinic_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Clinic is not active or does not exist';
  END IF;
  -- optionally, for authenticated callers, require membership:
  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.clinic_members
                     WHERE clinic_id = v_clinic_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are not a member of this clinic';
  END IF;
```

#### W2. Patient self-service view/cancel is broken (over-scoped `user_in_clinic`)
- File: `20260821000000_clinics.sql:321-332` (SELECT policy), `:350-356` (UPDATE WITH CHECK)
- The patient clause `lower(patient_email) = lower(auth.jwt()->>'email')` sits INSIDE
  `user_in_clinic(clinic_id) AND (...)`. Patients are never clinic members: the backfill
  (`:641-648`) only adds `admin/front_desk/doctor`, and the `clinic_members.role` CHECK
  (`:35`) excludes `patient`. Result: patients can no longer see or cancel their own
  appointments — the exact flow the cancel-protection trigger in the fix migration exists to
  protect. Functional regression (denial of legitimate capability), not a privilege issue.
- Fix: hoist the patient branch out of the membership requirement:
```sql
CREATE POLICY appointments_select_clinic ON public.appointments FOR SELECT
  USING (
    user_in_clinic(clinic_id)
    AND (is_admin() OR has_role('front_desk')
         OR (has_role('doctor') AND doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())))
    OR (lower(patient_email) = lower(auth.jwt()->>'email'))
  );
-- and likewise in appointments_update_clinic's USING/WITH CHECK.
```

#### W3. `protect_appointment_cancel` is over-broad — blocks staff, misses already-cancelled rows
- File: `20260821100000_fix_tenancy_bugs.sql:35-57` (function), `:59-63` (trigger)
- (a) The trigger has no role check. It fires for EVERY user. A front_desk/admin who cancels
  an appointment AND legitimately records `rejection_reason` (or corrects `scheduled_for`,
  `doctor_id`) in the same UPDATE hits `RAISE EXCEPTION` (`:50` pins `rejection_reason`).
  RLS already authorizes staff to do this; the trigger silently takes it away.
- (b) It only fires when transitioning INTO `cancelled` (`:41-43`). A patient matching
  `patient_email` can still rewrite `patient_name`, `patient_email`, `reason`, etc. on an
  ALREADY-cancelled row (status stays `cancelled`, so the patient branch of the UPDATE policy
  `WITH CHECK` passes, and the trigger skips). Incomplete protection.
- Fix:
```sql
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF NOT (public.is_admin() OR public.has_role('front_desk') OR public.has_role('doctor'))
    THEN
      IF NEW.patient_name IS DISTINCT FROM OLD.patient_name
         OR NEW.patient_email IS DISTINCT FROM OLD.patient_email
         OR NEW.doctor_id IS DISTINCT FROM OLD.doctor_id
         OR NEW.doctor_name IS DISTINCT FROM OLD.doctor_name
         OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
         OR NEW.reason IS DISTINCT FROM OLD.reason
      THEN
        RAISE EXCEPTION 'Cancellation may not modify other appointment fields';
      END IF;
    END IF;
  END IF;
```
  (drop `rejection_reason` from the pinned list, or keep it pinned only for non-staff).

#### W4. `link_doctor_user_id` leaves a stale mapping when email changes to an unknown account
- File: `20260821100000_fix_tenancy_bugs.sql:274-288`
- On `UPDATE OF email`, if the new email matches no auth user (`v_user_id IS NULL`), the
  function falls through without clearing `NEW.user_id` — the row keeps pointing at the
  previous account. That former account retains doctor-scoped RLS visibility
  (`appointments_select_clinic` `doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())`).
- Fix: add an `ELSE` that clears the stale link:
```sql
  IF v_user_id IS NOT NULL THEN
    NEW.user_id := v_user_id;
    UPDATE public.profiles SET role = 'doctor'::user_role
     WHERE id = v_user_id AND role <> 'doctor'::user_role;
  ELSE
    NEW.user_id := NULL;
  END IF;
```

#### W5. `appointments_insert_clinic` permits cross-clinic `doctor_id` on direct insert
- File: `20260821000000_clinics.sql:334-337`
- The `WITH CHECK` only validates the NEW row's `clinic_id` against membership; it does not
  validate that `doctor_id` belongs to that same clinic. A front_desk user of clinic A can
  insert an appointment in clinic A with `doctor_id` of a doctor in clinic B (knowing the
  UUID). The RPC path validates this (`:521-529`), but the table policy does not.
- Fix: strengthen the `WITH CHECK`:
```sql
  WITH CHECK (
    user_in_clinic(clinic_id)
    AND (is_admin() OR has_role('front_desk'))
    AND (doctor_id IS NULL
         OR EXISTS (SELECT 1 FROM public.doctors d
                    WHERE d.id = doctor_id AND d.clinic_id = clinic_id))
  );
```

#### W6. `list_public_doctors` with NULL filter enumerates all clinics' doctors to anon
- File: `20260821000000_clinics.sql:580`
- `(p_clinic_id IS NULL OR d.clinic_id = p_clinic_id)` — an anon caller can omit the filter
  and get every active doctor (name + specialization) across all tenants. The app guards this
  client-side (`hooks.ts:199` returns `[]` when no clinicId), so this is defense-in-depth.
- Fix: require the filter for anon, or scope NULL to the caller's own clinic:
```sql
  WHERE d.status = 'active'::doctor_status
    AND d.clinic_id = COALESCE(p_clinic_id,
         (SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid() LIMIT 1))
```

#### W7. Privilege-model inconsistency: clinic-admin can manage members but not clinic data
- File: `20260821000000_clinics.sql:449-451` (clinic_members insert allows `user_is_clinic_admin`),
  vs `:263-295` (doctors/staff/rooms update/delete require global `is_admin()`), `:434-437`
  (clinics UPDATE requires global `is_admin()`)
- A clinic admin (role `admin` in `clinic_members`) can add/remove members of their own
  clinic but cannot update doctors, staff, rooms, or the clinic's own `plan`/`status` — those
  require global `is_admin()`. Not exploitable (no escalation path: they still cannot change
  `profiles.role`), but it makes the clinic-admin role unusable for its stated purpose and
  invites dashboard workarounds. Decide deliberately: either allow `user_is_clinic_admin(clinic_id)`
  on clinic-scoped admin operations, or drop clinic-admin from `clinic_members` entirely.
- No code fix offered — product decision.

### INFO

#### I1. Dead variable `v_patient_id`
- `20260821000000_clinics.sql:537-540` — `SELECT id INTO v_patient_id ...` result is never
  used. Remove the block (the ON CONFLICT DO NOTHING + INSERT already handles the patient row).

#### I2. `staff_select_admin` never existed; DROP is a no-op with a misleading comment
- `20260821000000_clinics.sql:167` (comment "from an earlier version") and
  `20260820100000_fix_staff_rls.sql:9`. Grep across `supabase/migrations/` shows
  `staff_select_admin` is only ever DROPPED, never CREATEd. Harmless (IF EXISTS), but the
  comment claims a history that does not exist.

#### I3. New SECURITY DEFINER helpers keep default PUBLIC EXECUTE
- `20260821000000_clinics.sql:91-134` — `user_in_clinic`, `user_is_clinic_admin`,
  `user_is_this_doctor` are SECURITY DEFINER and, like all new functions, get `EXECUTE` from
  PUBLIC by default. Risk is low (they only return booleans about the CALLER's own
  membership, `auth.uid()`-scoped), but least-privilege says:
```sql
REVOKE EXECUTE ON FUNCTION public.user_in_clinic(uuid),
  public.user_is_clinic_admin(uuid), public.user_is_this_doctor(uuid) FROM PUBLIC, anon;
```

#### I4. `DO NOTHING` silently reverts the name/phone refresh for returning patients
- `20260821000000_clinics.sql:533-535` — deliberate (comment `:532`), and correct for the
  audit ("must NOT overwrite"), but it changes behavior introduced in
  `20260819120000`/`20260820300000` (DO UPDATE). Returning patients' name/phone no longer
  update. Acceptable; note for product. Also: a patient row keeps the clinic_id of the FIRST
  clinic they booked at; later bookings in other clinics reference a patient row owned by
  another clinic (`:533-540`). Data-model inconsistency, not a security issue.

#### I5. Trigger existence check is not scoped to table
- `20260821000000_clinics.sql:596-598` — `SELECT 1 FROM pg_trigger WHERE tgname = 'set_clinics_updated_at'`
  ignores `tgrelid`; a same-named trigger on another table would suppress creation. Cosmetic.

#### I6. `user_is_this_doctor` is defined but never referenced
- `20260821000000_clinics.sql:122-134` — grep shows no policy or function uses it. Dead
  helper (or intended for a future doctors self-edit policy).

#### I7. Remote schema-drift for dashboard-pasted `clinics` tables is not verifiable
- `20260821000000_clinics.sql:21-38` — `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT
  EXISTS` handle re-runs, but if the remote already has clinics tables with a different shape
  (e.g. NOT NULL clinic_id, no `updated_at`), this migration will silently accept the drift.
  Verify remote schema manually before `db push`.

---

## Verified-clean checklist (audit points that pass)

- **search_path locked** on every new SECURITY DEFINER function:
  `21000000:95,110,126,501,574`; `21100000:87,106,142,206,261`. All `public, pg_temp`.
- **No dynamic SQL / injection**: every function uses typed parameters, no `EXECUTE`/format
  with user input.
- **book_appointment status locked**: `'pending'::appointment_status` hardcoded
  (`21000000:548`); anon cannot set arbitrary status.
- **Cross-clinic doctor rejected in RPC**: `21000000:521-529` raises unless
  `doctor_id` belongs to the resolved clinic.
- **Patient upsert is DO NOTHING** — no overwrite of name/phone (`21000000:533-535`).
- **anon table grants = NONE**: `REVOKE ALL ... FROM anon` on clinics/clinic_members
  (`21000000:658-659`); authenticated gets full table grants (`:656-657`) gated by RLS.
- **EXECUTE grants correct**: book_appointment 7-arg anon+authenticated (`:562-564`);
  list_public_doctors anon+authenticated (`:587-588`); mark_* authenticated only
  (`21100000:119-122`).
- **list_public_doctors returns only id/name/specialization** (`21000000:571`) — no email,
  phone, or other PII.
- **mark_* SECURITY DEFINER conversion is safe**: typed uuid or no params, `auth.uid()`
  filter, search_path locked (`21100000:84-113`). RLS was dropped on the UPDATE path, but
  the function only touches the caller's own rows and only sets `read/read_at`.
- **RLS scoping complete**: all 7 data tables' policies carry `user_in_clinic()`
  (verified by grep); clinics/clinic_members use member/admin scoping; profiles policies
  recreated identically to init (`21000000:205-224`).
- **Idempotency**: every `DROP POLICY IF EXISTS` name matches actual history
  (init/20000000/20100000/20200000; `staff_select_admin` never existed — harmless);
  duplicate drops between the two files are IF EXISTS no-ops; backfill is
  `ON CONFLICT DO NOTHING` + `UPDATE ... WHERE clinic_id IS NULL` on all 7 tables
  (`21000000:612-648`).
- **lower(email) fixes complete**: `sync_staff_role_to_profile` (`21100000:151,162,170,180`),
  `handle_new_user` (`:215,231`), `link_doctor_user_id` (`:276`), backfill (`:323`). All bare
  `email =` comparisons only remain in the superseded migrations (204/205/207) that
  `21100000` DROPs + recreates.
- **Cross-file consistency**: no function/policy/trigger name collisions between the two
  files; `protect_appointment_cancel` references only columns defined in init.sql
  (patient_name, patient_email, doctor_id, doctor_name, scheduled_for, reason,
  rejection_reason, status); `CASCADE` drops and trigger recreations are complete
  (`21100000:138,191-195,202,240-244,257,293-304`).
- **App callers match new signatures**: `repos.ts:582-590` calls the 7-arg
  `book_appointment` with `p_clinic_id`; `hooks.ts:199-210` calls `list_public_doctors` with
  `p_clinic_id` and guards NULL client-side.

## Recommendation

Deploy as-is is acceptable, but address W1, W2, W3 before cutting over the frontend to
clinic-scoped flows (W2 breaks patient self-service immediately; W1 is the only
cross-tenant write path). W4-W7 are hardening/consistency fixes that can ship in the next
fix migration.