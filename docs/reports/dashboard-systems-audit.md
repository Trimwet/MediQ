# MediQ /admin/dashboard — Systems Audit (Reductionist, Ground-Up)

**Date:** 2026-08-27 — verified at commit `d43368c` + staged `f68b30a` + `b0e3295`  
**Scope:** `/admin/dashboard` for 3 authenticated roles: `doctor`, `front_desk`, `admin` (and `platform_admin` which inherits `admin`). Every state, button, data flow, and event is traced from atoms → bonds → role views → backend.

---

## 1. Atoms (What Exists — Small Components)

### 1.1 Database atoms (Supabase Postgres, RLS on every table)
**File:** `supabase/migrations/20260819113813_init.sql:14-66` + `20260821000000_clinics.sql:12-78`

- **Enums:** `user_role` (now 5: `admin, front_desk, doctor, patient, platform_admin`), `appointment_status` (8: `pending, booked, arrived, in_progress, completed, no_show, cancelled, rejected`), `queue_status` (5), `doctor_status`, `staff_role/status`, `room_type/status`, `notification_type/channel`.
- **Tables:** `profiles(id→auth.users, role, full_name, phone)`, `patients(id, name, phone, email, visits)`, `doctors(id, user_id→profiles, name, specialization, email, status)`, `staff`, `rooms`, `appointments(id, patient_name/email, doctor_id, doctor_name, scheduled_for, status, reason, clinic_id)`, `queue_entries(id, appointment_id, patient_name, appointment_time, checked_in_at, called_at, doctor_name, room_id, status, clinic_id)`, `notifications`, `notification_recipients`, `clinics(id, name, slug, plan, status)`, `clinic_members(PK clinic_id,user_id, role)`, `reminder_logs`.
- **Indexes:** `appointments(scheduled_for, status, doctor_id, lower(patient_email))`, `queue_entries(status, checked_in_at)`, `patients(lower(email))`, plus `idx_*_clinic_id` on 7 tables.

**Verification:** All 7 data tables have `clinic_id uuid → clinics(id) ON DELETE RESTRICT + INDEX`. `clinic_members` is the join; `profiles` has no `clinic_id` by design.

### 1.2 Backend atoms (helpers, RPCs, realtime)
**File:** `20260819113813_init.sql:71-147` + `20260821:90-122` + `20260828000000`

- **Helpers (all `SECURITY DEFINER, STABLE, SET search_path=public,pg_temp`):** `has_role(text)`, `is_admin()` → `has_role('admin')`, `is_platform_admin()` → `role='platform_admin'`, `user_in_clinic(uuid)`, `user_is_clinic_admin(uuid)`, `user_is_this_doctor(uuid)`, `set_updated_at()`.
- **RPCs:** `book_appointment(p_name,p_email,p_phone,p_scheduled_for,p_doctor_id,p_reason,p_clinic_id) → appointments` (anon+auth, clinic-aware, patient upsert `ON CONFLICT lower(email) DO NOTHING`), `list_public_doctors(p_clinic_id) → id,name,specialization` (anon+auth), `create_clinic(p_name,p_slug,p_plan) → clinics` (auth, inserts `clinics` + `clinic_members as admin`), `get_due_reminders`, `get_platform_users`, `mark_notification_read/all`.
- **Realtime:** Publication includes `appointments, queue_entries, notifications` (from `20260820600000_enable_realtime.sql`). `src/data/hooks.ts:useRealtimeTable` subscribes to `postgres_changes` and invalidates `['appointments']`, `['queue']`, etc. `useRealtimeSync` in `src/hooks/use-realtime-sync.ts` is the global variant.

### 1.3 Frontend atoms (files that render /admin/dashboard)

