# Security Audit — supabase/migrations/20260819113813_init.sql

- Auditor: Cobalt (cyber specialist)
- Date: 2026-08-19
- Scope: read-only. File NOT modified.
- Verdict: **NEEDS CHANGES — 2 BLOCKERS, 6 WARNINGS, 6 NITs**

---

## BLOCKERS

### B1. Any signed-up user can self-promote to `admin` (profiles UPDATE policy)
- **Location:** lines 321-324 (`profiles_update_own_or_admin`)
- **Detail:** The UPDATE policy is `USING (id = auth.uid() OR is_admin()) WITH CHECK (id = auth.uid() OR is_admin())`. For a patient updating their *own* row, both clauses pass because `id` is unchanged — the WITH CHECK never verifies that `role` is unchanged. `UPDATE public.profiles SET role='admin' WHERE id = auth.uid()` succeeds through PostgREST/supabase-js.
- **Impact:** Any self-registered patient becomes admin; `is_admin()` then returns true everywhere, granting full read/write over staff, doctors, patients, appointments, notifications. Renders the manual admin-bootstrap comment (lines 13-16) moot and is the single highest-risk issue in the file.
- **Fix options:**
  1. Column-level privilege: `REVOKE UPDATE (role) ON public.profiles FROM authenticated;` and route role changes through a SECURITY DEFINER admin-only function.
  2. BEFORE UPDATE trigger on profiles that rejects `role` changes unless performed by a SECURITY DEFINER admin function (set a session flag).
  3. Split policy whose WITH CHECK calls a SECURITY DEFINER helper that compares new vs. old role (avoids RLS recursion; do NOT inline a subquery on profiles in the policy — it recurses).

### B2. The core product rule — anonymous booking — cannot work against this migration
- **Location:** grants lines 546-555; appointments insert policy lines 432-438; contrast docs/architecture.md lines 27-77 and src/data/repos.ts lines 72-79 ("In production this maps to a Supabase edge function").
- **Detail:** Booking is designed to work **without an account** (booking page: "No account needed", features/booking/index.tsx line 180). This migration (a) REVOKEs all table grants from `anon` (line 547) and (b) the INSERT policy requires `patient_email = auth.jwt()->>'email'` (line 437), which is NULL for anon → `NULL` → WITH CHECK fails. No edge function or SECURITY DEFINER booking function exists (`supabase/functions/` is empty).
- **Impact:** As written, the public /book flow cannot insert an appointment through the anon key, and no function is provided to do it. Functional blocker for the documented product.
- **Fix options:**
  1. Add a SECURITY DEFINER `book_appointment()` function (or edge function with service_role) that validates input (status forced `'pending'`, email normalized) and inserts patient + appointment atomically. Keep anon table grants revoked — this is the correct pattern.
  2. Or change the product rule: booking requires sign-in (patient role) and use the existing INSERT policy.
- **Note:** Locking anon down is *correct* per the stated security posture — the gap is the missing booking mechanism, not loosening anon.

---

## WARNINGS

