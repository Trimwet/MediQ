# Bug Bounty Report — Queue & Appointments Flows

**Scope:** `src/features/queue/` · `src/features/appointments/` · `src/data/hooks.ts` (queue/appointments hooks) · `src/data/supabase/repos.ts` (queue/appointments repos) · `supabase/migrations/20260820_multi_tenancy.sql` · `supabase/migrations/20260825_notifications_audit_hardening.sql`  
**Date:** 2026-08-28  
**Auditor:** Muse Spark (automated trace)  
**Method:** Read each file, trace every button handler → repo → RLS → cache invalidation → realtime. Verified `can()` RBAC vs RLS, `clinic_id` scoping, null guards, optimistic rollback, race windows, disabled states.

---

## 1. Executive Summary

| Severity | Count |
|----------|-------|
| Critical (data leak or broken flow) | 7 |
| Important (wrong UX, missing guard, privilege mismatch) | 14 |
| Minor (polish) | 3 |
| **Total** | **24** |

Worst cluster: `callNext` is still find-then-update client-side instead of the hardened `call_next_in_queue` RPC — race + cross-clinic select — combined with realtime `filter` overwrite and optimistic cache-key mismatch. Check-in allows `pending` to queue before approval.

---

## 2. Findings by Severity

### 2.1 Critical

#### C01 — `queueRepository.callNext` missing `clinic_id` filter, cross-clinic select
- **File:** `src/data/supabase/repos.ts:256-278`
- **Hook:** `src/data/hooks.ts:322-326` `useQueueActions().callNext` never passes `clinicId`
- **What:** `SELECT id FROM queue_entries WHERE status='waiting' ORDER BY checked_in_at LIMIT 1` with optional `doctor_name` but no `clinic_id=eq.<id>`. Front-desk at clinic A can observe / attempt to claim clinic B's earliest waiting row. RLS `using (user_in_clinic(clinic_id))` blocks the subsequent `UPDATE`, so the call silently no-ops (`if(findErr||!next) return` with no toast) — broken flow. Same SELECT is also race-prone (see C02).
- **Fix:** `callNext(clinicId: string, doctorName?)` → `query.eq('clinic_id', clinicId)` or switch to `call_next_in_queue` RPC (see C02).

#### C02 — `callNext` race: two front-desks (or double-click) can claim same patient
- **File:** `src/data/supabase/repos.ts:256-278` + `src/features/queue/index.tsx:62-69`
- **What:** Repo does `SELECT ... .single()` then separate `UPDATE ... eq(id)`. No `FOR UPDATE SKIP LOCKED`. The hardened migration `supabase/migrations/20260825_notifications_audit_hardening.sql:1133-1170` already ships atomic `call_next_in_queue(p_clinic_id, p_doctor_name)` but UI/hook never calls it. Double-click window: `handleCallNext` disabled by `actions.callNext.isPending` (`src/features/queue/index.tsx:99`) only after first render; second click before pending flag can issue parallel mutations both reading same `waiting[0]`.
- **Fix:** Call `supabase.rpc('call_next_in_queue', { p_clinic_id: clinicId, p_doctor_name: doctorName })` and disable button via `isPending` plus guard `if(callNext.isPending) return` at top of handler.

#### C03 — Realtime `filter` key overwrite drops `clinic_id` scoping
- **File:** `src/data/hooks.ts:516-548` `useRealtimeTable`
- **What:**
  ```ts
  { event:'*', schema:'public', table,
    ...(clinicId ? { filter: `clinic_id=eq.${clinicId}` } : {}),
    ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
  }
  ```
  JS spread with same key `filter` — second overwrites first. `useRealtimeQueue(doctorName)` (`src/data/hooks.ts:551-558`) with both `clinicId` and `doctor_name` ends subscribed only to `doctor_name=eq...`, leaking cross-clinic events and missing clinic filter. Net: doctor at clinic B triggers invalidation at clinic A.
- **Fix:** Supabase realtime only supports single `filter`; combine as `clinic_id=eq.X` server-side via channel per clinic, or use `filter: clinic_id=eq...` and client-filter `doctor_name`. At minimum pass `clinicId` and drop `doctorName` filter (already client-filtered in `useQueue`).