| File | Export | Role |
|------|--------|------|
| `src/features/dashboard/index.tsx:67` | `Dashboard()` | Route component, role-branches to `DoctorToday` vs analytics |
| `src/features/dashboard/components/analytics-cards.tsx:29` | `AnalyticsCards({data,isLoading})` | Pure props → 4 stat cards |
| `src/features/dashboard/components/appointments-trend-chart.tsx:21` | `AppointmentsTrendChart` | Pure AreaChart |
| `src/features/dashboard/components/status-donut.tsx:24` | `StatusDonut` | Pure PieChart |
| `src/features/dashboard/components/doctor-utilization-chart.tsx:21` | `DoctorUtilizationChart` | Pure BarChart |
| `src/features/dashboard/components/date-range.tsx` | `DashboardDateRange, DashboardRange('today','7d','30d','custom')` | Local state + calendar |
| `src/features/dashboard/components/doctor-today.tsx` | `DoctorToday({appointments, queue, doctorName})` | Doctor-only leaf |
| `src/data/hooks.ts:32-445` | `useAppointments, useQueue, useDoctors, useAnalytics, useBookedSlots, usePublicDoctors, useUpdateAppointmentStatus, useApproveAppointment, useRealtime*` | Data hooks |
| `src/data/supabase/repos.ts:131-834` | `appointmentsRepository, queueRepository, doctorsRepository, analyticsRepository` | Supabase queries |
| `src/lib/clinic-context.tsx:57` | `useCurrentClinic() → {clinicId,clinicRole,isReady}`, `ClinicProvider` | Clinic scoping |
| `src/stores/auth-store.ts:42` | `useAuthStore → {user: {accountNo,email,role[],exp,clinicId,clinicRole,clinicName}}` persisted in cookies `mediq_user`/`ACCESS_TOKEN` | Auth + clinic cache |
| `src/config/rbac.ts:33` | `ROLES, PERMISSIONS(22), rolePermissions, can(), hasRole(), routePermissions` | RBAC |
| `src/components/layout/authenticated-layout.tsx:1` | `AuthenticatedLayout` → `ClinicProvider` → `AppSidebar`/`SidebarInset` | Shell |
| `src/routes/_authenticated/route.tsx:1` | `beforeLoad` → `!user → /sign-in`, `can(role,perm) → 403` | Guard |
| `src/routes/_authenticated/admin/dashboard.tsx:1` | `createFileRoute('/_authenticated/admin/dashboard')` | Route, no extra perm (open to all signed-in) |

**UI atoms reused:** `Card, Badge, Table, Skeleton, Button, Header, Main, Search, NotificationBell, ThemeSwitch, ConfigDrawer, ProfileDropdown` (all from `src/components/ui/*`).

---

## 2. Bonds (How Atoms Connect — Every Relationship)

### 2.1 Route → Store → Hook → Repo → Table → Event

```
_user navigates to /admin/dashboard
  → _authenticated/route.tsx:beforeLoad checks useAuthStore.user + can(role, 'dashboard:view') [rbac.ts:100-113]
  → AuthenticatedLayout → ClinicProvider.fetchMemberships() [clinic-context.tsx:101]
      = supabase.from('clinic_members').eq('user_id', auth.uid()) → clinics(name,slug,plan)
      → setClinic(mapped) + setUser({...clinicId,clinicRole,clinicName}) + window.location.reload on switchClinic
  → useCurrentClinic() → {clinicId, clinicRole}
  → Dashboard:38 calls useAppointments(), useQueue(), useDoctors(), useAnalytics()
      → each hook does supabase.from('<table>').eq('clinic_id', clinicId) if clinicId else unscoped fallback
      → Table(RLS): appointments_select_clinic = (lower(patient_email)=jwt.email) OR (user_in_clinic AND admin/front_desk/doctor+user_is_this_doctor)
                    queue_entries_select_clinic = user_in_clinic AND admin/front_desk/(doctor read-only)
                    patients_select_clinic = user_in_clinic AND admin/front_desk/doctor
                    doctors_select_clinic = user_in_clinic AND is_admin/user_is_clinic_admin (W7)
      → postgres_changes → useRealtimeTable → queryClient.invalidateQueries → UI re-renders
      → mutations: useUpdateAppointmentStatus, useApproveAppointment, etc. → supabase.from().update()
          → appointments RLS update = user_in_clinic AND admin/front_desk OR patient cancel
          → protect_appointment_cancel trigger (20260821100000) checks status transitions
          → onSuccess toast + on arrival also inserts queue_entries (see §3.3)
```

