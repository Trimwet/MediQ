# Backend Audit — Patient Dashboard (MediQ)

**Date:** 2026-08-29  
**Auditor:** Muse Spark (automated, file-verified)  
**Scope:**
- `supabase/migrations/*` — especially `20260819113813_init.sql`, `20260821000000_clinics.sql`, `20260828100000_fix_patient_appointments_rls.sql` (plus follow-up fixes `20260821100000_fix_tenancy_bugs.sql`, `20260821200000_fix_tenancy_warnings.sql`, `20260820600000_enable_realtime.sql`)
- `mediq-admin/src/data/supabase/repos.ts` (appointments, queue, patients, doctors)
- `mediq-admin/src/data/hooks.ts` (patient hooks + realtime)
- `mediq-admin/src/hooks/use-realtime-sync.ts`, `mediq-admin/src/features/patient/index.tsx`, `mediq-admin/src/features/patient/components/getting-started-checklist.tsx`
- `supabase/functions/invite-staff/index.ts`, `supabase/functions/send-appointment-reminders/index.ts`
- `mediq-admin/src/lib/clinic-context.tsx`, `mediq-admin/src/stores/auth-store.ts`, `supabase/config.toml`

**Method:** Read every file above, cross-checked RLS `USING`/`WITH CHECK` clauses against `user_in_clinic()` semantics, replayed RPC bodies, traced React Query `enabled` gates and Realtime channel filters, inspected FK/index/constraint DDL.

---

## Executive Summary

The **appointments** patient-visibility bug is **fixed at the DB layer** in `20260828100000 Fix patient appointments RLS`, but the **queue** patient path and the **frontend client** were never updated to match. The result is a split-brain: RLS now lets a patient `SELECT` their own appointments without a `clinic_members` row, while `repos.ts` + `hooks.ts` still **fail-closed on `clinicId==null`** and return `[]`, so the Patient Portal always renders *“No upcoming”* and the checklist never advances. The queue has **no patient branch at all** (and no `patient_email` column to build one), so the queue-position banner is permanently hidden even for today’s checked-in patients. `list_public_doctors` had a cross-tenant leak in `20260821000000` that is fixed in `20260821200000`; `book_appointment` is correctly hardened there but the redundant `mediq-admin/supabase/migrations/*` tree ships an older, divergent policy set that will drift on re-push. Two Edge Functions still assume single-tenant (no `clinic_id`) and one inserts with `NULL` clinic.

**Overall: 3 CRITICAL, 5 HIGH, 6 MEDIUM, 3 LOW.** Appointments RLS is now correct; patient dashboard remains broken end-to-end until queue RLS + frontend clinic scoping are aligned.

---

## Severity Legend

| Severity | Meaning |
|---|---|
| **CRITICAL** | Patient dashboard feature is non-functional or data is invisibly exposed |
| **HIGH** | Cross-tenant leak, privilege escalation, or silent write failure |
| **MEDIUM** | Data integrity / availability / realtime failure |
| **LOW / INFO** | Hardening, perf, DX |

---

## Findings Index

| # | Severity | File:Line | Title |
|---|---|---|---|
| F01 | **CRITICAL** | `supabase/migrations/20260821000000_clinics.sql:367-370` | `queue_entries_select_clinic` has no patient branch — patients never see queue |
| F02 | **CRITICAL** | `mediq-admin/src/data/supabase/repos.ts:133-136`, ` mediq-admin/src/data/hooks.ts:51-55`, ` mediq-admin/src/lib/clinic-context.tsx:140-180` | Frontend fail-closed on `clinicId` null blocks patient appointments/queue despite RLS fix |
| F03 | **CRITICAL** | `mediq-admin/src/data/supabase/repos.ts:644-652`, `supabase/migrations/20260821000000_clinics.sql:230-247` | `authRepository.signUp` → `patients` insert silently fails under RLS (no patient self-insert policy in deployed `supabase/migrations/*`) |
| F04 | **HIGH** | `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql:12-24` | Patient `SELECT` branch is clinic-unscoped — cross-tenant read across clinics sharing same e-mail |
| F05 | **HIGH** | `supabase/functions/invite-staff/index.ts:65-95` | Invite inserts `doctors`/`staff` with `NULL clinic_id` — rows become RLS-invisible orphans, no `clinic_members` row for the new user |
| F06 | **HIGH** | `supabase/migrations/20260821000000_clinics.sql:570-583` (fixed in `20260821200000_fix_tenancy_warnings.sql:570-595`) | `list_public_doctors(NULL)` historically returned active doctors from **every** clinic to anon |
| F07 | **HIGH** | `supabase/migrations/20260821000000_clinics.sql:36-77`, `mediq-admin/supabase/migrations/20260820_multi_tenancy.sql:78-110` | `clinic_id` added as nullable, never tightened to `NOT NULL` — `NULL` rows are invisible to staff yet visible to patient email bypass |
| F08 | **HIGH** | `mediq-admin/src/data/hooks.ts:535-593`, `mediq-admin/src/hooks/use-realtime-sync.ts:25-72` | Realtime patient subscriptions use dead `clinic_id` filter (`NULL`) and invalid `and(...)` composite filter |
| F09 | **MEDIUM** | `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql:27-50` | Patient `UPDATE … WITH CHECK` is correct but depends entirely on `protect_appointment_cancel` trigger; drift = field-overwrite resurrection |
| F10 | **MEDIUM** | `supabase/functions/send-appointment-reminders/index.ts:55-95` | Cron function accepts **any authenticated** caller, not `service_role` only |
| F11 | **MEDIUM** | `supabase/migrations/20260821000000_clinics.sql:500-550`, `mediq-admin/src/data/supabase/repos.ts:587-597` | `book_appointment` anonymous fallback to slug `'default'` hides multi-tenant misconfiguration; no explicit `clinic_id` from booking page slug |
| F12 | **MEDIUM** | `mediq-admin/src/features/patient/index.tsx:35-48`, `mediq-admin/src/features/patient/components/getting-started-checklist.tsx:65-110` | Checklist `hasAppointment` mixes client-side `localStorage` flags with DB — 7-day expiry + name fallback causes false-positives/false-negatives |
| F13 | **MEDIUM** | `supabase/migrations/20260819113813_init.sql:88-105`, `supabase/migrations/20260820600000_enable_realtime.sql:1-20` | Realtime publication + missing composite indexes + `queue_entries` missing `patient_email` → name-only join is collision-prone |
| F14 | **LOW** | `supabase/functions/invite-staff/index.ts:8-12`, `supabase/functions/send-appointment-reminders/index.ts:30-35` | `Access-Control-Allow-Origin: *` with `Authorization` — over-broad CORS |
| F15 | **LOW** | `mediq-admin/src/data/supabase/repos.ts:430-445`, `supabase/migrations/20260821000000_clinics.sql:260-295` | `doctors`/`staff`/`rooms` lists are strictly `user_in_clinic` — patient portal’s `useDoctors()` returns empty, specialization badge never renders |
| F16 | **INFO** | `supabase/migrations/*` vs `mediq-admin/supabase/migrations/*` | Two divergent migration trees (`20260820_multi_tenancy.sql` vs `20260821…` family) will cause push-order-dependent policy divergence |
| F17 | **LOW** | `mediq-admin/src/features/patient/index.tsx:48-66`, `mediq-admin/src/data/hooks.ts:302-315` | Queue position matched by `patientName` string equality — duplicate names give wrong `# in line` |