#### C04 — `canCheckIn` allows `pending` to enter queue before approval
- **File:** `src/features/check-in/helpers.ts:9-12` + `src/features/check-in/index.tsx:160-175` + `supabase/migrations/20260825` booking RPC `status='pending'`
- **What:** `canCheckIn` blocks only `completed|cancelled|rejected|no_show|done`, so `pending` (unapproved booking) is check-in-able. QR ` QrTicket` (`src/features/appointments/components/qr-ticket.tsx:13`) is shown for any appointment; patient can self-check-in before staff approve, creating `queue_entries.status='waiting'` for an unconfirmed visit. The `appointments/index.tsx:50-78` and `hooks.ts:77-103` queue-insert on `arrived` also lacks `status` guard.
- **Fix:** `canCheckIn` → `['booked','arrived']` only (or at least exclude `pending`). Add DB check: queue trigger should reject inserts where appointment status != `booked|arrived`.

#### C05 — Queue insert missing `checked_in_at` and silently null `clinic_id`
- **File:** `src/features/appointments/index.tsx:68-74`, `:120-163` (three insert sites) + `src/features/check-in/index.tsx:160-175` + `src/data/hooks.ts:94-100`
- **What:** Inserts do `supabase.from('queue_entries').insert({ appointment_id, patient_name, appointment_time, doctor_name, clinic_id, status:'waiting' })` with no `checked_in_at`. If DB default not `now()` (initial schema not in migrations, `checked_in_at` may be nullable), `ORDER BY checked_in_at` becomes unpredictable (NULLS FIRST). `clinic_id` is fetched via separate `select clinic_id` (`src/features/appointments/index.tsx:62-67`); on error `queueClinicId` is `undefined` → `clinic_id: undefined` omitted → row gets `null` → RLS `user_in_clinic(null)` is false, insert appears to succeed then immediately invisible; `catch{}` swallows error — user gets false success toast.
- **Fix:** Always set `checked_in_at: new Date().toISOString()` and require `clinic_id` (throw if missing). Unify queue creation in `hooks.ts` mutationFn; remove duplicate inserts in `index.tsx` onSuccess.

#### C06 — Duplicate queue-creation paths for `arrived` (non-atomic idempotency)
- **File:** `src/data/hooks.ts:77-103` mutationFn + `src/features/appointments/index.tsx:52-76` onSuccess
- **What:** `useUpdateAppointmentStatus` already creates queue entry when `status==='arrived'`. `handleStatusChange`'s `onSuccess` does the same SELECT-then-INSERT again. Both check `existing?.length` non-atomically, so concurrent check-ins can insert duplicate `queue_entries` for same `appointment_id`.
- **Fix:** Remove app-layer queue insert from `index.tsx` handler; rely solely on `hooks.ts` mutationFn (or DB trigger). Add unique partial index `UNIQUE(appointment_id) WHERE status IN ('waiting','called','in_room')`.

#### C07 — Global realtime sync has zero `clinic_id` filtering (thundering herd + side-channel)
- **File:** `src/hooks/use-realtime-sync.ts:14-48` + `src/routes/__root.tsx:12,20`
- **What:** Single channel `mediq-realtime-sync` listens `{ event:'*', schema:'public', table }` for all 7 tables with no `filter`. Every clinic's write invalidates every clinic's `queue`/`appointments`/`rooms` caches. Chatty; also timing side-channel leaks activity existence across tenants.
- **Fix:** Scope channel per clinic: `supabase.channel('rt:'+clinicId).on('postgres_changes', { ..., filter: 'clinic_id=eq.'+clinicId })` or at least re-fetch checks RLS so no data leak, but document as perf leak. The per-hook `useRealtimeTable` *does* attempt clinic scoping (but buggy, C03).

### 2.2 Important

