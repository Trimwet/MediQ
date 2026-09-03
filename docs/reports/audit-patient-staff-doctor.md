# Audit: Patient (`/patient`) · Front Desk (`/admin/queue`, `/admin/appointments`) · Doctor (`/admin/dashboard` → DoctorToday)

**Date:** 2026-09-03 · **Scope:** `src/features/patient/index.tsx:1` + `components/getting-started-checklist.tsx:1` + `src/routes/patient.tsx:1` + `src/data/hooks.ts:1` (useAppointments/useQueue/useCancelAppointment) + `src/lib/clinic-context.tsx:1` + `src/features/queue/index.tsx:1` + `src/features/appointments/index.tsx:1` + `components/*` + `src/data/supabase/repos.ts:1` + `src/features/dashboard/index.tsx:1` (`isDoctor && doctor`) + `src/config/rbac.ts:1` + `supabase/migrations/*` · **Method:** Full read, traced See/Fetch/Mutate/Events per role, compared `can()` vs RLS `*_clinic` policies. All citations `file:line`.

---

## 1. Role States

### 1.1 Patient — `/patient` (`PatientPortal` at `src/features/patient/index.tsx:47`, guard at `src/routes/patient.tsx:7`)

| What they see | File:Line | State |
|---------------|-----------|-------|
| Header: back→`/` (`asChild`), logo, email, ThemeSwitch, Change password (`/change-password`), Sign out | `patient/index.tsx:161-188` | Always |
| Queue position banner sticky `top-16` `role=status aria-live=polite` `#N in line with Dr · h:mm` | `patient/index.tsx:193-216` | `todayAppointment && queuePosition>=0` |
| In-progress banner `Currently with doctor` | `patient/index.tsx:219-228` | `todayAppointment.status==='in_progress'` |
| GettingStartedChecklist (4 tasks, progress bar `aria-progressbar`) | `patient/index.tsx:239` + `getting-started-checklist.tsx:179` | `!dismissed` |
| Upcoming section — `pending` (amber Request sent), `booked` (emerald Confirmed), `arrived/in_progress` cards with Cancel ghost button | `patient/index.tsx:259-376` | `upcoming.length>0` else empty card |
| Past section | `patient/index.tsx:380-438` | `past.length>0` |
| Error card Retry + 3× Skeleton | `patient/index.tsx:241-255` | `isError` / `isPending` |
| Confirm cancel AlertDialog | `patient/index.tsx:450-465` | `!!confirmId` |

**Derived state:** `myAppointments` filters by `patientEmail.toLowerCase() === userEmailLower || localBookedEmail || id.startsWith('booked-apt-','local-apt-')` (`patient/index.tsx:69-73`); `upcoming/past` split by `!rejected/cancelled/completed/no_show`; `todayAppointment = upcoming.find(isToday && booked|arrived|in_progress)` (`95-99`); `queuePosition` = `waitingQueue.findIndex(appointmentId || name)` else fallback `0` if `todayAppointment.status in arrived/waiting/in_progress` (`105-121`); `getSpecialization` via `doctorsQuery.find(doctorId)`.

**Auth:** `src/routes/patient.tsx:8-25` `beforeLoad` redirects `!user||exp`→`/sign-in?redirect=href`, `!hasRole(patient)`→`/admin/dashboard` or `/403`. `patient/index.tsx:61` null fallback for hydration. `ClinicProvider` wrapper (`patient.tsx:27-31`) but `clinic-context.tsx:98-107` + `167-173` early-return sets `clinic=null,isLoading=false` for patient — no membership fetch.

### 1.2 Front Desk — `/admin/queue` (`src/features/queue/index.tsx:22`) + `/admin/appointments` (`src/features/appointments/index.tsx:28`)