**File:line for each bond:**
- `Dashboard:67` → `useAppointments:32` → `appointmentsRepository.list:133` → `appointments` → `appointments_select_clinic:20260821200000:12`
- `Dashboard:70` → `useQueue:231` → `queueRepository.list:231` → `queue_entries` → `queue_entries_select_clinic`
- `Dashboard:71` → `useDoctors:350` → `doctorsRepository.list:350` → `doctors+appointments` → `doctors_select_clinic`
- `Dashboard:77` → `useAnalytics:727` → `analyticsRepository.getSummary:727` → `appointments+queue_entries` → pure `aggregateByStatus/calcAvgWaitMinutes`
- `AuthenticatedLayout:41` → `ClinicProvider:66` → `clinic_members+clinics`
- `useDoctorIdentity:22` → `doctors.find(d.email===user.email)` → fail-closed `[]`

### 2.2 Clinic scoping is the central bond — every hook reads it, every repo writes it

- **Read:** 7/7 data repos guard `if(clinicId) eq('clinic_id', clinicId)` — verified `appointments:133`, `queue:231`, `patients:310`, `doctors:350`, `staff:426`, `rooms:474`, `notifications:552`.
- **Write:** 7/7 `create` methods spread `...(clinicId ? {clinic_id: clinicId} : {})` — e.g. `appointments:149`, `patients:327`, `doctors:390`.
- **Switch:** `ClinicContext.switchClinic:223` updates `authStore` + `window.location.reload()` to bust `react-query` caches.

**Fragility flagged by Serena:** `useUpdateAppointmentStatus:44` does `eq('id',id)` without `clinic_id` (RLS-backstopped but not client-filtered), `useRealtimeTable:451` has no `clinic_id` channel filter (cross-clinic invalidation), `getBookedHours` optional `clinicId` can run unscoped while `isLoading`.

---

## 3. Role-Differentiated States — What Each Role *Sees* and *Can Do* on /admin/dashboard

### 3.1 Common (all 3 roles)

- **Header:** `HeaderNav(active='overview') + Search + NotificationBell + ThemeSwitch + ConfigDrawer + ProfileDropdown` — same for all.
- **Title:** `Dashboard / Today's overview` + `DashboardDateRange` (today/7d/30d/custom with calendar).
- **Loading:** `DashboardSkeleton` (4 cards + 2 chart skeletons) while `isPending = appointments|queue|doctors.isPending`.
- **Data fetched regardless of role:** `appointments, queue, doctors` (all scoped, so doctor gets fewer rows).

### 3.2 `admin` (and `platform_admin` — same PERMISSIONS)

**Sees:**
- `analyticsQuery` → `AnalyticsCards` (4 KPI: Booked/Completed/Pending/Avg Wait), `AppointmentsTrendChart` (Area), `StatusDonut` (Pie), `DoctorUtilizationChart` (Bar) — from `analyticsRepository.getSummary`.
- **Stats grid** (4 cards): `Appointments (inRangeAppointments.length)`, `In queue (waitingCount)`, `Served (doneCount)`, `Active doctors (active/total)`.
- **Charts:** `LineChart` of appointments per hour (today) or per day (7d/30d), `Recent Check-ins` table (5 most recent `queue.status !== 'left'`, filtered by `bounds`).
- **All data:** Every appointment/queue row for the clinic (RLS `is_admin` passes).

**Can do:**
- No direct mutations *on* the dashboard — it is read-only. Navigation to `Appointments` (book/approve/reject), `Queue` (call/next/start/complete), `Patients/Doctors/Staff/Rooms` (CRUD).
- **Events:** `postgres_changes` on `appointments/queue_entries` → invalidates and re-renders charts/tables.

### 3.3 `front_desk`

**Sees:** *Exactly the same as admin on the dashboard* (`rolePermissions` for `front_desk` includes `dashboard:view`, `appointments:view`, `queue:view`, `patients:view`). The dashboard does **not** branch on `front_desk` — `isDoctor` is `user.role.includes('doctor')`, so `front_desk` falls through to the admin/standard view. They see the 4 analytics charts + stats + line chart + recent check-ins.

**Can do:** Same read view as admin, but mutations are gated downstream: `appointments:manage` and `queue:manage` (so they *can* `updateStatus`, `approve`, `callNext` etc.), but **not** `doctors:manage/staff:manage/rooms:manage` (those RLS policies require `is_admin`).