---

## Detailed Findings

### F01 — CRITICAL — `queue_entries` has no patient-visible policy and no patient identity column

**Files:**
- `supabase/migrations/20260821000000_clinics.sql:367-370` — `CREATE POLICY queue_entries_select_clinic … USING (user_in_clinic(clinic_id) AND (is_admin() OR has_role('front_desk') OR has_role('doctor')))`
- `supabase/migrations/20260819113813_init.sql:165-183` — `queue_entries` definition (no `patient_email` column, only `patient_name text`)
- `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql:1-54` — fixes only `appointments`, not `queue_entries`
- `mediq-admin/src/features/patient/index.tsx:60-75` — patient UI expects `queueQuery.data` to contain own entry

**What’s wrong:**
`user_in_clinic(clinic_id)` requires a `clinic_members` row with `role IN ('admin','front_desk','doctor')`. Patients are **never** inserted into `clinic_members` (`clinic_members.role CHECK` excludes `'patient'`; see `20260821000000_clinics.sql:19` and `mediq-admin/supabase/migrations/20260820_multi_tenancy.sql:42`). Therefore the entire `queue_entries_select_clinic` predicate is **always false** for patients, regardless of whether they are checked in today.

`queue_entries` also lacks `patient_email` (or `user_id` / `appointment_id` back-join key usable under RLS) to build a sound patient branch. The portal in `mediq-admin/src/features/patient/index.tsx:60-75` falls back to `patientName.toLowerCase()` string equality, which is not security-meaningful and also fails under RLS because the rows are filtered *before* the client filter runs.

The `20260828100000` migration’s header correctly diagnoses this for appointments (`“patients have no clinic_members row, so user_in_clinic is always false”`:1-4) but the fix is **not applied to `queue_entries`**.

**Impact:** Queue-position banner (`# patient-queue-banner`), live queue updates, and the “Check your queue status” checklist item are permanently stuck. Patients who are `arrived`/`called`/`in_room` never see it.

**Suggested fix (pick one):**

*Option A — add `patient_email` to `queue_entries` and a patient RLS branch (minimal, secure):*
```sql
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS patient_email text;

CREATE INDEX IF NOT EXISTS idx_queue_entries_patient_email
  ON public.queue_entries (lower(patient_email));

DROP POLICY IF EXISTS queue_entries_select_clinic ON public.queue_entries;
CREATE POLICY queue_entries_select_clinic
  ON public.queue_entries FOR SELECT
  USING (
    lower(patient_email) = lower(auth.jwt()->>'email')
    OR (
      user_in_clinic(clinic_id)
      AND (is_admin() OR has_role('front_desk') OR has_role('doctor'))
    )
  );
```
Populate `patient_email` from the source `appointments.patient_email` in the check-in path (`mediq-admin/src/data/hooks.ts:76-105` sets `patient_name`/`appointment_time`/`doctor_name`/`clinic_id` but not `patient_email`) and in the `book_appointment` → queue trigger.

*Option B — allow patient to see linked appointment’s queue entry:*
```sql
CREATE POLICY queue_entries_select_clinic
  ON public.queue_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = queue_entries.appointment_id
        AND lower(a.patient_email) = lower(auth.jwt()->>'email'))
    OR (user_in_clinic(clinic_id) AND (is_admin() OR has_role('front_desk') OR has_role('doctor')))
  );
```
Option B avoids a new column but needs a covering index on `appointments(id, lower(patient_email))` and `queue_entries(appointment_id)`.

---

### F02 — CRITICAL — Frontend fail-closed on `clinicId` defeats the RLS patient fix