| Surface | What they see | File:Line | can() |
|---------|---------------|-----------|-------|
| Queue header | `Call next` `Megaphone` `disabled={waiting.length===0 || callNext.isPending}` | `queue/index.tsx:115-123` | `queue:manage` true (`rbac.ts:52-60`) |
| QueueBoard | Waiting count, Now serving (`called|in_room`), Served today, Avg wait; serving cards with `Start visit` (`called`), `Complete`, `Mark left` `disabled={isActionsDisabled}` | `queue/index.tsx:130-144` + `queue-board.tsx:101-127` | `canManage` |
| QueueTable | Waiting list `# Patient Doctor ApptTime Wait Status` + per-row `Mark left` `PhoneOff` | `queue/index.tsx:150-154` + `queue-table.tsx:21` | `canManage` (no disabled) |
| Appointments header | `New appointment` `CalendarPlus` | `appointments/index.tsx:214-219` | `appointments:book` true |
| AppointmentsTable | Search + Date/Doctor/Status filters, `status` badge, `actions` column only if `canManage` | `appointments/index.tsx:222-230` + `appointments-table.tsx:157-175` | `appointments:manage` true |
| Row actions dropdown | Pending→`Approve/Reject`; else `Check in|Start visit|Complete` + `Cancel` + `Mark no-show` `disabled={isActionsDisabled}` | `appointment-row-actions.tsx:46-104` | `canManage` |
| Dialogs | `AppointmentDialog` (patient/doctor/date/time/reason), `ApproveDialog` (assign doctor), `RejectDialog` (reason required) | `appointments/index.tsx:233-247` | — |

**Route guard:** `_authenticated/route.tsx:7-31` requires auth + `hasRole(patient)`→`/patient`, then `requiredPermissionFor(pathname)` (`rbac.ts:114`) — `/admin/queue` needs `queue:view`, `/admin/appointments` needs `appointments:view`. front_desk has both, so allowed.

### 1.3 Doctor — `/admin/dashboard` → `DoctorToday` (`src/features/dashboard/index.tsx:67`, branch `isDoctor && doctor` at `:297`)

| State | What they see | File:Line |
|-------|---------------|-----------|
| Resolved doctor | `doctors.find(d.email.toLowerCase()===user.email.toLowerCase())` → `doctor` (mirrors `useDoctorIdentity:37`) | `dashboard/index.tsx:93-96` |
| Doctor branch | `<DoctorToday appointments={appointments} queue={queue} doctorName={doctor.name}>` | `dashboard/index.tsx:297-302` |
| DoctorToday stats | Today's appointments / Waiting for me / In progress / Completed (filtered `isSameDay today`, `myQueue waiting`) | `doctor-today.tsx:22-48` |
| Today's schedule | Sorted `today` timeline `format h a`, reason, status badge | `doctor-today.tsx:94-148` |
| Queue status | `myQueue.filter(doctorName===doctorName)` list `room` + badge | `doctor-today.tsx:150-188` |
| Fallback (unresolved) | **Admin dashboard:** AnalyticsCards + Trend + Donut + Utilization + stats grid + LineChart + Recent Check-ins | `dashboard/index.tsx:304-461` |
| RBAC view | `can('queue:manage')===false`, `can('appointments:manage')===false` so Queue Call next hidden, appointment actions hidden, AppSidebar hides `/admin/doctors|staff|rooms` via `routePermissions` (`app-sidebar.tsx:131`) | `rbac.ts:69-75` + `queue/index.tsx:115` + `appointments-table.tsx:157` |

**Guard:** same `_authenticated` — doctor has `dashboard:view`, `queue:view`, `appointments:view`, `patients:view` so dashboard/queue/appointments/patients allowed, doctors/staff/rooms blocked via RBAC but RLS SELECT on those tables is still `user_in_clinic` (permissive read).

---

## 2. Bonds — See / Fetch / Mutate / Events per role

### 2.1 Patient bonds