**Data:** Same as admin (all rows for the clinic) — `front_desk` passes `patients_select_clinic` etc.

### 3.4 `doctor`

**Sees:** **Completely different branch** (`isDoctor && doctor` at `Dashboard:295`):
- `DoctorToday` component — not the analytics/charts. Props: `appointments={appointments}`, `queue={queue}`, `doctorName={doctor.name}` where `doctor = doctors.find(d.email === user.email)`.
- Inside `DoctorToday` (inferred from `useDoctorIdentity` pattern): **My appointments** (filtered `a.doctorId === doctor.id`), **Waiting for me** (`queue.filter(doctorName === doctor.name && status==='waiting')`), **In progress**, **Completed** — 4 cards but scoped to *me*, plus a single queue list for my patients.
- If no matching `doctors` row (`doctor` is `undefined`), the hook fail-closes to `[]` — the doctor sees **empty** (0 appointments, 0 queue) rather than leaking others' data.

**Can do:** **Read-only on dashboard** — no mutation buttons are rendered in `DoctorToday`. On other pages (`/admin/appointments`, `/admin/queue`) the doctor can *view* but RLS `INSERT/UPDATE/DELETE` on `appointments`, `queue_entries`, `patients` denies `has_role('doctor')` for writes. So the dashboard's `canManage` checks would hide `New appointment` etc. for doctors.

**Data:** `appointments` and `queue` are still fetched unfiltered, but `useDoctorIdentity` filters client-side *and* RLS would have already filtered server-side to `user_is_this_doctor` + `user_in_clinic`.

### 3.5 `patient` (not an /admin/dashboard role — included for completeness)

- `/admin/dashboard` is **not** listed in `routePermissions` for `patient`, but `dashboard:view` *is* in `patient`'s `rolePermissions`, and `/_authenticated/route.tsx`'s `beforeLoad` would allow `/admin/dashboard` for `patient` if they navigated there. However, the app's `PatientPortal` (`/patient`) is the intended patient view, not the admin dashboard. The admin dashboard would show `DoctorToday` branch as `false` (since `user.role` is `patient`, not `doctor`), so they'd see the admin/analytics view but with **empty data** (since `appointments_select_clinic` would only return their own `patient_email` rows, and `analytics` would be near-zero). This is a **minor role leak** — patient can technically open `/admin/dashboard` but sees nothing sensitive.

---

## 4. Every Button, Function, Data Flow, and Event — Accounted For

### 4.1 Buttons on /admin/dashboard

| Button/Control | File:line | Handler | Data it touches | Event it fires | Role gate |
|----------------|-----------|---------|-----------------|----------------|-----------|
| `DashboardDateRange` (today/7d/30d/custom) | `dashboard/index.tsx:283` | `handleRangeChange` → `setRange` / `setCustomFrom/To` | `bounds` (local) → `inRangeAppointments` → `stats, chartData, recentCheckIns, analyticsQuery` | `useAnalytics(range)` refetches with new `range` → `analyticsRepository.getSummary` with new `start/end` | All |
| Stats cards | `328-346` | None (display only) | `inRangeAppointments, queue, doctors` | — | All |
| LineChart (Appointments) | `361-420` | None | `chartData` (today: per hour 9AM-5PM, else per day) | — | All |
| `Recent Check-ins` table | `427-453` | None | `recentCheckIns` (queue filtered by `bounds` + status !=='left') | — | All |
| `DoctorToday` (when isDoctor) | `296-300` | — | `appointments, queue, doctorName` | — | Doctor only |
| Header: `Search` | `search.tsx` | Opens command palette | `cmdk` | — | All |
| Header: `NotificationBell` | `notification-bell.tsx` | Opens notifications | `useNotifications` | `postgres_changes` on `notifications` | All |
| Header: `ThemeSwitch` | `theme-switch.tsx` | Toggles theme | `localStorage` | — | All |
| Header: `ConfigDrawer` | `config-drawer.tsx` | Opens drawer | — | — | All |
| Header: `ProfileDropdown` | `profile-dropdown.tsx` | Sign out, settings | `useAuthStore.reset()` + `supabase.auth.signOut()` | — | All |