**Files:**
- `mediq-admin/src/data/supabase/repos.ts:133-136`, `235-237`, `297-298` — every `list()` returns `[]` when `!clinicId`
- `mediq-admin/src/data/hooks.ts:51-55` — `useAppointments` is `enabled: !!clinicId`; `299-306` — `useQueue` same
- `mediq-admin/src/lib/clinic-context.tsx:90-130`, `150-175` — `ClinicProvider` sets `error = 'No clinic assigned'` and `clinicId = null` for any user without a `clinic_members` row (i.e., all patients)
- `mediq-admin/src/features/patient/index.tsx:18-30` — filters `(appointmentsQuery.data ?? []).filter(a => lower(email) match)` — always `[]` when query never ran
- `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql:12-24` — correctly allows `lower(patient_email)=lower(auth.jwt()->>'email')` **without** `user_in_clinic`

**What’s wrong:** The DB now allows patients to read their own appointments without clinic membership, but the JS client never issues the query. `ClinicProvider` resolves membership via `supabase.from('clinic_members').select(...).eq('user_id', authUser.id)` — patients get zero rows, so `useCurrentClinic()` returns `{ clinicId: null }`, and every repository hook short-circuits to `[]`. The patient portal’s `myAppointments` / `upcoming` arrays are therefore always empty, rendering “No upcoming appointments. Book one below.” even when the appointment exists and RLS would return it.

`useRealtimeAppointments()` (`mediq-admin/src/data/hooks.ts:591-593`) similarly passes `clinicId = null` into `useRealtimeTable`, so realtime is also filtered to a non-existent clinic (see F08). The checklist (`mediq-admin/src/features/patient/components/getting-started-checklist.tsx:55-75`) works around this with `localStorage` flags (`mediq_has_booked:*`) — a UX band-aid that still leaves the main list empty.

**Suggested fix:**
```ts
// mediq-admin/src/data/hooks.ts — patient-aware appointment hook
export function useAppointments() {
  const { clinicId } = useCurrentClinic()
  const user = useAuthStore(s => s.auth.user)
  const isPatient = hasRole(user?.role ?? [], 'patient')
  return useQuery({
    // patients query by email, not by clinic
    queryKey: isPatient ? ['appointments','patient', user?.email] : ['appointments', clinicId ?? 'none'],
    queryFn: () => isPatient
      ? supabase.from('appointments').select('*')
          .ilike('patient_email', user!.email!) // RLS still enforces lower() equality
          .order('scheduled_for', {ascending:false}).then(r=>{if(r.error) throw r.error; return (r.data??[]).map(mapAppointment)})
      : appointmentsRepository.list(clinicId ?? undefined),
    enabled: isPatient ? !!user?.email : !!clinicId,
  })
}
```
Alternatively, keep a single repo and add `listForPatient(email)` that omits the `.eq('clinic_id', ...)` filter — RLS’s email branch is sufficient. The same pattern is needed for `useQueue` (or queue must gain a patient branch per F01) and for `useRealtimeAppointments` (subscribe with `filter: patient_email=eq.<email>` for patients).

---

### F03 — CRITICAL — Sign-up `patients` insert silently blocked by RLS

**Files:**
- `mediq-admin/src/data/supabase/repos.ts:638-653` — `authRepository.signUp` does `supabase.from('patients').insert({ name, phone, email, visits:0 })` with **no `clinic_id`**
- `supabase/migrations/20260821000000_clinics.sql:234-247` — `patients_insert_clinic` requires `user_in_clinic(clinic_id) AND (is_admin() OR has_role('front_desk'))` (patients satisfy neither, and `clinic_id` is NULL anyway)
- `supabase/migrations/20260821000000_clinics.sql:36-42` — `clinic_id` is nullable, so insert succeeds at the constraint layer but fails RLS
- `mediq-admin/supabase/migrations/20260825_notifications_audit_hardening.sql:350-365` — *has* a fix: `CREATE POLICY "Users can create their own patient record" … WITH CHECK (lower(email)=lower(auth.users.email) AND clinic_id IS NULL)` — **not present** in the deployed `supabase/migrations/*` tree

**What’s wrong:** The comment in `repos.ts:639-641` says “Use a plain insert; if the patient already exists … we silently ignore” — but the observed symptom for fresh sign-ups is **not** a duplicate error; it’s an RLS rejection (`new row violates row-level security policy`). The `catch` block only suppresses `duplicate` messages (`repos.ts:651`), so the RLS error is logged to console and swallowed; the sign-up succeeds but the patient never appears in the admin Patients list. The booking RPC later “claims” the row with `UPDATE … SET clinic_id = v_clinic_id WHERE lower(email)=lower(p_email)` (`20260821200000` variant) — but only after the first booking, not after sign-up.

**Suggested fix:** Port the hardening policy into the canonical migration set:
```sql
CREATE POLICY patients_insert_own
  ON public.patients FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND clinic_id IS NULL
  );
```
And make `authRepository.signUp` pass `clinic_id: null` explicitly (already does via default) and surface non-duplicate errors to the user (retry prompt). A single canonical `supabase/migrations` tree should be the source of truth — remove or de-duplicate `mediq-admin/supabase/migrations/*`.

---

### F04 — HIGH — Patient `SELECT`/`UPDATE` is clinic-unscoped → cross-tenant read

**Files:**
- `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql:12-24`, `27-50` — `lower(patient_email)=lower(auth.jwt()->>'email')` appears as a bare `OR` without any `clinic_id` predicate

**What’s wrong:** Intentionally, patients see own appointments without clinic membership — but the predicate matches **any** clinic’s appointment that shares the same e-mail. A patient who books at Clinic A and Clinic B (or whose e-mail is reused) will see both clinics’ appointments in a single query, leaking the existence (and `doctor_name`, `scheduled_for`, `status`, `reason`) of bookings in clinics they may not intend to link. Pre-fix (`20260821000000_clinics.sql:321-332`) had the opposite bug (clinic-scoped `AND` denied all); the fix over-corrects to globally scoped.