| Bond | File:Line | Detail | RLS / clinic_id |
|------|-----------|--------|-----------------|
| See → Fetch appointments | `hooks.ts:51-172` `useAppointments()` | `queryKey ['appointments','patient',email]` `enabled !!email` → 1) `supabase.from('appointments').ilike('patient_email', email)` loop over `emailsToQuery` (email + `mediq_has_booked_email`) 2) `appointmentsRepository.list(clinicId)` filtered by `matchesEmail` 3) `useDataStore` 4) `mediq_last_booked_appointment` 5) fallback `booked-apt-{email}` sentinel | ✅ patient-aware fix 6159610: no `clinicId` required. `appointments_select_clinic` (`20260825`) allows `user_is_this_patient(patient_email)` regardless of clinic, so patient rows visible. `appointmentsRepository.list` fail-closed (`repos.ts:134-137`) bypassed. |
| See → Fetch queue | `hooks.ts:478-528` `useQueue()` | `queryKey ['queue','patient',email]` `enabled !!email` → clinic-less `from('queue_entries').select('*,rooms').order(limit50)` map else `[]` | ⚠️ RLS `queue_entries_select_clinic` (`20260825`) has **no patient branch** (`user_in_clinic(doctorName)` only). Patient without clinic membership fails `user_in_clinic(null)`→0 rows, comment `hooks.ts:490` acknowledges. Bond relies on fallback. |
| See → Fetch doctors | `hooks.ts:606-631` `useDoctors()` | `queryKey ['doctors','patient']` → `rpc('list_public_doctors',{})` map to `Doctor` | ✅ `list_public_doctors` SECURITY DEFINER bypasses RLS, clinic-fallback to `default` |
| See → Profile | `getting-started-checklist.tsx:47-70` | `supabase.from('profiles').select('full_name').eq('id',accountNo).single()` `hasProfile` null→false, cancelled guard cleanup | RLS `profiles` `id=auth.uid()` — own row only |
| Mutate Cancel | `hooks.ts:331-368` `useCancelAppointment()` | `isPatient`→`supabase.from('appointments').update({status:'cancelled'}).eq('id',id)` (no `clinic_id` filter); `onMutate` optimistic `status='cancelled'` on patient key, `onSettled` invalidates `['appointments']`+`['queue']` | ✅ RLS `appointments_update` patient branch `USING status in (pending,booked)` + `WITH CHECK status='cancelled'` + trigger `protect_appointment_patient_updates` locks other cols. UI adds `handleCancel` guard `myAppointments.some(id)` + confirm dialog (`patient/index.tsx:128-145`), button `disabled={isCancellingThis} aria-busy`. |
| Events | `hooks/use-realtime-sync.ts:43` + `routes/__root.tsx:20` `useRealtimeSync()` | Single channel `mediq-realtime-sync` subscribes `appointments,queue_entries,...` `event:*` and `invalidateQueries([key])` | ❌ unfiltered — no `clinic_id` filter, every clinic's change busts every client's cache (cross-tenant invalidation). RLS still filters refetch, but wastes and leaks activity cadence. `useRealtimeTable` (`hooks.ts:764`) with `and(clinic_id=eq…,doctor_name=eq…)` is unused by patient. |

### 2.2 Front Desk bonds

| Bond | File:Line | Detail | RLS |
|------|-----------|--------|-----|
| Fetch queue | `hooks.ts:520` `queueRepository.list(clinicId)` | `repos.ts:236-252` `from('queue_entries').select('*,rooms').eq('clinic_id',clinicId).order(checked_in_at)` | ✅ `queue_entries_select_clinic` `user_in_clinic(clinic_id)` (+ doctor scoping irrelevant for front_desk) |
| Fetch appointments | `hooks.ts:168` `appointmentsRepository.list(clinicId)` | `repos.ts:133-146` `.eq('clinic_id',clinicId)` fail-closed `if (!clinicId) return []` | ✅ `appointments_select_clinic` `user_in_clinic` |
| Fetch patients/doctors/rooms/analytics/notifications | `hooks.ts:562,634,690,721,750` `repos.*.list(clinicId)` | All `if (!clinicId) return []` else `.eq('clinic_id',…)` | ✅ |
| Mutate Call next | `hooks.ts:538-543` `queueRepository.callNext(name,clinicId)` | `repos.ts:254-263` `rpc('call_next_in_queue',{p_clinic_id,p_doctor_name})` FOR UPDATE SKIP LOCKED | ✅ RPC `current_user_clinic_id()` fallback + `user_in_clinic` check; `queue:manage` true matches |
| Mutate startVisit/complete/markLeft | `hooks.ts:545-556` | `repos.ts:265-291` `from('queue_entries').update({status}).eq('id',id)` (no clinic filter) | ✅ RLS `queue_entries_update` `user_in_clinic(clinic_id)` — any member in clinic can update (includes front_desk). UI disables via `isActionsDisabled`. |
| Mutate appointments status | `hooks.ts:189-252` `useUpdateAppointmentStatus` | Fetches `appointments` row, idempotent queue check, inserts `queue_entries` on `arrived`, then `appointmentsRepository.updateStatus(id,status,clinicId)` with `.eq('clinic_id',clinicId)` | ✅ `appointments_update` `user_in_clinic` + `not doctor`; front_desk passes. Duplicate queue insert also in `appointments/index.tsx:48-81` check-in path. |
| Mutate approve/reject | `hooks.ts:254-329` `approve/reject` | `repos.ts:207-228` `from('appointments').update({status:'booked'/'rejected',doctor_id/name,rejection_reason}).eq('id',id)` | ⚠️ no `clinic_id` predicate — relies on RLS `user_in_clinic` but could race across clinics. Insert of queue on approve `isToday` at `appointments/index.tsx:95-132` duplicates. |
| Events | `hooks/use-realtime-sync.ts:49-58` global invalidations | As above — unfiltered; `useRealtimeTable` (`hooks.ts:764-816`) defined but not called by Queue/Appointments pages — they rely on global sync | Same cross-tenant invalidation issue; `combinedFilter and()` not spec-guaranteed |

