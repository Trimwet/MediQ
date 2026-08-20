# Security Audit — Fix Migrations (2026-08-20)

Auditor: Cobalt (cyber specialist) · Scope: read-only review of 9 fix migrations in `supabase/migrations`
Baseline compared: `20260819113813_init.sql`, `20260819120000_fix_book_appointment_upsert.sql`
Frontend cross-check: `mediq-admin/src/config/rbac.ts`, `src/data/repos.ts`, `src/data/supabase/repos.ts`, `src/data/hooks.ts`, `src/features/booking/index.tsx`, `src/features/patient/index.tsx`, `src/lib/clinic-context.tsx`

**Context note:** the multi-tenant `clinics` migration is NOT in this repo (remote drift — flagged separately). The frontend already references `clinic_id` columns (`mediq-admin/src/data/supabase/repos.ts` L150/289/345/394/464) and a `clinics`/`clinic_members` schema (`src/lib/clinic-context.tsx` L104-106). None of the 9 fix migrations reference `clinic_id` anywhere (grep: 0 hits in `supabase/`). Every conclusion below that depends on the remote tenancy schema is labeled as such.

---

## Per-file findings

### 1. `20260820000000_fixes.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| NIT | 16-18 | Partial unique index `doctors_user_id_unique_idx` is valid syntax, but **data-dependent**: if the remote DB already has duplicate `doctors.user_id`, `CREATE UNIQUE INDEX` fails and the whole migration (including the notification policy below) rolls back. | Pre-clean duplicates first or use `CREATE UNIQUE INDEX ... WHERE user_id IS NOT NULL` after a dedup pass. |
| WARNING | 23-26 | `notification_recipients_update_own` — policy `USING/WITH CHECK (user_id = auth.uid())` pins only `user_id`. A user can UPDATE **any column** of their own rows: `notification_id` (reassign the read flag to a different notification → audit-trail corruption), `read`, `read_at`. This is the real reason init deliberately shipped **no** UPDATE policy (init L606-607: read flag is written via SECURITY INVOKER RPCs). | RLS cannot reference `OLD`, so the narrow fix is not a WITH CHECK. Two clean options: (a) **drop the policy** and convert `mark_notification_read`/`mark_all_notifications_read` to `SECURITY DEFINER` (they already filter `user_id = auth.uid()` — L360-363/372-375) so the RPC is the only write path; or (b) keep the policy and add a `BEFORE UPDATE` trigger that `RAISE EXCEPTION` when `NEW.notification_id IS DISTINCT FROM OLD.notification_id` (and optionally forbid `read_at` clearing). |

### 2. `20260820100000_fix_staff_rls.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| WARNING | 9 | `DROP POLICY IF EXISTS staff_select_admin` — **no such policy exists in the repo baseline.** Init has `staff_select_staff` (init L467-469), already `is_admin() OR has_role('front_desk') OR has_role('doctor')`. The premise "baseline init was admin-only" is **refuted**: the repo baseline already exposed staff (names, phones, emails) to front_desk and doctor since day one. | Refute the stated problem; the DROP only matters on the drifted remote DB. |
| WARNING | 11-13 | `CREATE POLICY staff_select_staff` — same name as init L467 → **clean replay of init + this migration fails** ("policy already exists"). Not idempotent. | `DROP POLICY IF EXISTS staff_select_staff ON staff;` before the CREATE, or drop the migration entirely (behavior is identical to baseline). |
| WARNING | 1-13 | **Frontend RBAC contradiction CONFIRMED** (not introduced here, but perpetuated): `rbac.ts` L51-69 — front_desk/doctor have NO `staff:view`; L95 — `/admin/staff` requires `staff:view`. So the UI blocks the route, yet the DB allows front_desk/doctor to read all staff PII (name/phone/email, `staff` table L144-152) via direct API query. The migration's header "Fixes the 406 error" misdiagnoses the symptom: the 406 is a client-side/`single()` artifact, not a DB RLS block. | Decide the product intent: if staff directory is admin-only (frontend says so), keep DB policy admin-only and fix the frontend page that triggers the 406; if front_desk/doctor need names for UX (e.g. doctor select), add `staff:view` to their `rolePermissions` and expose it deliberately. As-is: unnecessary PII exposure surface. |

**Verdict:** premise refuted; migration is behaviorally a no-op vs repo baseline, breaks clean replay, and leaves an unresolved RBAC contradiction. WARNING.