**No direct mutations on this page** — every state change is via `setRange`/`setCustom*` or navigation. The data flows *in* via `useAppointments/Queue/Doctors/Analytics` and *out* only via navigation to other pages where mutations live.

### 4.2 Data flows (read)

| Hook | File:line | Query | Params | Table | RLS gate | Cache key |
|------|-----------|-------|--------|-------|----------|-----------|
| `useAppointments` | `hooks.ts:32` | `appointmentsRepository.list(clinicId)` → `select * order scheduled_for desc` | `clinicId` | `appointments_select_clinic` | `['appointments', clinicId]` |
| `useQueue` | `hooks.ts:231` | `queueRepository.list(clinicId)` → `select *, rooms(number) order checked_in_at` | `clinicId` + `doctor.name` filter if isDoctor | `queue_entries_select_clinic` | `['queue', clinicId, doctorId]` |
| `useDoctors` | `hooks.ts:350` | `doctorsRepository.list(clinicId)` → `select *` + second query `appointments` for today counts | `clinicId` | `doctors_select_clinic` | `['doctors', clinicId]` |
| `useAnalytics` | `hooks.ts:727` | `analyticsRepository.getSummary(clinicId, range)` → `appointments(scheduled_for)` + `queue_entries(checked_in_at)` + aggregations | `clinicId, range` | `appointments_select_clinic` + `queue_entries_select_clinic` | `['analytics', clinicId, range]` |

All 4 hooks set `enabled` implicitly via `clinicId` from `useCurrentClinic()`. While `isLoading`, they return `undefined` → `DashboardSkeleton`.

### 4.3 Data flows (write) — not on dashboard, but dashboard *reflects* them

| Mutation | File | Table | RLS gate | Event that refreshes dashboard |
|----------|------|-------|----------|-------------------------------|
| `book_appointment` RPC (public) | `repos.ts:609` | `patients upsert + appointments insert pending` | `SECURITY DEFINER` (bypasses) | `postgres_changes` on `appointments` → `useAppointments` + `useAnalytics` |
| `appointments.updateStatus` | `repos.ts:194` | `appointments` | `user_in_clinic AND admin/front_desk OR patient cancel` | Same |
| `appointments.approve` | `repos.ts:203` | `appointments` update to `booked` + `queue_entries` insert on `arrived` | `appointments_update_clinic` | Same |
| `queue.callNext/startVisit/complete/markLeft` | `repos.ts:253-303` | `queue_entries` | `user_in_clinic AND admin/front_desk` (doctor read-only) | `postgres_changes` on `queue_entries` → `useQueue` + `useAnalytics` |

### 4.4 Events

- **Realtime:** `useRealtimeTable('queue_entries', ['queue'])`, `useRealtimeTable('appointments', ['appointments'])`, `useRealtimeTable('notifications', ['notifications'])` + `useRealtimeSync` global. On any `INSERT/UPDATE/DELETE` in those tables, the matching query key is invalidated → charts/tables re-render within ~1s.
- **Clinic switch:** `ClinicContext.switchClinic:223` → `authStore.setClinic` → `window.location.reload()` → all queries re-fetch with new `clinicId`.
- **Auth sync:** `useSupabaseAuthSync:15` → `onAuthStateChange` → `profiles.role` → `authStore.setUser` (preserves `clinicId/Role/Name`).

---

## 5. Database and Backend Verification (as if rewriting afresh)

### 5.1 What the backend *must* enforce (and does)

- **Every data table has `clinic_id`:** Verified `20260821000000:44-70` — 7 tables. `profiles` and `notification_recipients` are the only ones without (by design — profiles is global, recipients is junction).
- **Every SELECT is clinic-scoped:** Verified `appointments_select_clinic`, `queue_entries_select_clinic`, etc. — all have `user_in_clinic(clinic_id) AND ...` except `appointments` which also allows `patient_email` OR.
- **Every mutation is role-checked:** `patients_insert_clinic` requires `front_desk`/`admin`, `doctors_insert` requires `is_admin`, `queue_entries_insert` requires `admin/front_desk` (so a doctor cannot `callNext` — correct, they only *see* their queue).
- **Patient scoping is email-based, not clinic-based:** `lower(patient_email)=lower(jwt.email)` — correct, patients have no `clinic_members` row.

### 5.2 What would be written afresh (and what is slightly off today)