### 2.3 Doctor bonds

| Bond | File:Line | Detail | RLS vs RBAC |
|------|-----------|--------|-------------|
| Fetch queue (scoped) | `hooks.ts:478-528` `useQueue()` with `useDoctorIdentity:37` | `queryKey ['queue',clinicId,doctor.id|unresolved]` then `all.filter(e.doctorName===doctor.name)`; if `!doctor`→`[]` | ✅ RLS `queue_entries_select_clinic` for doctor: `user_in_clinic && (not doctor-membership OR doctor_name in (select d.name where d.user_id=uid or email=...))`. Client filter mirrors server filter — correct. When email mismatch, client returns `[]` but see Broken Bond. |
| Fetch appointments (scoped 2×) | `hooks.ts:51-168` + `dashboard/index.tsx:97-103` | `appointmentsRepository.list(clinicId)` (RLS already filters to own rows) + `ownAppointments filter doctorId===doctor.id` + `DoctorToday` filters `isSameDay today` | ✅ RLS `appointments_select_clinic` doctor branch `user_is_this_doctor(clinic_id,doctor_id)` + `user_is_this_patient`. Double filter is defense-in-depth. |
| Fetch patients (scoped) | `hooks.ts:562-593` | fetch `patients + appointments`, filter appointments by `doctorId`, then patients by `email|name` of those appointments; `!doctor`→`[]` | ⚠️ RLS `patients_select` is only `user_in_clinic` (no doctor scoping) — server returns all clinic patients, client narrows. Doctor can bypass UI via direct `supabase.from('patients').select('*').eq('clinic_id',…)` and see all patients. RBAC `patients:view` true, but row-level expectation is own-patients only (not enforced server-side). |
| Mutations allowed vs UI | `rbac.ts:69-75` doctor perms `dashboard:view appointments:view queue:view patients:view notifications:view` only — no `queue:manage`, no `appointments:manage` | Queue page `canManage=false` hides Call next (`queue/index.tsx:115`) and serving actions; Appointments table `canManage=false` hides actions column (`appointments-table.tsx:157`) | ⚠️ RLS `queue_entries_update` (`20260825: Clinic staff can update their clinic's queue`) uses only `user_in_clinic` — doctor *can* `supabase.from('queue_entries').update` via API despite UI hidden. Comment `rbac.ts:63-68` explicitly notes this gap. `appointments_update` correctly blocks doctor (`not exists doctor membership`). |
| Events | `hooks.ts:809-817` `useRealtimeQueue(doctorName)` + global sync | `useRealtimeTable('queue_entries',['queue'],{doctor_name},clinicId)` builds `and(clinic_id=eq…,doctor_name=eq…)` single filter string | ❌ Supabase Realtime `filter` supports single `col=eq.val` only; `and()` form is version-dependent and undocumented — subscription may receive all clinic queue events. Global sync is also unfiltered. |

---

## 3. Broken Bonds