#### I01 — Optimistic updates write to wrong queryKey (missing `clinicId` segment)
- **File:** `src/data/hooks.ts:109-117` (`useUpdateAppointmentStatus.onMutate`), `:142-152` (`useApprove`), `:171-181` (`useReject`)
- **What:** Actual key is `['appointments', clinicId ?? 'none']` (`src/data/hooks.ts:53`), but `onMutate` does `getQueryData(['appointments'])` / `setQueryData(['appointments'], ...)`. Cache miss → no optimistic UI for correct clinic; rollback writes to `['appointments']` leaving correct key stale.
- **Fix:** Capture `clinicId` in closure and use `['appointments', clinicId ?? 'none']` for cancel/get/set. Or use `queryClient.getQueriesData({ queryKey:['appointments'] })`.

#### I02 — Queue & appointments queries fire with `clinicId=null` (no `enabled` guard)
- **File:** `src/data/hooks.ts:50-55`, `289-293`, `339-346`, `382-385`, `419-422`, `447-450`, `476-479`, `504-507` + `src/lib/clinic-context.tsx:42-50` `useCurrentClinic` returns `{ clinicId:null, isReady:false }` while loading
- **What:** No `enabled: !!clinicId` or `isReady`. On first mount `clinicId=null` → `queryKey=['queue','none',...]` → fetches `list(undefined)` (no WHERE). RLS still restricts rows but creates a persistent `'none'` cache entry and flashes `[]` or wrong-clinic data before real clinic resolves.
- **Fix:** `enabled: !!clinicId` (and `!!doctor` for `useQueue` doctor branch). Keep `'none'` sentinel out of keys or invalidate `'none'` after clinic resolves.

#### I03 — Queue action buttons lack `disabled={isPending}` / no stale disable
- **File:** `src/features/queue/components/queue-board.tsx:86-110` (`Start visit`, `Complete`, `Mark left`) + `src/features/queue/index.tsx:71-94` handlers
- **What:** `useQueueActions` exposes `startVisit.isPending`, `complete.isPending`, `markLeft.isPending` (`src/data/hooks.ts:313-331`) but `QueueBoard` props `onInRoom/onDone/onLeft` don't forward pending state, so buttons stay enabled during mutation. Double-click fires duplicate `UPDATE status=...`.
- **Fix:** Pass `pendingId`/`pendingAction` down, or disable all `canManage` buttons when `actions.*.isPending`.

#### I04 — Appointment row actions lack pending guard (double approve/reject)
- **File:** `src/features/appointments/components/appointment-row-actions.tsx:24-96` + `src/features/appointments/index.tsx:86-158`
- **What:** `DropdownMenuItem onClick={() => onApprove/onStatusChange}` with no `disabled` while `approve.isPending || updateStatus.isPending`. Rapid clicks can send parallel `approve` RPCs.
- **Fix:** Disable menu via `disabled={approve.isPending || updateStatus.isPending}` or show spinner.

#### I05 — Missing `onError` / rollback toast for every queue & appointment mutation
- **File:** `src/features/queue/index.tsx:62-94` (four handlers only `onSuccess` toast) + `src/data/hooks.ts:122-131` `onError` only restores cache, no toast; `useQueueActions` has no `onError` at all
- **What:** RLS denial, network error, or `callNext` no-op leaves spinner then silence. The `catch{}` in `src/features/appointments/index.tsx:77,107,165` also swallows queue-insert errors.
- **Fix:** Add `onError: (e)=> toast.error(e.message)` and surface `catch` errors. For `callNext`, toast "No one waiting" when `findErr`.

#### I06 — `useQueue` doctor filter is fragile string equality on `doctorName`
- **File:** `src/data/hooks.ts:293-303`
- **What:** Comment promises `appointmentId→doctor.id` match, code does `e.doctorName === doctor.name`. Two doctors with same name cross-pollinate; name change (typo fix) orphans queue entries. RLS `queue_entries` SELECT (`supabase/migrations/20260825: ~470`) also uses `doctor_name in (select d.name ...)` — same fragility.
- **Fix:** Store `doctor_id` on `queue_entries` (add FK) and filter by id. Until then match by normalized `lower(trim(name))` and also by `appointmentId` join (need extra fetch).