### 3. `20260820200000_patient_appointment_rls.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| WARNING | 6-19 | SELECT patient branch uses **raw** `patient_email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())` — **case regression vs init L518** (`lower(patient_email) = lower(auth.jwt()->>'email')`). Supabase Auth stores `auth.users.email` lowercased; `book_appointment` lowercases `patient_email` (20300000 L25) — consistent **only** for RPC-created rows. Admin/front_desk-created appointments insert email as typed (`supabase/repos.ts` L144) → a patient cannot see their own appointment if the email has uppercase. NULL `patient_email` → comparison is NULL → row invisible to patient (only staff see it) — acceptable but worth documenting. | `lower(patient_email) = (SELECT lower(u.email) FROM auth.users u WHERE u.id = auth.uid())` (and keep the `auth.uid() IS NOT NULL` guard). |
| WARNING | 24-46 | **Confirmed: RLS constrains per-row, not per-column.** Patient UPDATE branch: USING matches their email; WITH CHECK only requires `status = 'cancelled'` (L44) — so a patient can cancel **and simultaneously rewrite** `patient_name`, `scheduled_for`, `doctor_id`, `doctor_name`, `reason`, `rejection_reason` in the same UPDATE (final status must be cancelled, so no status escalation; `patient_email` is re-pinned by the WITH CHECK patient branch). Impact: record corruption / audit integrity of cancelled appointments; a patient could reassign doctor/time before cancelling. | Replace with a dedicated **cancel RPC** (SECURITY DEFINER) that only sets `status='cancelled'` (+ `updated_at`), drop the patient branch of the UPDATE policy; or add a `BEFORE UPDATE` trigger that raises unless non-status columns equal `OLD` values (RLS cannot reference OLD). |

**Verdict:** functional fix (patient cancel works) but over-broad write path. WARNING — fix before shipping.