| # | File:Line | Severity | Bond | Detail |
|---|-----------|----------|------|--------|
| **P-01** | `src/features/dashboard/index.tsx:297-303` | **Critical** | Doctor sees admin data | Guard `isDoctor && doctor` — when `doctor` unresolved (email not in `doctors` directory, case drift, newly created account before directory sync) the ternary falls to admin branch. Doctor then sees `AnalyticsCards`, `AppointmentsTrendChart`, `StatusDonut`, `DoctorUtilizationChart`, `stats` with `waitingCount/served/activeDoctors` for **entire clinic**, and `recentCheckIns` across all doctors. Violates `dashboard/index.tsx:88` comment that doctor view is scoped to own work. Fix: `if (isDoctor) return doctor ? <DoctorToday/> : <UnlinkedDoctorState/>` not admin fallback. |
| **P-02** | `src/config/rbac.ts:63-68` vs `supabase/migrations/20260825_notifications_audit_hardening.sql` `queue_entries_update` | **High** | `can('queue:manage')` vs RLS `queue_entries_insert_clinic/update` | RBAC denies doctor `queue:manage` (UI hides Call next/Start visit/Complete/Mark left) but RLS `Clinic staff can update their clinic's queue using (user_in_clinic)` allows any clinic member including doctor. API bypass succeeds. Same for insert (`user_in_clinic`). Tighten RLS to `role IN ('admin','front_desk')` or `user_is_clinic_admin OR front_desk` if bypass is concern (as comment suggests). |
| **P-03** | `src/data/supabase/repos.ts:232-236` + `supabase/migrations/20260825`: queue SELECT no patient branch | **High** | Patient empty due to fail-closed vs RLS | `queueRepository.list` fail-closed `if (!clinicId) return []` and RLS `queue_entries_select_clinic` requires `user_in_clinic`. Patient has `clinicId=null` (`clinic-context.tsx:102/168`) so select returns 0 rows. `useQueue` patient branch (`hooks.ts:488-518`) tries clinic-less `limit50` fetch — also blocked by RLS (no `user_in_clinic(null)`). Falls to `return []`. Patient banner relies on fragile fallback `patient/index.tsx:114-121` `rawPosition || (status in arrived/waiting/in_progress ? 0 : -1)` showing `#1` even when queue table blocked. Live queue data never appears until RLS gains `user_is_this_patient` branch. Backend migration already adds patient RLS for queue in `10ff433` but `hooks.ts` still documents missing branch — keep in sync. |
| **P-04** | `src/data/hooks.ts:764-805` + `src/hooks/use-realtime-sync.ts:43-60` | **High** | Live events without clinic filter leak/cross-tenant invalidation | `useRealtimeTable` builds `combinedFilter = clinic_id=eq.X, doctor_name=eq.Y → and(...)` — Supabase Realtime only documents single `filter: 'col=eq.val'` per channel; `and()` silently ignored in some versions → subscription receives all clinics. `useRealtimeSync` (`__root.tsx:20`) replaces per-table filtered channels with one **unfiltered** channel `mediq-realtime-sync` `on postgres_changes {table}` with no filter at all → every `queue_entries` insert in clinic B invalidates `['queue']` in clinic A's cache (extra fetch, no data leak due to RLS filtering refetch, but event cadence leaks and wastes). No `supabase.removeChannel` failure handling; no `channel.on` filter for `clinic_id` client-side before invalidate. Fix: add `clinicId` server filter if supported, else filter in callback `if (payload.new.clinic_id !== clinicId) return`. |
| **P-05** | `src/features/queue/components/queue-table.tsx:75-82` | **Medium** | Button with no disabled while pending | `Button size=sm variant=ghost onClick=>onMarkLeft(entry)` has no `disabled={isPending}` prop. Parent `Queue` (`queue/index.tsx:130-144`) passes `isActionsDisabled` to `QueueBoard` but **not** to `QueueTable`. `QueueTableProps` lacks `isActionsDisabled`. Rapid double-click fires duplicate `queueRepository.markLeft` mutations. `QueueBoard` correctly disables its Mark left (`queue-board.tsx:118-123` `disabled={isActionsDisabled}`). Fix: `type QueueTableProps { isActionsDisabled?:boolean }` + `<Button disabled={isActionsDisabled} ...>`. |
| **P-06** | `src/features/patient/index.tsx:105-121` + `getting-started-checklist.tsx:81-135` | **Medium** | Queue position / hasQueue name-only match | `rawQueuePosition findIndex(e.appointmentId===todayAppointment.id || e.patientName.toLowerCase()===(todayAppointment.patientName??'').toLowerCase())` and checklist `hasQueueFromQueue` `patientName`/`appointmentId` OR `emailPrefix` (`entryName===userEmail.split('@')[0]`) — two patients named "John Doe" collide, shows wrong `#N` or false `hasQueue=true`. Should match `appointmentId` (stable) or `patient_email` once queue gains it. Prior bounty PA-04/C-06 same. |
| **P-07** | `src/features/patient/components/getting-started-checklist.tsx:117-135` `hasQueuePrimary` | **Medium** | False-positive checklist | `hasQueuePrimary = myAppointments.some(status in ['arrived','in_progress','waiting','booked','pending'])` — includes `booked` and `pending` (not yet checked in) so patient who only booked (never arrived) gets "Check your queue status" marked done and progress bar inflated. Same as pre-6159610 C-06 (`booked` fallback). Should be `arrived|in_progress|waiting` plus queue table `waiting`. |
| **P-08** | `src/lib/clinic-context.tsx:160-211` | **Medium** | ClinicContext front_desk flash-zero while loading | `useCurrentClinic` returns `clinicId=null,isReady=false` while `ClinicProvider` fetches `clinic_members`. `useAppointments/useQueue` `enabled: !!clinicId` → idle (not pending) → Dashboard `isPending` false, Queue `isPending` false, so they render **zero stats / empty waiting list** instead of Skeleton until fetch completes. `AuthenticatedLayoutInner` (`authenticated-layout.tsx:55`) only hides on `error`, not `isLoading`. Fix: gate admin pages on `useClinicContext().isLoading` or make hooks `isLoading` include clinic readiness. Also `useEffect` deps include `allClinics` → refetch loop mitigated only by `lastFetchedEmail` ref; missing `AbortController` cleanup on unmount. |
| **P-09** | `src/features/appointments/index.tsx:48-81` + `src/data/hooks.ts:197-224` | **Medium** | Duplicate queue insert on Check-in / Approve | Both `useUpdateAppointmentStatus` (`hooks.ts:197-224` `status==='arrived'` fetch+insert) and `Appointments` component `handleStatusChange` (`appointments/index.tsx:54-81` `status==='arrived'` fetch+insert) do the same `queue_entries` insert with `appointment_id` existence check. On `booked→arrived` transition both paths can run (hook `updateStatus` + component `onSuccess` manual insert) — idempotent `maybeSingle` check prevents duplicate but doubles Supabase round-trips and divergence risk. Approve path (`appointments/index.tsx:95-132`/`135-172`) similarly duplicates doctor-assigned insert. Consolidate to hook only. |
| **P-10** | `src/features/patient/index.tsx:60-68` localBookedEmail + `src/data/hooks.ts:63-73` | **Low** | Patient cross-browser `localStorage` poison | `localBookedEmail = localStorage.getItem('mediq_has_booked_email')` matches `a.patientEmail.toLowerCase()===localBookedEmail` and `id.startsWith('booked-apt-','local-apt-')`. On shared device, previous user's `booked-apt-{email}` remains in `localStorage` + `useDataStore` memory — next patient sees previous appointment until `myAppointments` filter excludes? Filter includes `localBookedEmail` so synthetic id can leak if emails share prefix domain; also `useAppointments` adds `local-apt-*` unconditionally (`hooks.ts:129-135`). Should scope local keys by `user.email` or clear on sign out (`auth-store reset` does not clear `localStorage`). |
| **P-11** | `src/data/hooks.ts:541-542` + `src/data/supabase/repos.ts:254` | **Low** | front_desk Call next missing clinic_id guard | `useQueueActions.callNext` `mutationFn: () => queueRepository.callNext(isDoctor?doctor?.name:undefined, clinicId??undefined)` passes `clinicId` which is `null` while loading. `callNextInQueue` RPC defers to `current_user_clinic_id()` when `null` (`20260825: if v_clinic_id is null then ...`), so still works — but `useAppointments.updateStatus` throws `Missing clinic context` if `!clinicId` (`hooks.ts:227`). Call next is safe, but generic queue `startVisit/complete/markLeft` (`repos.ts:265-291` `from('queue_entries').update eq id` no clinic predicate) rely on RLS but have no client-side clinic check. Not blocking, but lint: front_desk disabled should also check `!clinicId`. |
| **P-12** | `src/features/patient/components/getting-started-checklist.tsx:160-173` | **Low** | useEffect without cleanup (localStorage dismissed) + persist semantics | `useEffect(() => { if(allDone) localStorage.setItem('mediq_checklist_dismissed','true') }, [allDone])` has no cross-clinic key, persists forever even if patient switches clinic. Also initial `useState(() => localStorage.getItem===‘true’)` read has no `try/catch` unlike `patient/index.tsx:66`. Dismiss blocked forever if `localStorage` quota exceeded (silent). |
| **P-13** | `src/features/patient/index.tsx:241` `isError` retry | **Low** | Patient retry without queue retry | `Button onClick()=>appointmentsQuery.refetch()` only refetches appointments on error; `queueQuery` error (likely blocked by RLS) has no Retry UI — stays empty with no feedback. Should `Promise.all([appointmentsQuery.refetch(),queueQuery.refetch()])`. |