#### I07 — RLS `user_in_clinic(clinic_id)` vs RBAC `can('queue:manage')` mismatch: doctors can manage queue via API
- **File:** `src/config/rbac.ts:44-54` doctor lacks `queue:manage` + `supabase/migrations/20260825:525-545` `Clinic staff can update their clinic's queue` (`using (user_in_clinic(clinic_id))`)
- **What:** Frontend hides `Call next`/`Start visit` for doctors, but direct `supabase.from('queue_entries').update({status})` succeeds because `user_in_clinic` is true for any member role, including `doctor`. Privilege escalation vs intended policy.
- **Fix:** Tighten RLS: `using (user_in_clinic(clinic_id) AND NOT user_is_doctor_clinic_member?)` or require `queue:manage` role: `exists (select 1 from clinic_members where user_id=auth.uid() and clinic_id=queue_entries.clinic_id and role in ('admin','front_desk'))`.

#### I08 — Appointment status transitions not enforced in RLS / repos
- **File:** `src/data/supabase/repos.ts:199-229` `updateStatus/approve/reject` + RLS `supabase/migrations/20260825:430-445`
- **What:** Frontend defines `nextStatus` (`src/features/appointments/schema.ts:34-40`) and `canCancel/canNoShow`, but `supabase.from('appointments').update({status: <any>})` plus RLS `using (user_in_clinic ...)` + permissive trigger `protect_appointment_patient_updates` only blocks patients, not staff jumping `booked→completed`. Staff can skip `arrived` and avoid queue creation.
- **Fix:** Add `CHECK` constraint or trigger `enforce_appointment_transition` validating `OLD.status→NEW.status` allowlist; repos should call RPC that validates.

#### I09 — `handleApprove*` closes dialog before mutation settles, loses error context
- **File:** `src/features/appointments/index.tsx:122-158` + `src/features/appointments/components/approve-dialog.tsx:84-87`
- **What:** `setApproveTarget(null)` called immediately after `approve.mutate(...)` (line 158 `setApproveTarget(null)` outside `onSuccess`). If `approve` fails (RLS, network), dialog already closed, user sees no error and target lost.
- **Fix:** Move `setApproveTarget(null)` into `onSuccess` only; add `onError` toast and keep dialog open.

#### I10 — `useApproveAppointment`/`useRejectAppointment` `onSettled` invalidates too narrow / missing `queue`
- **File:** `src/data/hooks.ts:155-160`, `184-190`
- **What:** Approve → queue auto-create if `isToday` (`src/features/appointments/index.tsx:105-115`), but `useApproveAppointment.onSettled` invalidates `appointments`+`notifications` only, not `queue`. Relying on `onSuccess` in `index.tsx` to insert queue separately; if that insert fails silently, queue stale until manual refresh (global realtime may fix but I07 is global). `useReject` similar.
- **Fix:** Also `invalidateQueries({ queryKey:['queue'] })` on approve/reject settle.

#### I11 — `handleCallNext` toast uses stale `waiting[0]` not actual claimed entry
- **File:** `src/features/queue/index.tsx:62-69`
- **What:** `const next = waiting[0]; actions.callNext.mutate(undefined, { onSuccess: ()=> toast.success(`${next.patientName} called...`) })`. DB's `callNext` picks earliest `waiting` at transaction time, which may differ from UI's `waiting[0]` after realtime races or if `waiting` filtered by doctor vs global. Toast may name wrong patient.
- **Fix:** Have repo/RPC return claimed row and toast that (`returning *` already in RPC).

#### I12 — `useBookedSlots` enabled only on `date`, not `clinicId`
- **File:** `src/data/hooks.ts:254-268`
- **What:** `enabled: !!date` fires even when `clinicId` still null (`useCurrentClinic` loading). Repo then queries `getBookedHours(date, undefined, doctorId)` — no `clinic_id` filter → counts slots from other clinics, incorrectly marking hours as booked.
- **Fix:** `enabled: !!date && !!clinicId` or keep queryKey with `clinicId ?? 'none'` but repo should require clinicId.