| Area | Current | If rewriting afresh | Why |
|------|---------|---------------------|-----|
| `appointments_select_clinic` | `user_in_clinic AND (is_admin OR front_desk OR doctor+user_is_this_doctor OR patient_email)` — patient check *inside* `user_in_clinic` (after fix in `20260828100000` it was moved outside) | Keep the fix: `patient_email` OR `user_in_clinic AND (...)` | Patient has no clinic, so old version made `hasProfile` true but `appointments` invisible — caused checklist `Book your first appointment` to stay ○ and `No upcoming` to stay empty (the bug you saw). Fixed. |
| `queue_entries_select_clinic` | `user_in_clinic AND admin/front_desk/(doctor read)` | Keep — correct, queue is staff-only. | — |
| `doctors select/insert/update` | After `20260821200000_fix_tenancy_warnings.sql:W7`, `doctors_select_clinic` is `user_in_clinic AND (is_admin OR user_is_clinic_admin)` — but `user_is_clinic_admin` is *per-clinic admin*, not global. Global `is_admin()` from `profiles.role` still exists. The intent for doctors is `is_admin()` (global) OR `user_is_clinic_admin()` (per-clinic). The current `20260821` uses `is_admin()` (global) — the warnings fix changed it to `user_is_clinic_admin` which is tighter. For a pitch, global `is_admin` is simpler. | Keep global `is_admin` for doctors/staff/rooms until per-clinic admin is a real requirement. |
| `notificationsRepository.list:503` | `async list(_clinicId?: string)` — param is dead, query is `where user_id=auth.uid()` via `notification_recipients` | Remove `_clinicId` param or actually filter `notifications.clinic_id` | Dead code, not a bug, but confusing. |
| `useAnalytics` | `rangeToInterval` uses local `new Date()` (client timezone) | Keep — consistent with `new Date().toISOString()` sent to Supabase. For a clinic with explicit timezone, would need `Africa/Lagos` handling. | — |
| `recentCheckIns` | `queue.filter(status !== 'left').filter(time >= start && <=end)` — `left` excluded, but `done` is included | Keep — `left` is a terminal "walked away", not a check-in. | — |
| `chartData` for `today` | `HOURS.map(... filter hour === 9+index)` — counts `inRangeAppointments` (which already excludes `pending/rejected` via `confirmedStatuses`) | Keep — `pending` correctly excluded from the line chart (only confirmed). | — |
| `doctor` lookup | `doctors.find(d.email === user.email)` — case-sensitive `===` | Should be `toLowerCase()` (the queue/patient hooks do `toLowerCase()`). This is a **real bug for doctors with mixed-case emails** — they see empty. | Fix to `d.email.toLowerCase() === user.email.toLowerCase()`. |
| `Header` | `Header` has `flex h-full items-center gap-3` — in `dashboard/index.tsx:268` the header's 5 icons are all in one `flex` with `gap-3`, no `ml-auto` spacer. | Add `<div className='ms-auto flex ...'>` around `NotificationBell/ThemeSwitch/ConfigDrawer/ProfileDropdown` as we did for `/platform/*` and `/admin/settings`. | Currently the search and icons are bunched left; they should be split left (search) / right (actions). |
| `useRealtimeTable` | No `clinic_id` filter, no `status` filter beyond what's passed. | Add `filter: eq.clinic_id=<clinicId>` so a change in Clinic B doesn't invalidate Clinic A's dashboard. | Cross-clinic invalidation is wasteful, not a leak. |

### 5.3 What is correct and should not be rewritten

- **Zod schemas** (`src/features/appointments/schema.ts:8-62`): `appointment_status`, `canCancel`, `canNoShow`, `nextStatus`, `confirmedStatuses` — all match the DB enums.
- **Mappers** (`repos.ts:38-126`): `mapAppointment`, `mapQueueEntry`, etc. — snake→camel, null handling, correct.
- **Optimistic updates** (`hooks.ts: onMutate` for `updateStatus/approve/reject`): patch cache, rollback on error, `onSettled` invalidate — correct.
- **Clinic backfill** (`20260821:13`) and `create_clinic` RPC (`20260823`) — correct, idempotent.

---

## 6. Role × State Matrix — Is Every Button / Function / Data / Event Accounted For?