*All `isPending` / `disabled` otherwise correct: Patient cancel `disabled={isCancellingThis}` (`patient/index.tsx:364`), Queue Call next `disabled={waiting.length===0||callNext.isPending}` (`queue/index.tsx:118`), QueueBoard `disabled={isActionsDisabled}` (`queue-board.tsx:104/111/119`), Appointments row `disabled={isActionsDisabled}` (`appointment-row-actions.tsx:51`), Dialog submits `disabled={!doctor}` / `!reason.trim()` (`approve-dialog.tsx:84`, `reject-dialog.tsx:60`).*

---

## 4. Design Violations

| # | File:Line | Violation | Fix |
|---|-----------|-----------|-----|
| **D-01** | `src/hooks/use-realtime-sync.ts:47-52` | Global realtime channel created with no `clinic_id` filter violates `src/lib/clinic-context.tsx:5` contract "every repo and hook reads current clinic from `useCurrentClinic()` — never from props/URL". Event layer bypasses clinic isolation. | Subscribe per-clinic: `supabase.channel(`rt:${clinicId}`).on('postgres_changes',{filter:`clinic_id=eq.${clinicId}`},...)` or filter in callback before `invalidateQueries`. |
| **D-02** | `src/config/rbac.ts:63-68` comment documents gap but leaves it | Doctor `queue:manage` deliberately hidden in UI while RLS permits — shipped as tech-debt comment not guard. Design doc (`src/types/domain.ts` ownership scoping) says backend MUST mirror RBAC, but hardening migration left queue UPDATE permissive. | Change `queue_entries_update` to `user_is_clinic_admin(clinic_id) OR has front_desk membership` or add `role IN ('admin','front_desk')` check. |
| **D-03** | `src/features/patient/index.tsx:114-121` fallback + `getting-started-checklist.tsx:81` | Checklist progress + banner treat `pending/booked` as queued to mask missing queue RLS patient branch. Data-flow bond is workaround, not contract — hides backend gap. | Add RLS `queue_entries_select` patient branch `appointment_id IN (select id from appointments where lower(patient_email)=lower(auth.email()))` (as in `10ff433` intent) and display real `queue_entries` only. |
| **D-04** | `src/features/dashboard/components/doctor-today.tsx:28-38` | Uses `new Date()` inline for `today` filter with no `isToday` helper (patient uses `date-fns isToday`). Inconsistent date semantics across roles. | Use `date-fns isSameDay` or `startOfDay/endOfDay` memo as Dashboard does (`dashboard/index.tsx:105-137`). |
| **D-05** | `src/data/hooks.ts:170` + `supabase/repos.ts:134` | `enabled: isPatient ? !!user.email : !!clinicId` conflates `useAppointments` for all roles; frontend import path diverges (`isPatient` branch vs repo). Breaks "single source of truth" (`src/data/index.ts:1` repos). | Keep hook patient-aware but delegate to `appointmentsRepository.listPatient(email)` instead of inline Supabase select with manual mapping (duplicates `mapAppointment` in `repos.ts:40`). |
| **D-06** | `src/features/queue/components/queue-table.tsx:21` | Props `QueueTableProps` missing `isActionsDisabled` while sibling `QueueBoard` has it — inconsistent disabled contract across same page's waiting list actions. | Add prop and wire `queue/index.tsx:150` `isActionsDisabled={actions.markLeft.isPending}`. |