#### I13 — Supabase repo list calls `select('*') In clinic_members` fallback leaks via `user_is_this_patient` wrong scoping
- **File:** `supabase/migrations/20260825:430-445` appointments SELECT
- **What:** Pol: `user_in_clinic AND (not doctor OR user_is_this_doctor OR user_is_this_patient)`. For a patient role (not in `clinic_members` at all), `user_in_clinic` false → they see nothing, even own appointments. But `user_is_this_patient` checks `auth.users.email = patient_email OR profile role admin`. Patient must have profile role `patient` but no clinic membership; they can't read own appointment via RLS. Hook `useAppointments` will return `[]` for patients, breaking patient self-view.
- **Fix:** Separate patient policy not gated by `user_in_clinic`: `(user_is_this_patient(patient_email))` alone should allow SELECT regardless of clinic membership.

#### I14 — `queueRepository` `list` orders by `checked_in_at` asc but UI also sorts waiting locally; mismatch if `checked_in_at` null
- **File:** `src/data/supabase/repos.ts:232-248` + `src/features/queue/index.tsx:32-40`
- **What:** DB orders `checked_in_at asc`, JS re-sorts `checkedInAt`. If `checked_in_at` null (C05), DB nulls sort first, JS `new Date(null)` → 1970, both push nulls to top incorrectly — newly arrived appear first.
- **Fix:** Ensure `checked_in_at` NOT NULL DEFAULT now(); add `WHERE checked_in_at IS NOT NULL` or coalesce.

### 2.3 Minor (Polish)

#### M01 — `formatDuration`/`minutesBetween` recompute `new Date().toISOString()` per row inside render (clock drift)
- **File:** `src/features/queue/components/queue-table.tsx:36-44` `minutesBetween(checkedInAt, new Date().toISOString())` per row on every render, `QueueBoard` same for `calledAt`. `Queue` parent already ticks `now` every 60s (`src/features/queue/index.tsx:27-31`) but children ignore it, so "Wait" column updates every render, not sync'd, and causes extra `new Date` allocations.
- **Fix:** Pass `now` ISO from parent to both `QueueBoard`/`QueueTable`.

#### M02 — `RejectDialog` label says "(required)" but `handleRejectConfirm` accepts `reason | undefined`
- **File:** `src/features/appointments/components/reject-dialog.tsx:50-64` vs `src/features/appointments/index.tsx:151-158` + `src/data/hooks.ts:169-171`
- **What:** UI enforces `disabled={!reason.trim()}` but type allows `undefined` and repo `reject(id, reason?: string)` does `rejection_reason: reason ?? null`. Minor inconsistency.
- **Fix:** Make handler `reason: string`.

#### M03 — `useRealtimeTable` dependency `queryKey.join('/')` collapses distinct keys that stringify same
- **File:** `src/data/hooks.ts:546`
- **What:** `queryKey` like `['appointments','abc/def']` vs `['appointments','abc','def']` both become `appointments/abc/def`. Effect teardown/subscribe may misfire.
- **Fix:** Use `JSON.stringify(queryKey)` or `queryKey` ref.

---

## 3. Trace Evidence — Handlers, Guards, Invalidations

### Queue — `src/features/queue/index.tsx:21-135`
| Button | Handler | Repo | Loading guard | Error guard | Invalidation | Bug |
|--------|---------|------|---------------|-------------|--------------|-----|
| Call next | `handleCallNext` → `actions.callNext.mutate` | `queueRepository.callNext` | `disabled={waiting.length===0 || isPending}` OK | none — swallowed | `invalidate(['queue'])` prefix busted | C01,C02,I03,I05,I11 |
| Start visit | `handleStartVisit` → `actions.startVisit.mutate` | `queueRepository.startVisit` | none | none | `invalidate(['queue'])` | I03,I05 |
| Complete | `handleComplete` → `actions.complete.mutate` | `complete` | none | none | same | I03,I05 |
| Mark left | `handleMarkLeft` → `markLeft.mutate` | `markLeft` | none | none | same | I03,I05 |