**Suggested fix:** Scope patient reads to clinics where the caller has at least a `patients` row (or to appointments whose `clinic_id` matches the patient’s clinic) — e.g.:
```sql
USING (
  lower(patient_email) = lower(auth.jwt()->>'email')
  AND clinic_id IN (SELECT clinic_id FROM public.patients WHERE lower(email)=lower(auth.jwt()->>'email'))
  OR (user_in_clinic(clinic_id) AND ...)
)
```
Or document and accept cross-clinic visibility if product requires a single patient identity across tenants (then the queue and patient-directory policies should be updated consistently).

---

### F05 — HIGH — `invite-staff` inserts orphans with `NULL clinic_id`

**Files:**
- `supabase/functions/invite-staff/index.ts:14-95` — `corsHeaders` (`*`), service-role client, `inviteData`, `profileUpdate`, `supabaseAdmin.from('doctors').insert({ user_id, name, email, specialization })` (`:70-80`) and `staff.insert({ name, email, role, phone })` (`:81-88`) — **no `clinic_id`**
- `supabase/migrations/20260821000000_clinics.sql:36-77` — `clinic_id` on `doctors`/`staff` is nullable with no default

**What’s wrong:**
- No `clinic_id` means the new row falls through all `*_select_clinic` RLS predicates (`user_in_clinic(NULL)` is false) — the invited doctor/staff **cannot see themselves** and the admin who invited them cannot see the row either (if they filter by `clinic_id`). Backfill (`clinics.sql:300-330`) only runs once.
- No `clinic_members` insert — the invited user has an `auth.users` + `profiles` row but zero clinic membership, so `ClinicProvider` will show “No clinic assigned” and block the app (see F02).
- CORS is `*` and error status is always `400` (even for `Forbidden`).

**Suggested fix:** Extend the function’s request body to require `clinicId`, validate `user_is_clinic_admin(clinicId)` via RPC or direct `clinic_members` check, then:
```ts
await supabaseAdmin.from('doctors').insert({ ..., clinic_id: clinicId })
await supabaseAdmin.from('clinic_members').insert({ clinic_id: clinicId, user_id: newUser.id, role })
```
Set the function’s `config.toml` `verify_jwt = true` and restrict CORS to `site_url`/`additional_redirect_urls` rather than `*`.

---

### F06 — HIGH — Historical `list_public_doctors` cross-tenant leak (now fixed)

**Files:**
- `supabase/migrations/20260821000000_clinics.sql:570-583` — `WHERE d.status='active' AND (p_clinic_id IS NULL OR d.clinic_id = p_clinic_id)` → anon with `NULL` gets **all** clinics
- `supabase/migrations/20260821200000_fix_tenancy_warnings.sql:560-595` (and `mediq-admin/supabase/migrations/20260825` variant) — fixes to `d.clinic_id = COALESCE(p_clinic_id, (SELECT id FROM clinics WHERE slug='default'))`

**Status:** Fixed in place, but the fix lives in a *later* migration. If a review is done against `20260821000000_clinics.sql` alone, the leak reproduces. Keep the later migration and add a regression test: `SELECT list_public_doctors(NULL)` must not return doctors whose `clinic_id != (SELECT id FROM clinics WHERE slug='default')`.

---

### F07 — HIGH — Nullable `clinic_id` without `NOT NULL` tightening

**Files:**
- `supabase/migrations/20260821000000_clinics.sql:32-78` — `ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES clinics(id) ON DELETE RESTRICT` without `NOT NULL`
- Backfill `20260821000000_clinics.sql:300-330` populates `NULL`s but never runs `ALTER TABLE … ALTER COLUMN clinic_id SET NOT NULL`

**What’s wrong:** Post-backfill inserts can still omit `clinic_id`. For `appointments`, a `NULL` row is still patient-visible (F04’s email branch) but invisible to every staff member (`user_in_clinic(NULL)` = false). For `queue_entries`, a `NULL` row is invisible to **everyone** (no patient branch, F01). Silent data loss.

**Suggested fix:**
```sql
ALTER TABLE public.appointments  ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.patients      ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.doctors       ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.staff         ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.rooms         ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.queue_entries ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN clinic_id SET NOT NULL;
```
Gate this behind a `DO` block that asserts `NOT EXISTS (SELECT 1 FROM <table> WHERE clinic_id IS NULL)` so it fails loudly if orphans remain.

---

### F08 — HIGH — Realtime broken for patients

**Files:**
- `mediq-admin/src/data/hooks.ts:535-593` — `useRealtimeTable` builds `combinedFilter = and(clinic_id=eq.<id>, doctor_name=eq.<name>)` (`:549-555`)
- `mediq-admin/src/data/hooks.ts:580-593` — `useRealtimeQueue`, `useRealtimeAppointments` both pass `clinicId` from `useCurrentClinic()` (which is `null` for patients)
- `mediq-admin/src/hooks/use-realtime-sync.ts:25-52` — single `mediq-realtime-sync` channel listens to `*` without per-clinic scoping; relies on RLS publication filtering
- `supabase/migrations/20260820600000_enable_realtime.sql:1-20` — adds tables to `supabase_realtime` publication