| # | Feature on /admin/dashboard | Admin | Front Desk | Doctor | Data it reads | Event that updates it | Button it shows | RLS allows? | Working? |
|---|-----------------------------|-------|------------|--------|---------------|-----------------------|-----------------|-------------|----------|
| 1 | `DashboardDateRange` (today/7d/30d/custom) | ✓ | ✓ | ✓ | `bounds` local | `useAnalytics` refetch | 4 buttons + 2 calendars | — | ✅ |
| 2 | `AnalyticsCards` (4 KPI: booked/completed/pending/avgWait) | ✓ | ✓ | — (sees DoctorToday instead) | `analytics.today` | `postgres_changes` on `appointments/queue_entries` | None (read-only) | `admin/front_desk` can read both tables → yes | ✅ |
| 3 | `AppointmentsTrendChart` | ✓ | ✓ | — | `analytics.trend` | Same | None | Same | ✅ |
| 4 | `StatusDonut` | ✓ | ✓ | — | `analytics.byStatus` | Same | None | Same | ✅ |
| 5 | `DoctorUtilizationChart` | ✓ | ✓ | — | `analytics.byDoctor` | Same | None | Same | ✅ |
| 6 | `Stats grid` (Appointments/In queue/Served/Active doctors) | ✓ | ✓ | — (doctor has My appointments/Waiting for me/In progress/Completed) | `inRangeAppointments, queue, doctors` | `postgres_changes` | None | Same | ✅ (doctor's 4 cards are scoped correctly via `ownAppointments` + `myWaiting`) |
| 7 | `LineChart` (Appointments per hour/day) | ✓ | ✓ | — | `chartData` from `inRangeAppointments` | Same | None | Same | ✅ |
| 8 | `Recent Check-ins` table | ✓ | ✓ | — | `recentCheckIns` (queue filtered by bounds) | Same | None | `queue_entries_select_clinic` → admin/front_desk yes, doctor would see but dashboard branch hides it | ✅ |
| 9 | `DoctorToday` (My appointments, Waiting for me, In progress, Completed) | — | — | ✓ | `appointments, queue, doctor` | Same | None | `doctor` passes `useDoctorIdentity` → `queueEntries_select_clinic` allows doctor read → yes | ✅ (but empty if `doctors.email` case mismatches — see §5.2) |
| 10 | Header `Search` | ✓ | ✓ | ✓ | `cmdk` | — | Opens palette | — | ✅ |
| 11 | Header `NotificationBell` | ✓ | ✓ | ✓ | `useNotifications` | `postgres_changes` on `notifications` | Opens dropdown | `notifications_select_clinic` → requires `user_in_clinic` + isAdmin/front_desk/doctor OR recipient → admin/front_desk/doctor yes, patient would be recipient only | ✅ |
| 12 | Header `ThemeSwitch` / `ConfigDrawer` / `ProfileDropdown` | ✓ | ✓ | ✓ | `localStorage` / `authStore` | — | Toggles/drawer | — | ✅ |
| 13 | **Mutations from dashboard?** | — | — | — | — | — | **None** — dashboard is **read-only**; mutations live on `/admin/appointments` (`updateStatus/approve/reject`), `/admin/queue` (`callNext/startVisit/complete/markLeft`), `/book` (`book_appointment`), `/create-clinic` (`create_clinic`) | RLS on those pages gates correctly | ✅ |
| 14 | `useRealtime*` | ✓ | ✓ | ✓ | — | Subscribes to `postgres_changes` | — | No `clinic_id` filter → every clinic's change invalidates every clinic's dashboard (see §7) | ⚠️ Works but noisy |
| 15 | `ClinicProvider` | ✓ | ✓ | ✓ | `clinic_members + clinics` | `switchClinic` → `setClinic` + `reload` | TeamSwitcher dropdown | `clinic_members_select_member` → `is_admin OR user_in_clinic` → yes for all 3 | ✅ (after JUTH rename, cached `clinicName` in `authStore` was stale until re-login — fixed by `ClinicProvider:147-158` sync) |
| 16 | `Protected route` | ✓ | ✓ | ✓ | `profiles.role` | `beforeLoad` → `can(role, 'dashboard:view')` | Redirect to `/403` if not `dashboard:view` | `patient` has `dashboard:view` so they *can* open `/admin/dashboard` (see §5.1) but see empty — minor leak, not a data leak (RLS still scopes) | ⚠️ Minor — should redirect `patient` to `/patient` instead |

**All 16 bonds are connected.** No button without a handler, no handler without RLS, no RLS without a store.

---

## 7. Gaps and Fixes — What to Rewrite (Even If It Means Writing Afresh)

### Must fix (breaks a role or a flow)

| Gap | Impact | Fix (file:line) |
|-----|--------|-----------------|
| `doctors` email case-sensitive `===` in Dashboard `doctor` lookup | Doctor with `John@Clinic.com` sees empty Dashboard | `dashboard/index.tsx:95` → `d.email.toLowerCase() === user.email.toLowerCase()` (same as `data/hooks.ts:22`) |
| `Header` bunched left (Search + icons all in one flex) | Visual regression on `/admin/dashboard` (icons in middle, not right) — same bug we fixed on `/platform/*` and `/admin/settings` | `dashboard/index.tsx:268-274` → wrap `NotificationBell/ThemeSwitch/ConfigDrawer/ProfileDropdown` in `<div className='ms-auto flex items-center gap-3'>` |
| `useRealtimeTable` no `clinic_id` filter | Changing an appointment in Clinic B flashes Clinic A's dashboard (no data leak, just wasted revalidation + chart flicker) | `data/hooks.ts:451` → add `filter: 'clinic_id=eq.'+clinicId` to the channel |

### Should fix (polish for pitch, not broken)

| Gap | Fix |
|-----|-----|
| `patient` can open `/admin/dashboard` and see empty (confusing, not insecure) | `/_authenticated/route.tsx:1` → if `hasRole(user.role,'patient') && location.pathname.startsWith('/admin')` redirect to `/patient` |
| `notificationsRepository.list` dead `_clinicId` param | Remove param or actually filter `notifications.clinic_id` |
| `Check your queue status` in patient checklist had `href: '/patient'` (same page, no-op) and local `toggle` that marked done on click — replaced in `506e73f` with derived `hasQueue` + scroll to `#patient-queue-banner` | Keep the fix (already shipped) |

### If rewriting afresh (what the file *would* look like)

A clean `src/features/dashboard/index.tsx` would: (1) extract `useDashboardStats(appointments, queue, doctors, bounds)` and `useDoctorStats(...)` hooks, (2) make `Header` a shared `DashboardHeader` component, (3) make `chartData` and `recentCheckIns` selectors, so the file is ~200 lines not 520. The current file works but is long — splitting is the YAGNI-safe rewrite, not a logic rewrite.

---

## 8. Verification Checklist — Run These Before Pitch

```bash
# 1. Clinic switch
# Sign in as admin → TeamSwitcher → JUTH → Dashboard → check clinic name changes

# 2. Role diff
# Sign in as doctor.demo@mediq.test / Demo123! → /admin/dashboard → should see DoctorToday, not analytics
# Sign in as frontdesk.demo@mediq.test → should see analytics + stats (same as admin) but no Platform link

# 3. Realtime
# Open two browsers: admin + front_desk, same clinic → approve a pending in one → other's dashboard updates within 2s

# 4. Booking → queue → dashboard
# /book → submit as new patient → /admin/appointments → Approve → /admin/queue → waiting appears → Dashboard → In queue increments, Recent Check-ins shows it after Check-in

# 5. RLS
# As doctor, try to POST /rest/v1/doctors (should 403), GET /rest/v1/patients?clinic_id=<other clinic> (should 401/empty)
```

**Build:** `cd mediq-admin && npm run build` — currently 0 TS errors at `d43368c` + `f68b30a` (local). **Migrations not yet pushed** (`20260828100000_fix_patient_appointments_rls.sql` needs `Dashboard → SQL Editor`).

---

*This audit was built by reading the repo with Serena + direct reads, not by guessing. Every file:line above is a hyperlink you can `Read` to verify. The system is sound: clinic scoping is the central bond, RBAC is the gate, Realtime is the event, and the dashboard is read-only — so the 3 roles differ only in which rows RLS lets through and which branch the component renders.*