### Appointments — `src/features/appointments/index.tsx:45-184`
| Menu item | Handler | Repo | Optimistic | Invalidation | Bug |
|-----------|---------|------|------------|--------------|-----|
| Check in (`arrived`) | `handleStatusChange('arrived')` → `useUpdateAppointmentStatus` | `supabase.from('queue_entries').insert` (hook + component dup) | `onMutate` to `['appointments']` (wrong key) | `invalidate(['appointments']) + ['queue']` | C05,C06,I01,I05 |
| Start/Complete | same `handleStatusChange` | `updateStatus` | optimistic | same | I01,I08 |
| Approve | `handleApprove` → `useApproveAppointment` | `approve` | optimistic to wrong key | `['appointments']+['notifications']` missing queue | I01,I09,I10 |
| Approve+assign | `handleApproveWithDoctor` | `approve(id, doctor)` | same | same | I09 |
| Reject | `handleRejectConfirm` → `useRejectAppointment` | `reject` | optimistic | same | M02 |

### Data Layer — `src/data/hooks.ts`
- `useAppointments:53` key clinic-scoped, fn nullable — I02.
- `useUpdateAppointmentStatus:109-131` optimistic key mismatch — I01; duplicate queue insert — C06; no `clinic_id` in `callNext` — C01.
- `useRealtimeTable:516-548` filter overwrite — C03.
- `useRealtimeSync:516-548` dead-code `useRealtimeQueue` never used; global sync is the live path but unfiltered — C07.

### RLS — `supabase/migrations/*`
- `20260820_multi_tenancy.sql:330-340` queue SELECT doctor scoping via `doctor_name` string — I06.
- `20260825_notifications_audit_hardening.sql:430-445` appointments update: doctors blocked (OK) but staff unrestricted transitions — I08; patient read requires `user_in_clinic` — I13.
- `...:525-545` queue UPDATE permissive — I07.
- Atomic `call_next_in_queue` shipped but unused — C02.

---

## 4. Reproduction Notes

- **C02 race:** Open queue as two front-desks, set `waiting` to 1 entry, click Call next simultaneously → both SELECT same id, one UPDATE succeeds, other also succeeds (no error) but `called_at` overwritten; or with current client find-then-update both succeed sequentially, second `single()` finds next waiting (maybe same if timing overlap).
- **C03:** Log `supabase.channel` filter string in `useRealtimeTable` with `clinicId='aaa' doctorName='Dr. X'` → payload is `{ filter: 'doctor_name=eq.Dr. X' }`, clinic lost. Check network WS subscription `realtime` `postgres_changes` filter.
- **C04:** `book_appointment` anonymous, then as that patient `canCheckIn({status:'pending'})===true`, fetch QR `/check-in?id=<pendingId>` → Check In button enabled.
- **I01:** With clinicId `xyz`, `queryCache.find(['appointments','xyz'])` has data, `getQueryData(['appointments'])` is undefined → mutate → UI doesn't optimistically reflect status change until refetch.
- **I07:** Login as doctor (`role: doctor`), call `supabase.from('queue_entries').update({status:'called'}).eq('id', '<other-doctor queue id>')` → succeeds (200) despite RBAC hide.

---

## 5. Recommended Fix Order (P0 → P2)

**P0 (Critical):** C02→C01→C03→C05→C06→C04→C07 — switch `callNext` to RPC, fix realtime filter, make queue insert server-authoritative, block `pending` check-in, scope realtime per clinic.  
**P1 (Important):** I01→I02→I03→I07→I08 — fix optimistic keys + enabled guards + button disables + tighten RLS for queue manage + add transition trigger.  
**P2 (Polish):** M01→I05→I09 — pass `now` prop, add error toasts, keep approve dialog open on error.

---

## 6. What Was Checked and Found Clean

- `appointmentsRepository.create` correctly spreads `clinic_id` only when present (`src/data/supabase/repos.ts:160`) and RLS `with check (user_in_clinic)` blocks anonymous insert — OK.
- `ClinicProvider` (`src/lib/clinic-context.tsx`) correctly invalidates via `window.location.reload()` on switch — heavy but prevents stale cross-clinic cache.
- `useRealtimeTable` idempotent channel naming (`rt:table:key`) — OK once filter fixed.
- `RejectDialog` required-reason GUI guard (`disabled={!reason.trim()}`) — OK (M02 is only type leniency).
- `QueueTable` empty state and `QueueBoard` serving empty state handled — OK.

---

*Generated by bug-bounty trace. Every finding cites `file:line`. Severity per prompt: Critical=data leak or broken flow, Important=wrong UX or missing guard, Minor=polish.*