---

## 5. Summary — 10 bullets

1. **Patient is clinic-aware since 6159610:** `clinic-context.tsx:101/167` returns `clinic=null` for patient; `hooks.ts:51/331/478/606` branches on `isPatient` to `queryKey ['*','patient',email]` + `ilike(patient_email)` or `rpc list_public_doctors`, so `clinicId=null` no longer bricks `/patient` — cancel bypasses `clinic_id` filter per RLS patient-cancel `WITH CHECK status='cancelled'`. Queue still fails closed (no patient RLS branch) and relies on banner fallback `patient/index.tsx:114`.

2. **Front desk bonds intact:** `can('queue:manage')` + `appointments:manage` (`rbac.ts:52`) matches RLS `queue_entries insert/update user_in_clinic` and `appointments update not-doctor`; Call next uses atomic `call_next_in_queue FOR UPDATE SKIP LOCKED` (`repos.ts:254`, `20260825` RPC) with correct `disabled` (`queue/index.tsx:118`) and `isActionsDisabled` (`queue-board.tsx:104`).

3. **Doctor read-scoped correctly at DB layer but UI leaks on miss:** queue SELECT is doctor-name scoped, appointments SELECT is `user_is_this_doctor` (`20260825`), client `useQueue`/`ownAppointments` mirrors it; however `dashboard/index.tsx:297` `isDoctor && doctor` falls through to **admin analytics** when `doctor` unresolved — doctor briefly sees whole-clinic KPIs and recent check-ins.