### W1. `notifications` UPDATE policy lets recipients mutate shared content
- **Location:** lines 495-508
- **Detail:** "Recipient only" is enforced on the row, but RLS is row-level, not column-level — a recipient can UPDATE `title`/`message`/`type`/`channel` of the shared `notifications` row, affecting **all** recipients and staff views. Intent was only the read flag (which lives on `notification_recipients.read`, line 209 — there is no `read` column on `notifications`, so the frontend schema's `read` field on the notification object has no matching column; see features/notifications/schema.ts line 21). Content spoofing/mutation risk.
- **Fix:** Restrict what recipients may change (e.g., separate `notification_reads` table; or keep updates on `notification_recipients` only and make `notifications` admin-write-only), or add a trigger guarding columns.

### W2. Patient self-booking can forge status / doctor_name / backdate
- **Location:** lines 432-438 (comment says "pending rows", policy does not enforce it)
- **Detail:** `appointments_insert_roles` WITH CHECK only requires `patient_email = auth.jwt()->>'email'`. A patient can insert with `status='completed'` (or `booked`/`cancelled`), arbitrary `doctor_name`, and past `scheduled_for` — corrupting clinic records. `patient_name` also arbitrary.
- **Fix:** Force `status='pending'` in the SECURITY DEFINER booking function (B2) or add a trigger/CHECK on insert path; do not rely on the client.

### W3. Case-sensitivity mismatch in patient scoping (jwt vs stored email)
- **Location:** lines 428, 437 (raw `=` comparisons); line 176 already uses `lower(patient_email)` for the index; patient portal filters with `.toLowerCase()` (features/patient/index.tsx line 36)
- **Detail:** Supabase Auth normalizes account emails to lowercase, but booking stores the raw typed email (features/booking/index.tsx sends `values.email`). If a visitor types `Aisha@X.com` and their JWT email is `aisha@x.com`, the policy `patient_email = auth.jwt()->>'email'` fails → the patient sees zero appointments, even though the frontend would have matched case-insensitively. jq spoofing itself is not possible (Supabase signs JWTs) — this is a functional/integrity risk, plus a fragile identity model (see N5).
- **Fix:** `lower(patient_email) = lower(auth.jwt()->>'email')` in the SELECT and INSERT policies (and normalize at insert).

### W4. Default privileges: future public-schema objects get anon/authenticated grants again
- **Location:** lines 546-555
- **Detail:** `REVOKE ... ON ALL TABLES` only covers tables existing at migration time. Supabase's default privileges grant ALL on new tables/functions/sequences in `public` to `anon` and `authenticated`. Any later migration creating a table without enabling RLS would silently expose it to anon.
- **Fix:** Add to this migration:
  ```sql
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
  ```

### W5. SECURITY DEFINER functions remain PUBLIC-executable
- **Location:** lines 221-229, 238-249, 256-264, 267-283; grants block only revokes TABLE privileges (line 547)
- **Detail:** Postgres grants EXECUTE to PUBLIC on functions by default. `anon` can call `has_role()` / `is_admin()` (returns false — no leak today) and `handle_new_user()` (errors outside trigger context). Defense-in-depth: any future body change to these SECURITY DEFINER functions becomes anon-reachable.
- **Fix:** `REVOKE ALL ON FUNCTION public.has_role(text), public.is_admin(), public.handle_new_user(), public.set_updated_at() FROM PUBLIC;` then `GRANT EXECUTE ... TO authenticated;` (set_updated_at needs EXECUTE for the trigger only; it is not user-invoked).

### W6. `notification_recipients` UPDATE lets a user reassign `notification_id`
- **Location:** lines 530-533
- **Detail:** WITH CHECK only guards `user_id = auth.uid()`; a user can change `notification_id` on their own junction row, corrupting the delivery/audit record and (theoretically) attaching themselves to arbitrary notifications. Low access creep today (all notifications are recipient-readable by design) but the audit trail is wrong.
- **Fix:** Guard `notification_id` (e.g., trigger comparing OLD/ NEW, or move read-state to a table where the user can only toggle `read`).

---

## NITs

- **N1 (line 163):** `appointments.doctor_id ... ON DELETE SET NULL` — deleting a doctor silently unlinks historical appointments. `doctor_name` snapshot preserves display, but the audit link is lost. For a clinic, RESTRICT + soft-delete (reuse/extend `doctor_status`) is safer for the audit trail.
- **N2 (line 551):** `GRANT USAGE ON SCHEMA public TO anon` — standard Supabase default and harmless (no table privileges + RLS deny), but if "anon gets NOTHING" is literal, remove it.
- **N3 (lines 240, 258):** STABLE is a planner/volatility hint, not the recursion guard. Recursion safety comes from SECURITY DEFINER running as table owner (postgres bypasses RLS on owned tables). If function ownership changes or `FORCE ROW LEVEL SECURITY` is enabled on profiles, recursion returns. Keep an eye on ownership in future migrations.
- **N4 (line 457):** queue_entries SELECT grants doctors the whole clinic queue (all patients' names), per the spec matrix — but it conflicts with "doctors must only see their own work" if that rule is meant to be strict. Confirm intent.
- **N5 (lines 162, 176):** patient identity is email-by-value (no FK from appointments to patients/profiles). Email changes or typo'd case permanently orphans appointments from the patient view. Consider `patient_user_id uuid REFERENCES profiles(id)` (nullable) as a stable scoping key in a follow-up migration.
- **N6 (line 432-438):** INSERT with NULL `patient_email` is blocked for patients by the WITH CHECK (NULL comparison) — good; front-desk/admin may insert NULL email rows, which patients then cannot see (by design, but note it).

---

## Category-by-category verdicts (per audit list)

1. **Anonymous access — OK** (with W4/W5 caveats). RLS enabled on all 9 tables (lines 296-304). anon: no table grants, all policies evaluate false for anon (auth.uid() NULL). `GRANT USAGE` on schema is benign.
2. **SECURITY DEFINER functions — OK.** `has_role` (238-249) and `is_admin` (256-264): SECURITY DEFINER + STABLE + `SET search_path = public, pg_temp`. `handle_new_user` (267-283): SECURITY DEFINER + search_path lock, body is a single INSERT into profiles only. (W5 applies.)
3. **Recursion check — OK.** SECURITY DEFINER owner-bypass is the intended and working pattern; functions read profiles directly (line 246). STABLE is not the guard (see N3).
4. **Policy matrix — mostly OK, except B1.** patients ✓, doctors ✓ (admin-only writes; no doctor self-edit), staff ✓, rooms ✓, queue_entries ✓; appointments scoping ✓ (doctor own-rows via `doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid())`, patient via email; no patient UPDATE/DELETE, no cross-doctor visibility) with W2/W3; notifications with W1/W6; profiles with B1. Every UPDATE policy's WITH CHECK matches its USING; every INSERT policy has WITH CHECK.
5. **jwt() vs uid() — OK** (no spoofing; signed tokens) with W3 case-sensitivity and N5 identity-model notes.
6. **Enum/CHECK integrity — OK.** Verified verbatim vs frontend: user_role 4 (rbac.ts), appointment_status 8 (appointments/schema.ts), queue_status 5 (queue/schema.ts), room_type 3 + room_status 3 (rooms/schema.ts), doctor_status 2, specializations 6 (doctors/schema.ts), staff_role 3 + staff_status 2 (staff/schema.ts), notification_type 4 + notification_channel 4 (notifications/schema.ts).
7. **Data safety — OK** with N1. CASCADE on profiles←auth.users (line 97) and notification_recipients↔notifications (lines 207-208) correct.
8. **Default privileges — FAIL** (W4): migration must set ALTER DEFAULT PRIVILEGES, plus W5 for function EXECUTE.

---

## Recommended order of fixes
1. B1 (privilege escalation) — before any real users exist.
2. B2 (booking path) — decide edge function vs. sign-in-first; implement with status/email validation (also fixes W2, W3).
3. W4 + W5 — one-line hardening in this migration.
4. W1/W6 — notification mutation surface.
5. N1-N6 — as convenient; N1 recommended for the clinic audit trail.