**What’s wrong:**
1. Supabase Realtime’s `postgres_changes.filter` is documented as a **single-column** `col=eq.val` equality (PostgREST-style). A composite `and(clinic_id=eq.x, doctor_name=eq.y)` is not a supported filter in most Supabase versions — the subscription silently receives **zero** events. `useRealtimeTable` should instead use a single filter (usually `clinic_id`) and do the second predicate client-side, or open two channels.
2. For patients, `clinicId` is `null`, so `useRealtimeQueue(undefined, null)` builds `combinedFilter = undefined` (no filter). That *would* be correct if RLS let patients see queue entries — but per F01 they can’t, so they still get nothing. For appointments, the channel opens with `filter: clinic_id=eq.<real-id>` for staff but **`filter: undefined` for patients** — so patients either get *all* clinics’ appointment broadcasts (if RLS were clinic-unscoped) or get nothing cached (because `useAppointments` never fetched in the first place, F02).
3. `useRealtimeSync` opens a **global** channel for every table and invalidates `['queue']` / `['appointments']` on any change — this is correct for invalidation but means a patient’s browser will refetch `queue` via `queueRepository.list(null) → []` again, never seeing the entry.

**Suggested fix:**
- For patients, subscribe with `filter: patient_email=eq.<lower(email)>` (requires adding the column to the publication `REPLICA IDENTITY FULL` or using a view). Until then, the only reliable realtime for patients is polling or an in-app notification channel.
- Fix `useRealtimeTable` to not emit `and(...)`; see Supabase docs — prefer one `filter` string and client-side `doctorName` filtering (already done client-side in `queueRepository` and `useQueue`).
- Make `useAppointments`/`useQueue` patient paths use a dedicated realtime channel keyed by e-mail.

---

### F09 — MEDIUM — Patient cancel depends on a trigger, not just RLS

**Files:**
- `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql:40-49` — `WITH CHECK ( … status='cancelled')` is the only DB guard
- `supabase/migrations/20260821100000_fix_tenancy_bugs.sql:10-45` and `20260821200000_fix_tenancy_warnings.sql:70-130` — `protect_appointment_cancel()` / `protect_appointment_patient_updates()` triggers that lock non-status columns

**What’s wrong:** `WITH CHECK` cannot constrain *which* columns change — only the final row value. Without the trigger, a patient can send `UPDATE appointments SET status='cancelled', patient_name='Hacked', scheduled_for='…', doctor_id=…` and it will pass `WITH CHECK` because `status` is `cancelled`. The trigger is what rewrites or raises on extra-column changes. This coupling is undocumented in the `20260828100000` file; a future `DROP TRIGGER` or `ALTER TABLE … DISABLE TRIGGER` instantly reopens field-overwrite.

**Suggested fix:** Keep the trigger; add a comment on the policy referencing it and a test that attempts `UPDATE appointments SET status='cancelled', reason='evil' …` as a patient and asserts only `status` changes (or a `RAISE EXCEPTION`).

---

### F10 — MEDIUM — `send-appointment-reminders` allows any authenticated caller

**Files:**
- `supabase/functions/send-appointment-reminders/index.ts:60-88` — `const {data:{user}} = await supabase.auth.getUser(token); if (authError || !user) return 401` — then proceeds without `is_admin()` / `service_role` check

**What’s wrong:** Any signed-in user (including a patient) who obtains a valid JWT can `POST /functions/v1/send-appointment-reminders` and trigger reminder e-mails/log inserts for **all** due appointments (the RPC `get_due_reminders` is `SECURITY DEFINER` and clinic-unscoped beyond status/time). The cron should be the only caller (via `service_role` key or a dedicated secret header).

**Suggested fix:** Restrict at the top:
```ts
const { data: { user } } = await supabase.auth.getUser(token)
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
if (profile?.role !== 'admin') return new Response(JSON.stringify({error:'Forbidden'}), {status:403})
```
Or, better, deploy the function with `verify_jwt = false` + a `CRON_SECRET` header checked via `req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET')`, and grant `EXECUTE ON FUNCTION get_due_reminders` only to `service_role`.

---

### F11 — MEDIUM — Anonymous booking hides multi-tenant config as “default”

**Files:**
- `supabase/migrations/20260821000000_clinics.sql:490-540` and `20260821200000_fix_tenancy_warnings.sql:490-560` — `v_clinic_id := COALESCE(p_clinic_id, (SELECT id FROM clinics WHERE slug='default'))`
- `mediq-admin/src/data/supabase/repos.ts:587-597` — `bookingRepository.book` passes `p_clinic_id: input.clinicId ?? null`
- `mediq-admin/src/features/booking/index.tsx:18-45` — resolves `clinicId` from `?clinicId=` query param, otherwise `undefined` (falls back to `'default'`)
- `mediq-admin/src/hooks/use-realtime-sync.ts` (not relevant) / `supabase/config.toml:23-30` — `site_url = http://127.0.0.1:3000`, no per-clinic domain/slug routing

**What’s wrong:** In production with multiple real clinics, every anonymous `/book` hit without `?clinicId=` silently books into the “Default Clinic.” There is no slug-based booking page (`/c/:slug`) in the current router (`mediq-admin/src/routes/book.tsx:1-6` is bare `/book`). This is intentional for demo, but the fallback masks a missing-clinic misconfiguration and makes cross-clinic booking bugs hard to detect.

**Suggested fix:** Document the fallback as demo-only; add a `book_appointment` guard (already in `20260821200000` variant) that raises `Clinic is not active or does not exist` when default is missing, and make the booking UI require `clinicId` (from route param or `ClinicContext`) in multi-tenant deploys — fail loudly instead of silently booking into default.

---

### F12 — MEDIUM — Checklist `localStorage` band-aid diverges from DB