4. **RBAC vs RLS gap remains for queue writes:** `rbac.ts:69` denies doctor `queue:manage` (UI hides buttons) but `20260825` `queue_entries_update` `using (user_in_clinic)` still allows doctor API bypass (acknowledged `rbac.ts:63` comment). Patients update correctly locked (`20260825: WITH CHECK status='cancelled'` + trigger `protect_appointment_patient_updates`).

5. **One broken disable:** `QueueTable` Mark left (`queue-table.tsx:75`) has no `disabled` prop while `QueueBoard` does — double-click duplicate `markLeft`. Patient cancel and `AppointmentRowActions` disabled handling is otherwise correct (`patient/index.tsx:364`, `appointment-row-actions.tsx:51`, `queue-board.tsx:118`).

6. **Realtime is global, not clinic-scoped:** `useRealtimeSync` (`hooks/use-realtime-sync.ts:47`, mounted at `__root.tsx:20`) subscribes with no `filter` and invalidates `['queue']`/`['appointments']` for every clinic's change; `useRealtimeTable` `and(clinic_id=eq…,doctor_name=eq…)` is undocumented single-filter syntax and unused by pages. RLS still scopes refetch, but event volume leaks.

7. **Queue position is name-fragile:** `patient/index.tsx:105` + `checklist.tsx:121` match on `patientName.toLowerCase()` (or `email.split('@')[0]`) — duplicate names collide, not `appointmentId`/`patient_email`. `hasQueue` marks `booked|pending` as queued (`checklist.tsx:117`) inflating progress.

8. **No `isReady` skeleton for front-desk:** `useCurrentClinic.isLoading` not awaited; hooks `enabled: !!clinicId` idle produces zero-state flash (0 waiting, 0 appointments) instead of `Skeleton` (`queue/index.tsx:126`, `dashboard/index.tsx:295`) while `ClinicProvider` fetches `clinic_members`.

9. **Duplicate queue inserts:** `hooks.ts:197` `status==='arrived'` + `appointments/index.tsx:54` `handleStatusChange` both fetch appointment + check `queue_entries` existence + insert — idempotent but double round-trip; approve path duplicates `isToday` check.

10. **Design debt:** global realtime violates clinic isolation contract, queue RLS workaround (`pending→done` checklist, banner `#1` fallback) papers over missing patient queue RLS, and `QueueTable` disabled inconsistency breaks the shared button-state contract.

---

*Evidence: all `file:line` above are 1-indexed against `mediq-admin/src/...` at HEAD `1c5cf05`. Verify live with `supabase/migrations/20260825_notifications_audit_hardening.sql` §§4-6 for canonical RLS; rollback-check `mediq-admin/supabase/migrations/20260820_multi_tenancy.sql` fork divergence.*