### 4. `20260820300000_book_appointment_returns_record.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| BLOCKER | 7-14, 41-48 | **No `clinic_id` parameter, no clinic_id write.** Frontend calls the RPC with `p_clinic_id` (`supabase/repos.ts` L550); the recreated function signature `(text,text,text,timestamptz,uuid,text)` has no such param. Consequences (either is shipping-breaking under tenancy): PostgREST errors on the unknown arg **or** ignores it → appointments (and patients) are created with `clinic_id = NULL` → invisible to every clinic's scoped RLS; if the remote tenancy migration made `clinic_id NOT NULL`, the INSERT fails outright. The patient upsert (L27-33) is equally clinic-less. | Add `p_clinic_id uuid DEFAULT NULL` to the signature, validate it (see below), and write it into both `patients` and `appointments` inserts. Then re-GRANT for the new signature. |
| WARNING | 31-33 | `DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone` — `book_appointment` is callable by **anon** (20800000). An unauthenticated caller can re-book with an existing patient's email and **overwrite that patient's stored name/phone** (PII corruption / defacement). Also data-quality churn on legitimate rebookings with typos. | Only update on first booking (keep the init `WHERE NOT EXISTS` pattern) or require the caller to prove ownership; at minimum, don't let anon overwrite `phone`. |
| WARNING | 35-39 | `p_doctor_id` is not validated for existence or **clinic scope**. FK (init L168) rejects a non-existent uuid (appointment insert errors — fine), but a valid doctor id from **another clinic** is accepted (doctor ids are enumerable — they're listed on the public `/doctors` page). Under tenancy, that crosses clinic boundaries with patient PII attached to the row. | In the function: `SELECT name, clinic_id INTO ... FROM doctors WHERE id = p_doctor_id` and reject (or NULL) when `clinic_id` doesn't match `p_clinic_id`. |
| OK | 5 | `DROP FUNCTION IF EXISTS public.book_appointment(text,text,text,timestamptz,uuid,text)` removes the old uuid-returning version (return type is not part of the DROP signature) — grants lost, restored by 20800000. ✓ |
| OK | 16-17 | SECURITY DEFINER + `SET search_path = public, pg_temp` locked ✓; status locked to `'pending'` (L46) ✓; `lower(p_email)` (L25) ✓; `ON CONFLICT (lower(email)) WHERE email IS NOT NULL` is valid against the partial expression index `patients_email_unique_idx` (init L121-123) ✓. |

**Verdict:** BLOCKER — multi-tenant booking is broken or creates orphaned rows; plus anon-writable patient PII and missing cross-clinic doctor validation.

### 5. `20260820400000_sync_staff_roles.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| WARNING | 17, 21, 46, 60 | **Confirmed case-sensitivity risk.** `auth.users.email` is stored lowercase by Supabase Auth; `staff.email`/`doctors.email` are stored as typed (init L137/149, case-sensitive UNIQUE). `WHERE email = NEW.email` fails silently when staff email has uppercase → profile role never syncs → doctor sees no appointments / patient never promoted. Same in `handle_new_user` (L46, L60). | Compare with `lower()` on the typed side: `WHERE lower(email) = lower(NEW.email)` (auth.users side can stay as-is since it's already lowercase; better to lower both for symmetry). |
| NIT | 15-16 | `UPDATE profiles SET role = NEW.role::text::user_role` — cast chain `staff_role → text → user_role` is fine; recursion check: profiles UPDATE only fires `set_profiles_updated_at` (init L237-240) → no loop ✓; staff → profile → no staff update ✓; no infinite recursion. |
| NIT | 45-48 | `LIMIT 1` over a case-insensitive match is nondeterministic if case-duplicate staff rows exist (allowed by the case-sensitive UNIQUE). |

**Verdict:** logic is recursion-safe; the email-case bug defeats the entire feature. WARNING.

### 6. `20260820500000_fix_doctor_link.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| WARNING | 11, 24, 43-45 | Same case-sensitive email matching: `WHERE email = NEW.email` (L11), `WHERE email = OLD.email` (L24), and the backfill `WHERE email = public.doctors.email` (L44) vs lowercase `auth.users.email`. Works for the hard-coded lowercase `jonahmafuyai81@gmail.com` (L42) but silently misses mixed-case doctors. | `lower(email)` on both sides. |
| OK | 18-19, 32-34 | Doctor link/unlink on staff insert/update/delete ✓; `RETURN COALESCE(NEW, OLD)` ✓. |
| NIT | 1-40 | Duplicates/overrides the function from 20400000 (CREATE OR REPLACE) — fine, but the two migrations must be applied in order; do not reorder. |

**Verdict:** WARNING (case bug); otherwise sound.

### 7. `20260820600000_enable_realtime.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| NIT | 18-25 | Realtime `postgres_changes` applies RLS per subscriber JWT, so patients only receive rows their SELECT policy allows (own recipient rows / own appointments). No new access vs existing policies. **However**, it amplifies pre-existing exposure: `notifications`, `staff`, `patients`, `doctors` SELECT policies already let any front_desk/doctor read ALL rows (init L425-427, 446-448, 467-469, 567-577) → staff PII and patient PII are now **pushed** to every doctor subscriber in real time. With tenancy, this depends on the remote (not-in-repo) policies scoping by `clinic_id` — verify on remote. | Verify remote tenancy RLS scopes all 7 tables by `clinic_id`; consider excluding `staff` from the publication until the RBAC contradiction (finding 2) is resolved. |
| OK | 9-16 | DROP-then-ADD makes the migration idempotent ✓; anon subscribers get nothing (no grants) ✓. |

**Verdict:** technically safe per policy, but widens the PII blast radius. NIT (verify remote policies).

### 8. `20260820700000_fix_doctor_user_id_on_insert.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| WARNING | 27-29 | **Confirmed logic bug**: the early `IF NEW.user_id IS NOT NULL THEN RETURN NEW;` means the "or on email change" case (L26 comment) is dead — when `user_id` is already set, an email UPDATE never re-links. If the corrected email belongs to a different auth user, `doctors.user_id` keeps pointing at the old user → the old user retains doctor RLS visibility of that doctor's appointments; the new user gets none. | Only early-return when `user_id` is set **and** email is unchanged: `IF NEW.user_id IS NOT NULL AND NEW.email IS NOT DISTINCT FROM OLD.email THEN RETURN NEW; END IF;` (note: on INSERT, OLD is unassigned — guard with `TG_OP`). |
| OK | 53-56, 60-64 | `BEFORE INSERT` and `BEFORE UPDATE OF email ... WHEN (NEW.email IS DISTINCT FROM OLD.email)` — valid PostgreSQL trigger syntax ✓; profile role set to 'doctor' under SECURITY DEFINER (bypasses profiles RLS, acceptable for a system trigger) ✓. |
| WARNING | 67-70 | Backfill `WHERE u.email = d.email` — case-sensitive again (same silent-miss risk). | `lower()` both sides. |

**Verdict:** WARNING — trigger never re-links on email change; case bug in backfill.

### 9. `20260820800000_regrant_book_appointment.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| OK | 13-15 | `GRANT EXECUTE ON FUNCTION public.book_appointment(text, text, text, timestamptz, uuid, text) TO anon, authenticated` — matches the new signature exactly ✓ and is the only regrant needed (other functions were recreated via CREATE OR REPLACE, which preserves ACLs, or are trigger-only). | None. |
| NIT | — | `sync_staff_role_to_profile()` (20400000) and `link_doctor_user_id()` (20700000) are new functions created **after** init's REVOKE — PostgreSQL defaults them to PUBLIC EXECUTE. Harmless today (trigger-returning functions cannot be invoked directly), but hygiene-wise: `REVOKE EXECUTE ... FROM PUBLIC` on them. | Add the REVOKE in a future cleanup. |

**Verdict:** correct and sufficient. ✓

### 10. `20260820900000_patient_rls_comment.sql`
| Sev | Line | Finding | Fix |
|---|---|---|---|
| OK | 24-31 | Comment-only, no DDL. Content is accurate: SECURITY DEFINER bypasses RLS for the internal inserts ✓, status locked ✓, email lowercased ✓, doctor name resolved from DB ✓, INVOKER would silently fail for anon ✓. | None. |

**Verdict:** clean.

---

## Combined must-fix list (before shipping)

1. **BLOCKER — `20260820300000` L7-48**: `book_appointment` accepts no `p_clinic_id` and writes no `clinic_id`. Booking either errors (PostgREST unknown arg / NOT NULL remote column) or creates orphaned, clinic-invisible appointments and patients. Add `p_clinic_id`, validate it against the doctor's clinic, write it to both `patients` and `appointments`; re-GRANT for the new signature.
2. **WARNING — `20260820200000` L24-46**: patient UPDATE lets the patient rewrite `patient_name/scheduled_for/doctor_id/doctor_name/reason/rejection_reason` alongside the cancellation. Move patient cancellation to a cancel-only RPC (or BEFORE UPDATE trigger pinning columns to OLD).
3. **WARNING — `20260820000000` L23-26**: `notification_recipients` UPDATE policy allows `notification_id` reassignment (read-flag audit corruption). Drop the policy and make the two mark-* RPCs SECURITY DEFINER (or add a trigger pinning `notification_id`).
4. **WARNING — `20260820400000` L17/21/46/60, `20260820500000` L11/24/44, `20260820700000` L68-69**: case-sensitive email matching vs lowercase `auth.users.email` — role sync and doctor linking fail silently for mixed-case emails. Use `lower()` on the typed side everywhere.
5. **WARNING — `20260820700000` L27-29**: early return defeats email-change re-linking; stale `user_id` keeps the wrong user's doctor visibility.
6. **WARNING — `20260820100000` L11-13**: `CREATE POLICY staff_select_staff` duplicates the init policy (breaks clean replay) and perpetuates a DB-vs-frontend RBAC contradiction: front_desk/doctor can read all staff PII (`staff` L144-152: name/phone/email) while `rbac.ts` L51-69/L95 denies them the page. Resolve intent (admin-only vs grant `staff:view` to the roles).
7. **WARNING — `20260820300000` L31-33**: anon callers can overwrite an existing patient's `name`/`phone` via the upsert DO UPDATE. Restrict to first-booking insert semantics.
8. **WARNING — `20260820200000` L15-17**: SELECT patient branch is case-sensitive (regression vs init's `lower()`); patients can't see admin-created appointments with mixed-case email. NULL-email rows are invisible to patients by design — document it.
9. **NIT — `20260820600000`**: verify remote tenancy RLS scopes all publication tables by `clinic_id`; realtime now pushes staff/patient PII to every doctor subscriber.

## Confidence notes
- High: items 1-3 (code is unambiguous; frontend call site confirmed at `supabase/repos.ts` L550).
- High: item 4-5 (Supabase Auth lowercases emails; the matching code is case-sensitive).
- Medium: item 6's "406 root cause" (remote drift unknown; the repo baseline definitively has the open policy — verified).
- Medium: item 1's exact failure mode on remote (PostgREST unknown-arg behavior and remote `clinic_id` nullability not verifiable from repo; the missing write is certain regardless).