**Files:**
- `mediq-admin/src/features/patient/components/getting-started-checklist.tsx:65-115` — `hasAppointment = hasLocalBookingFlag || myAppointments.length > 0` with `localStorage.getItem('mediq_has_booked:*')`, 7-day expiry
- `mediq-admin/src/features/booking/index.tsx:90-135` — sets `mediq_has_booked`, `mediq_has_booked_email`, `mediq_has_booked_email:${clinicId}`, etc.

**What’s wrong:** `myAppointments.length > 0` is `false` for patients due to F02, so the checklist depends entirely on a client-side flag that:
- is not clinic-scoped in older keys, so a booking at Clinic A marks “Book your first appointment” done at Clinic B
- can be stale (cleared cookies, different device, incognito)
- can be set without DB success (race: `onSuccess` sets flag before RLS queuing; but if appointment is rejected/cancelled the flag stays)
- `nameMatch` (`getting-started-checklist.tsx:75-85`) matches on `patientName === userName` (derived from `user.email.split('@')[0]`) — two patients named “John” collide.

**Suggested fix:** Once F02 is fixed, remove the `localStorage` flag entirely and derive `hasAppointment`/`hasQueue` strictly from `myAppointments`/`queueQuery.data`. Keep at most a short-lived optimistic flag that is cleared on query success.

---

### F13 — MEDIUM — Data-integrity gaps

**Files:**
- `supabase/migrations/20260819113813_init.sql:88-105` — `patients.email` unique `WHERE email IS NOT NULL` (partial index) — race via `ON CONFLICT (lower(email))` relies on expression index that is not defined in that file
- `supabase/migrations/20260821000000_clinics.sql:500-530` — `book_appointment` `INSERT … ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO NOTHING` requires the exact partial index to be present; index name `patients_email_unique_idx` exists in `20260819113813_init.sql:18-20`
- `mediq-admin/src/data/supabase/repos.ts:133-145` — `mapAppointment` carries `doctorId`/`doctorName` denormalized (no FK in `repos` path)
- Missing composite indexes: `(clinic_id, lower(patient_email))`, `(clinic_id, status, scheduled_for)`, `(clinic_id, status)` on queue

**What’s wrong:** Queue position is derived from denormalized `doctor_name` string and `patient_name` string — both mutable and non-unique. `queue_entries.doctor_name` is set from `appointments.doctor_name` (free text) in `mediq-admin/src/data/hooks.ts:98-103`, not from `doctors.id`. Two doctors named “Dr. Smith” collide; a name change orphans queue entries.

**Suggested fixes:**
- Add FK-backed columns: `queue_entries.patient_email text` (F01) and `queue_entries.doctor_id uuid REFERENCES doctors(id)` alongside the name, or move queue display to join `appointments` deterministically.
- Add covering indexes noted in FINDINGS table I6 (`mediq-admin/supabase/migrations/20260825_* … idx_appointments_clinic_status` etc.) to the canonical `supabase/migrations` tree.

---

### F14 — LOW — Over-broad CORS

**Files:**
- `supabase/functions/invite-staff/index.ts:8-11` — `Access-Control-Allow-Origin: *`
- `supabase/functions/send-appointment-reminders/index.ts:30-33` — same

**Suggested fix:** Restrict to `site_url` + `additional_redirect_urls` origins, or omit `Allow-Origin` entirely for the cron function (it’s not called from the browser). At least set `Access-Control-Allow-Methods: POST, OPTIONS`.

---

### F15 — LOW — Patient `useDoctors()` returns empty → specialization badge missing

**Files:**
- `mediq-admin/src/data/hooks.ts:395-401` — `useDoctors` is `enabled: !!clinicId` (null for patients)
- `mediq-admin/src/features/patient/index.tsx:40-50` — `getSpecialization` calls `doctorsQuery.data?.find(d => d.id === appointment.doctorId)` → always `undefined` for patients

**Impact:** Not a leak, but the patient card never shows “Cardiology / General Practice” even though the appointment row carries `doctor_name`. Either let patients read doctors via `list_public_doctors` (already anon-safe) or stop calling `useDoctors` in the patient portal.

---

### F16 — INFO — Dual migration trees

**Files:**
- `supabase/migrations/20260821000000_clinics.sql`, `20260821100000_*`, `20260821200000_*`
- `mediq-admin/supabase/migrations/20260820_multi_tenancy.sql`, `20260825_notifications_audit_hardening.sql`

The `mediq-admin` tree contains its own `clinics`/`clinic_members` DDL and a full RLS rewrite with different policy names (`"Public can read active clinics"` vs `clinics_select_member`) and a distinct `patients_insert_own` policy absent from the canonical tree. If `supabase db push` is run from the repo root vs `mediq-admin/`, the applied policy set will differ. **Single source of truth:** keep `supabase/migrations` canonical, archive or submodule the other.

---

### F17 — LOW — Name-only queue matching → wrong position

**Files:**
- `mediq-admin/src/features/patient/index.tsx:60-75` — `waitingQueue.findIndex(e => e.appointmentId===id || patientName.toLowerCase()===patientName.toLowerCase())`
- `mediq-admin/src/features/patient/components/getting-started-checklist.tsx:95-105` — same name fallback

Two patients named “Aisha Bello” in the same clinic will see each other’s `# in line`.

---

## RLS / RPC / Realtime Cross-Check

### RLS: `appointments_select_clinic` and `queue_entries_select_clinic` patient branches

| Policy | Init (`20260819113813_init.sql:511-525`) | Clinics (`20260821000000:321-332`) | Fix (`20260828100000 Fix:12-24`) |
|---|---|---|---|
| `appointments SELECT` | `lower(patient_email)=lower(auth.jwt()->>'email')` **without** clinic — correct for patients | `user_in_clinic(clinic_id) AND ( … OR lower(patient_email)=…)` — **broken** (requires clinic_members for patient) | `lower(patient_email)=… OR (user_in_clinic AND staff…)` — **correct** for patients, but clinic-unscoped (F04) |
| `appointments UPDATE` | `WITH CHECK status='cancelled'` for patient | `user_in_clinic AND (… status='cancelled')` — broken | Same OR-hoisted fix — correct, trigger-dependent (F09) |
| `queue SELECT` | `queue_entries_select_roles: is_admin/front_desk/doctor` — no patient branch (by design — pre-tenancy admin tool) | `queue_entries_select_clinic: user_in_clinic AND (admin/front_desk/doctor)` — **still no patient branch** | **Not fixed** — patients remain invisible (F01) |
| `user_in_clinic(blocks?)` | N/A | Yes — blocks every patient (by design: patients never in `clinic_members`) | Removed from patient `OR` branch (appointments only) — queue still blocked |

**Verdict:** Appointments patient SELECT is correct as of `20260828100000`. Queue patient SELECT is **missing** and is the primary remaining RLS gap for the patient dashboard.

### RPCs

| RPC | File:Line | Assessment |
|---|---|---|
| `book_appointment(text,text,text,timestamptz,uuid,text,uuid)` | `20260821000000_clinics.sql:490-550` + hardening in `20260821200000_fix_tenancy_warnings.sql:490-560` | Current hardened version: validates name/email/phone, checks `clinics.status='active'`, validates `doctor_id` belongs to `clinic_id`, spam guard `pending>=8`, lowercases email, coerces invalid `doctor_id` → `null/'Unassigned'` (soft fail), atomically upserts `patients`. **No leak**, but soft-fail can mask caller bug — consider `RAISE EXCEPTION` on invalid `doctor_id`. |
| `list_public_doctors(uuid)` | `20260821000000_clinics.sql:570-583`, fixed `20260821200000:560-595` | Fixed: now `COALESCE(p_clinic_id, (SELECT id FROM clinics WHERE slug='default'))`, `ORDER BY name`, `STABLE SECURITY DEFINER`. Only exposes `id,name,specialization` for `status='active'`. **No leak** post-fix; pre-fix leaked all clinics. |

### Realtime

| Concern | Finding |
|---|---|
| Publication | `20260820600000_enable_realtime.sql:1-20` adds all core tables to `supabase_realtime` — **correct**. |
| Patient appointment updates | Would be delivered (RLS allows patient SELECT) if `useRealtimeAppointments` subscribed with an email filter; today it subscribes with `clinic_id=NULL` (F08) **and** `useAppointments` never fetched (F02), so the user sees no change anyway. |
| Patient queue updates | Never delivered (F01 — RLS denies queue rows; F08 — filter is `NULL`) |
| Global `useRealtimeSync` | Works for staff but drives redundant refetches that resolve to `[]` for patients |

### Data Integrity

| Item | Status |
|---|---|
| FKs | `clinic_id → clinics(id)` on every data table (`20260821000000:32-78`) — present but `ON DELETE RESTRICT` vs `CASCADE` diverges between trees; pick one. |
| Unique constraints | `patients_email_unique_idx WHERE email IS NOT NULL` (`init.sql:18-20`), `doctors_email UNIQUE` (`init.sql:45`), `doctors_user_id_unique_idx WHERE user_id IS NOT NULL` (`20260820000000_fixes.sql:1-15`) — correct. `clinic_members (clinic_id, user_id) PK` — correct. |
| Indexes | `idx_appointments_clinic_id`, `idx_patients_clinic_id`, etc. exist; **missing** composites added only in `mediq-admin` hardening (`idx_appointments_clinic_status`, `idx_queue_clinic_status`, `idx_appointments_patient_email lower(...)`) — port them. |
| `clinic_id NOT NULL` | **Missing** (F07) |
| Domain ENUMs | `appointment_status`, `queue_status`, `doctor_status` etc. — correct; `book_appointment` hard-locks `status='pending'` |

### Edge Functions

| Function | File:Line | CORS | Auth | Patient-data handling | Verdict |
|---|---|---|---|---|---|
| `invite-staff` | `supabase/functions/invite-staff/index.ts:1-95` | `*:*` (OPTIONS returns `ok` with `*`) | Service-role client, verifies `Authorization: Bearer <jwt>` via `auth.getUser`, requires `profiles.role='admin'` — **ok** but error mapped to `400` not `403`, no `clinic_id` (F05) | Creates `profiles.role` + `doctors`/`staff` rows with patient-like fields but no clinic scoping | **FAIL** — clinic-unaware, orphans rows |
| `send-appointment-reminders` | `supabase/functions/send-appointment-reminders/index.ts:1-140` | `*` | Any `authenticated` caller passes (F10) | Reads `get_due_reminders()` (active appointments with `patient_email`), sends via Resend, writes `reminder_logs` + `notifications`/`notification_recipients` | **FAIL** — auth too loose |

---

## Suggested Remediation Order

1. **F01 + F02** together (queue RLS + frontend clinicId bypass) — unblocks the patient portal end-to-end. Without both, neither fix alone is user-visible.
2. **F03** — port `patients_insert_own` so sign-ups reliably appear in the directory.
3. **F05** — make `invite-staff` clinic-aware and write `clinic_members`.
4. **F07** — `SET NOT NULL` on `clinic_id` (after orphan sweep) + add composite indexes.
5. **F08** — fix realtime composite filter and add patient-email subscription path.
6. **F04 / F10 / F14** — cross-tenant scoping, cron auth, CORS tightening.

---

## Appendix — Files Read

```
supabase/migrations/20260819113813_init.sql
supabase/migrations/20260819120000_fix_book_appointment_upsert.sql
supabase/migrations/20260820000000_fixes.sql
supabase/migrations/20260820100000_fix_staff_rls.sql
supabase/migrations/20260820200000_patient_appointment_rls.sql
supabase/migrations/20260820300000_book_appointment_returns_record.sql
supabase/migrations/20260820400000_sync_staff_roles.sql
supabase/migrations/20260820500000_fix_doctor_link.sql
supabase/migrations/20260820600000_enable_realtime.sql
supabase/migrations/20260820700000_fix_doctor_user_id_on_insert.sql
supabase/migrations/20260820800000_regrant_book_appointment.sql
supabase/migrations/20260820900000_patient_rls_comment.sql
supabase/migrations/20260821000000_clinics.sql
supabase/migrations/20260821100000_fix_tenancy_bugs.sql
supabase/migrations/20260821200000_fix_tenancy_warnings.sql
supabase/migrations/20260822_reminders.sql
supabase/migrations/20260823_create_clinic.sql
supabase/migrations/20260823100000_add_free_plan.sql
supabase/migrations/20260828100000_fix_patient_appointments_rls.sql
supabase/config.toml
supabase/functions/invite-staff/index.ts
supabase/functions/send-appointment-reminders/index.ts
mediq-admin/src/data/supabase/repos.ts
mediq-admin/src/data/hooks.ts
mediq-admin/src/data/repos.ts
mediq-admin/src/data/index.ts
mediq-admin/src/hooks/use-realtime-sync.ts
mediq-admin/src/hooks/use-supabase-auth-sync.ts
mediq-admin/src/features/patient/index.tsx
mediq-admin/src/features/patient/components/getting-started-checklist.tsx
mediq-admin/src/features/booking/index.tsx
mediq-admin/src/lib/clinic-context.tsx
mediq-admin/src/stores/auth-store.ts
mediq-admin/src/config/rbac.ts
mediq-admin/src/lib/supabase.ts
mediq-admin/supabase/migrations/20260820_multi_tenancy.sql
mediq-admin/supabase/migrations/20260825_notifications_audit_hardening.sql
```

---

## 10-Bullet Summary (for PR / stand-up)

1. **Appointments RLS fixed, queue RLS not:** `20260828100000_fix_patient_appointments_rls.sql:12-24` correctly hoists `lower(patient_email)=lower(auth.jwt()->>'email')` outside `user_in_clinic`, fixing “No upcoming” at the DB layer — but `queue_entries_select_clinic` (`20260821000000_clinics.sql:367-370`) still has **no patient branch**, so the queue banner never appears.
2. **Frontend undoes the DB fix:** `repos.ts:133-136` and `hooks.ts:51-55` return `[]` / `enabled:false` when `clinicId==null`; patients never have a `clinic_members` row (`clinic-context.tsx:140-175`), so `useAppointments`/`useQueue` never query — portal stays empty despite RLS allowing it.
3. **Sign-up patients row silently blocked:** `authRepository.signUp` (`repos.ts:644-652`) inserts `patients` without `clinic_id`; RLS `patients_insert_clinic` requires `user_in_clinic` → **blocked**; the canonical `supabase/migrations/*` tree lacks the `patients_insert_own` policy that exists only in `mediq-admin/supabase/migrations/20260825` — sign-up succeeds but directory stays empty until first booking claims the row.
4. **Cross-tenant read via e-mail:** The `20260828100000` patient `SELECT`/`UPDATE` `OR` is clinic-unscoped — any appointment across any clinic with the same `patient_email` is visible/cancellable. Scope to `clinic_id IN (SELECT clinic_id FROM patients WHERE lower(email)=…) ` if strict tenancy is required.
5. **Invite creates orphans:** `supabase/functions/invite-staff/index.ts:70-88` inserts `doctors`/`staff` with `clinic_id=NULL` and no `clinic_members` row — invited users get “No clinic assigned” and the rows are RLS-invisible.
6. **`list_public_doctors` leak fixed late:** `20260821000000_clinics.sql:570-583` leaked all clinics’ doctors to anon when `p_clinic_id IS NULL`; hardened in `20260821200000:560-595` to `COALESCE(default)` — keep the fix and add a regression test.
7. **`clinic_id` never hardened to `NOT NULL`:** All data tables add `clinic_id` nullable (`20260821000000:32-78`) and backfill, but never `SET NOT NULL` — `NULL` appointment rows are patient-visible but staff-invisible; queue `NULL` rows are invisible to everyone (F07).
8. **Realtime broken for patients:** `hooks.ts:549-555` builds invalid `and(clinic_id=eq…, doctor_name=eq…)` composite filter (Realtime supports single-col), and patient subscriptions pass `clinicId=NULL` so live appointment/queue invalidations never fire (F08); `useRealtimeSync` is global.
9. **`book_appointment` is solid after hardening, `send-appointment-reminders` auth is not:** Hardened `book_appointment` (name/email/phone validation, `status='pending'` lock, `clinics.status='active'` check, spam guard `pending>=8`) is correct; `send-appointment-reminders/index.ts:60-88` lets **any authenticated** user trigger cron e-mails — restrict to `service_role`/admin.
10. **Two migration trees drift:** `supabase/migrations/*` vs `mediq-admin/supabase/migrations/*` ship divergent RLS (`patients_insert_own`, notification triggers, composite indexes) — consolidate to a single canonical set before next `db push`.

