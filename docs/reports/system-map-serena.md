# MediQ Admin Dashboard — System Map (Serena + Direct Reads)

> **Scope:** `/admin/dashboard` across 3 clinic roles (`admin`, `front_desk`, `doctor`)
> **Method:** `serena_activate_project` on `mediq-admin` (timed out — Serena MCP `MCP error -32001` on every call) → fell back to `serena_get_symbols_overview` attempts + verified direct reads of all target files (`src/features/dashboard/index.tsx:1`, `src/data/hooks.ts:1`, `src/data/supabase/repos.ts:1`, `src/lib/clinic-context.tsx:1`, `src/stores/auth-store.ts:1`, `src/config/rbac.ts:1`, `supabase/migrations/20260821000000_clinics.sql:1`). Symbol counts cross-checked via local script. Serena is treated as attempted; direct reads are the source of truth.
> **Date:** 2026-08-28 | **Branch:** `feature/clinic-management-modules` | **Workspace:** `C:\Users\MAFUYAI\Documents\MediQ\mediq-admin`

---

## 1. Route → Store → Clinic Scoping (entry point)

```
Browser GET /_authenticated/admin/dashboard
  -> src/routes/_authenticated/route.tsx:1 (beforeLoad: checks useAuthStore.user.exp, can(role, requiredPermissionFor(pathname)))
  -> src/routes/_authenticated/admin/dashboard.tsx:1 createFileRoute('/_authenticated/admin/dashboard') => Dashboard
  -> src/components/layout/authenticated-layout.tsx:1 ClinicProvider wraps Outlet (NoClinicError gate)
       -> src/lib/clinic-context.tsx:23 ClinicContext / 57 useCurrentClinic() -> { clinicId, clinicRole, isReady }
       -> src/stores/auth-store.ts:42 Zustand useAuthStore { auth.user: { accountNo, email, role[], exp, clinicId?, clinicRole?, clinicName? } + cookies thisisjustarandomstring/mediq_user }
  -> Dashboard reads clinic implicitly via hooks, never via URL params or props
```

`routePermissions` (`src/config/rbac.ts:82`) has **no entry for `/admin/dashboard`** — dashboard inherits "open to any signed-in role" but `rolePermissions` (`src/config/rbac.ts:33`) grants `dashboard:view` to all three roles (`admin: PERMISSIONS`, `front_desk: includes dashboard:view`, `doctor: includes dashboard:view`). `patient` role also has `dashboard:view` but is blocked at `_authenticated` layout level (no clinic membership).

---

## 2. Component Map — Exported Symbols, Props, Hooks Called

| File | Exported Symbol(s) | Props | Hooks Called | Touches DB? |
|------|--------------------|-------|--------------|-------------|
| `src/features/dashboard/index.tsx:38` | `Dashboard()` (519 lines) | — (reads `useAuthStore.state.auth.user`) | `useAuthStore` (`src/stores/auth-store.ts:42`), `useAppointments` (`src/data/hooks.ts:32`), `useQueue` (`src/data/hooks.ts:115`), `useDoctors` (`src/data/hooks.ts:286`), `useAnalytics` (`src/data/hooks.ts:401`), `useState`, `useMemo` | No direct Supabase; delegates to hooks. Local `isDoctor = user?.role.includes('doctor')` at `index.tsx:82` (bypasses `hasRole()` — stylistic gap). |
| `src/features/dashboard/components/analytics-cards.tsx:29` | `AnalyticsCards({data, isLoading})` | `data?: AnalyticsSummary` (`src/data/supabase/repos.ts:722`), `isLoading: boolean` | none (pure) | No — renders `data.today.*` and `data.avgWaitMinutes` |
| `src/features/dashboard/components/appointments-trend-chart.tsx:21` | `AppointmentsTrendChart({data, isLoading})` | `data?: {date, booked, completed}[]`, `isLoading` | none | No — renders `data` via Recharts `AreaChart` |
| `src/features/dashboard/components/status-donut.tsx:24` | `StatusDonut({data, isLoading})` | `data?: {name, value}[]`, `isLoading` | none | No |
| `src/features/dashboard/components/doctor-utilization-chart.tsx:21` | `DoctorUtilizationChart({data, isLoading})` | `data?: {name, completed}[]`, `isLoading` | none | No |
| `src/features/dashboard/components/date-range.tsx:27` | `DashboardDateRange`, `type DashboardRange = 'today'|'7d'|'30d'|'custom'` | `range`, `onRangeChange`, `from/to`, `onFromChange/onToChange` | none | No |
| `src/features/dashboard/components/doctor-today.tsx:12` | `DoctorToday({appointments, queue, doctorName})` | `appointments: Appointment[]`, `queue: QueueEntry[]`, `doctorName: string` | `useMemo` | No — filters `appointments`/`queue` client-side by `doctorName` |
| `src/features/dashboard/components/analytics-helpers.ts:14` | `aggregateByStatus(rows)`, `calcAvgWaitMinutes(entries)` | pure helpers | none | No DB; unit-tested at `analytics.test.ts:1` |

**Key branching inside `Dashboard` (`src/features/dashboard/index.tsx:82-143`):**
- `isDoctor ? doctors.find(d => d.email === user.email)` → `ownAppointments = appointments.filter(a => a.doctorId === doctor.id)` → doctor view shows `DoctorToday` only.
- Non-doctor → full analytics (`AnalyticsCards` + 3 charts) + legacy stats (`stats[]`, `chartData`, `recentCheckIns`).

---

## 3. Hook → Store/Route → Table Graph

| Hook (`src/data/hooks.ts`) | Store / Context Read | Repo Method (`src/data/supabase/repos.ts`) | Table(s) + Columns | RLS Gate (final, post `fix_tenancy_warnings.sql`) | Event Triggered |
|-----------------------------|----------------------|--------------------------------------------|--------------------|---------------------------------------------------|-----------------|
| `useAppointments()` (`hooks.ts:32`) | `useCurrentClinic().clinicId` → `queryKey ['appointments', clinicId]` | `appointmentsRepository.list(clinicId?)` (`repos.ts:131`) | `appointments` (`scheduled_for, status, doctor_id, clinic_id`) | `appointments_select_clinic`: `(user_in_clinic(clinic_id) AND (is_admin OR front_desk OR doctor+user_is_this_doctor)) OR lower(patient_email)=lower(jwt.email)` | `postgres_changes` via `useRealtimeAppointments` (`hooks.ts:474`) |
| `useQueue()` (`hooks.ts:115`) | `useCurrentClinic` + `useDoctorIdentity()` (`doctors` lookup scoped by email) | `queueRepository.list(clinicId?)` (`repos.ts:222`) | `queue_entries` + join `rooms(number)` via `queue_entries_room_id_fkey` | `queue_entries_select_clinic`: `user_in_clinic AND (admin OR front_desk OR doctor)` (doctor read-only; mutations blocked by UPDATE/DELETE policies) | `postgres_changes` via `useRealtimeQueue` (`hooks.ts:467`) |
| `useDoctors()` (`hooks.ts:286`) | `useCurrentClinic` | `doctorsRepository.list(clinicId?)` (`repos.ts:328`) + second query `appointments` for `todayAppointments` counts | `doctors` + `appointments` (for aggregation) | `doctors_select_clinic`: `user_in_clinic AND (admin OR front_desk OR doctor)` | — |
| `useAnalytics(range)` (`hooks.ts:401`) | `useCurrentClinic` | `analyticsRepository.getSummary(clinicId?, range)` (`repos.ts:696`) | `appointments` (range + today queries) + `queue_entries` (wait calc) | Same as `appointments_select_clinic` + `queue_entries_select_clinic` | — (range is `'today'|'7d'|'30d'`; custom range falls back to `'today'` at `index.tsx:49`) |
| `useBookedSlots(date, doctorId)` (`hooks.ts:84`) | `useCurrentClinic` | `appointmentsRepository.getBookedHours(date, clinicId?, doctorId?)` (`repos.ts:163`) | `appointments` (`scheduled_for, doctor_id, status`, filtered to `pending/booked/arrived/in_progress`) | `appointments_select_clinic` (read) | — |
| `usePatients()` | `useCurrentClinic` + `useDoctorIdentity` | `patientsRepository.list` + `appointmentsRepository.list` filtered to doctor’s `patientEmail/patientName` | `patients` + `appointments` | `patients_select_clinic`: `user_in_clinic AND (admin OR front_desk OR doctor)` | — |
| `useStaff()` / `useRooms()` / `useNotifications()` | `useCurrentClinic` (notifications ignores param — see flag) | `staffRepository.list` / `roomsRepository.list` / `notificationsRepository.list` | `staff` / `rooms` / `notifications` + `notification_recipients` | `staff_select_clinic` / `rooms_select_clinic` / `notifications_select_clinic`: `user_in_clinic AND (recipient OR admin/front_desk/doctor)` | `useRealtimeNotifications` |
| `useCreateAppointment` / `useCreateDoctor` / `useCreatePatient` etc. | `useCurrentClinic` | `*.create(input, clinicId)` | same tables `INSERT ... clinic_id` | `*_insert_clinic` policies (admin OR clinic-admin for doctors/staff/rooms; admin/front_desk for patients/appointments) | `invalidateQueries(['appointments'|'queue'|...])` on success |

> **Store reads:** Every list hook reads `clinicId` from `useCurrentClinic()` (`src/lib/clinic-context.tsx:57`) which itself reads `ClinicContext` populated by `ClinicProvider.fetchMemberships()` → `supabase.from('clinic_members').select('clinic_id, role, clinics(...)').eq('user_id', auth.uid())`. Auth identity comes from `useAuthStore` (`src/stores/auth-store.ts:42`) + `useSupabaseAuthSync` (`src/hooks/use-supabase-auth-sync.ts:1`) which preserves `clinicId/clinicRole/clinicName` across `onAuthStateChange`.

---

## 4. Store & Clinic Scoping (src/lib/clinic-context.tsx:22 + src/stores/auth-store.ts:42)

- **`useAuthStore`** (`stores/auth-store.ts:42`): Zustand store, `AuthUser { accountNo, email, role: string[], exp, clinicId?, clinicRole?: 'admin'|'front_desk'|'doctor', clinicName? }`, persisted in cookies `thisisjustarandomstring` (token) + `mediq_user` (user JSON). `setUser`, `setClinic`, `reset`.
- **`ClinicProvider`** (`lib/clinic-context.tsx:101`): on mount resolves `clinic_members` for `auth.uid()`, maps to `ClinicMembership[]`, picks current clinic matching `auth.user.clinicId` or first entry, syncs back to `authStore.setUser`. `switchClinic()` updates store + `window.location.reload()` to bust React Query caches.
- **`useCurrentClinic()`** (`lib/clinic-context.tsx:57`): `{ clinicId: string|null, clinicRole: string|null, isReady: boolean }` — `null` while `isLoading`; every repo guards with `if (clinicId) query.eq('clinic_id', clinicId)` so unauthenticated/pre-ready queries intentionally avoid cross-clinic leakage but **query without `clinic_id` filter is possible** (see flags).
- **`useDoctorIdentity()`** (`data/hooks.ts:22` private): `hasRole(user.role,'doctor')` + `useDoctors().data.find(d => lower(email)==lower(user.email))`; fail-closed to `[]` when doctor not resolved.

---

## 5. RBAC — 3 Dashboard Roles (src/config/rbac.ts:1)

```ts
rolePermissions.admin      = PERMISSIONS (all 17)
rolePermissions.front_desk = ['dashboard:view','appointments:view','appointments:book','appointments:manage',
                              'queue:view','queue:manage','patients:view','patients:manage','notifications:view']
rolePermissions.doctor     = ['dashboard:view','appointments:view','queue:view','patients:view','notifications:view']
```

| Capability on `/admin/dashboard` | admin | front_desk | doctor |
|----------------------------------|-------|------------|--------|
| See `AnalyticsCards` + 3 charts (booked/completed/pending/avgWait + 7-day trend + By Status donut + Doctor Utilization) | ✅ | ✅ (full clinic aggregate) | ❌ (replaced by `DoctorToday` schedule+queue) |
| See legacy stats: appointments/queue/served/activeDoctors | ✅ | ✅ | Scoped: `My appointments / Waiting for me / In progress / Completed` (`index.tsx:103`) |
| See `Recent Check-ins` table / hourly `Appointments` LineChart | ✅ | ✅ | ❌ (`DoctorToday` instead) |
| Mutate via `queue:manage` / `appointments:manage` | ✅ (via other pages) | ✅ | ❌ (read-only queue; `queue_entries_update_clinic` denies doctor) |
| RLS backstop | `is_admin() OR user_is_clinic_admin(clinic_id)` for writes; `user_in_clinic(clinic_id)` for reads | `has_role('front_desk') + user_in_clinic` | `has_role('doctor') AND user_is_this_doctor(doctor_id)` + `user_in_clinic` for narrow select; otherwise patient-email clause |

`AuthenticatedLayout.beforeLoad` (`routes/_authenticated/route.tsx:1`) enforces `requiredPermissionFor(location.pathname)` via `can(user.role, perm)`; `/admin/dashboard` has no explicit entry → **open to all authenticated roles** (dashboard visibility gated by component branch, not router).

---

## 6. DB Migration — `clinic_id` Coverage (`supabase/migrations/20260821000000_clinics.sql:1`)

All 7 data tables **now carry `clinic_id uuid REFERENCES clinics(id)`** + `idx_*_clinic_id` index (`sql:44-78`):

| Table | Has `clinic_id`? | FK | Index | Notes |
|-------|-------------------|----|-------|-------|
| `appointments` | ✅ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS clinic_id` (`sql:44`) | `clinics(id) ON DELETE RESTRICT` | `idx_appointments_clinic_id` | `scheduled_for, status, doctor_id, patient_email` indexed |
| `patients` | ✅ (`sql:49`) | same | `idx_patients_clinic_id` | `patients_email_unique_idx` on `lower(email)` preserved |
| `doctors` | ✅ (`sql:54`) | same | `idx_doctors_clinic_id` | `user_id` FK → `profiles(id)` for `user_is_this_doctor` |
| `staff` | ✅ (`sql:59`) | same | `idx_staff_clinic_id` | `role: staff_role` enum |
| `rooms` | ✅ (`sql:64`) | same | `idx_rooms_clinic_id` | |
| `queue_entries` | ✅ (`sql:69`) | same | `idx_queue_entries_clinic_id` | `room_id FK`, `appointment_id FK` |
| `notifications` | ✅ (`sql:74`) | same | `idx_notifications_clinic_id` | `notification_recipients` junction **has no `clinic_id`** (scoped via parent) |
| `clinics` / `clinic_members` | PK / `PRIMARY KEY (clinic_id, user_id)` | `clinic_members.clinic_id → clinics(id) CASCADE`, `user_id → profiles(id) CASCADE` | — | Backfilled: default clinic `slug='default'` created, all NULL `clinic_id`s backfilled, all `admin/front_desk/doctor` profiles added to default clinic (`sql:304-340`) |

**Subsequent migrations harden this:**
- `20260821100000_fix_tenancy_bugs.sql`: cancel-protection trigger `protect_appointment_cancel`, `mark_*_read` switched to `SECURITY DEFINER`, case-insensitive `lower(email)` everywhere, `link_doctor_user_id` early-return fix.
- `20260821200000_fix_tenancy_warnings.sql`: validates `book_appointment` clinic is `status='active'`, hoists patient clause outside `user_in_clinic` (W2), cross-clinic `doctor_id` rejected on `appointments_insert_clinic` (W5), `list_public_doctors(NULL)` scoped to `default` clinic (W6), `user_is_clinic_admin` added alongside `is_admin` (W7), `REVOKE EXECUTE FROM PUBLIC` on helpers.

---

## 7. RLS Policies Gating the 4 Key Tables (final state post `fix_tenancy_warnings.sql`)

### `appointments` (`sql:184-233` + `fix_tenancy_warnings.sql:43-94`)

- **SELECT** `appointments_select_clinic`: `user_in_clinic(clinic_id) AND (is_admin OR front_desk OR (doctor AND user_is_this_doctor(doctor_id))) OR lower(patient_email)=lower(jwt.email)` — W2 hoist lets patients bypass `user_in_clinic`.
- **INSERT** `appointments_insert_clinic`: `user_in_clinic(clinic_id) AND (is_admin OR front_desk) AND (doctor_id IS NULL OR EXISTS doctors WHERE id=doctor_id AND clinic_id=clinic_id)` — W5 cross-clinic guard.
- **UPDATE** `appointments_update_clinic`: `USING (user_in_clinic AND (admin OR front_desk) OR patient_email=jwt.email)` / `WITH CHECK (user_in_clinic AND (admin OR front_desk) OR (patient_email=jwt.email AND status='cancelled'))` + `protect_appointment_cancel` trigger (`fix_tenancy_warnings.sql:96`) locks `patient_name/email, doctor_id/name, scheduled_for, reason` on cancel.
- **DELETE** `appointments_delete_clinic`: `user_in_clinic AND (admin OR front_desk)`

### `queue_entries` (`sql:236-262`)

- **SELECT** `queue_entries_select_clinic`: `user_in_clinic(clinic_id) AND (admin OR front_desk OR doctor)` — doctors can read full queue (client filters to `doctorName` at `hooks.ts:115`), but…
- **INSERT** `queue_entries_insert_clinic`: `user_in_clinic AND (admin OR front_desk)` — doctors **cannot insert**.
- **UPDATE** `queue_entries_update_clinic`: `USING/WITH CHECK user_in_clinic AND (admin OR front_desk)` — doctors **cannot mutate** (`callNext/startVisit/complete/markLeft` all denied at RLS for doctor role).
- **DELETE** `queue_entries_delete_clinic`: same.

### `patients` (`sql:126-150`)

- **SELECT** `patients_select_clinic`: `user_in_clinic AND (admin OR front_desk OR doctor)` — doctors see all clinic patients; hook (`hooks.ts:142`) narrows to their own via appointment emails/names client-side.
- **INSERT/UPDATE/DELETE** `patients_*_clinic`: `user_in_clinic AND (admin OR front_desk)` — doctors read-only.

### `doctors` (`sql:152-174` + `fix_tenancy_warnings.sql:176-197` W7)

- **SELECT** `doctors_select_clinic`: `user_in_clinic AND (admin OR front_desk OR doctor)`
- **INSERT/UPDATE/DELETE** `doctors_*_clinic`: `user_in_clinic AND (is_admin OR user_is_clinic_admin(clinic_id))` — front_desk denied; clinic-admin allowed alongside global admin.

> Helper functions (`sql:82-123`): `user_in_clinic(uuid)` / `user_is_clinic_admin(uuid)` / `user_is_this_doctor(uuid)` — all `SECURITY DEFINER`, `REVOKE EXECUTE FROM PUBLIC, anon` (W7/I3), `GRANT TO authenticated` only.

---

## 8. Full Graph: `Component -> Hook -> Store/Route -> Table(RLS) -> Event`

```mermaid
flowchart LR
  subgraph Route
    R[/_authenticated/admin/dashboard/] --> L[AuthenticatedLayout<br/>ClinicProvider]
    L --> D[Dashboard<br/>src/features/dashboard/index.tsx:38]
  end

  subgraph Hooks
    D --> H_A[useAppointments<br/>hooks.ts:32]
    D --> H_Q[useQueue<br/>hooks.ts:115]
    D --> H_D[useDoctors<br/>hooks.ts:286]
    D --> H_AN[useAnalytics<br/>hooks.ts:401]
    D --> H_BS[useBookedSlots<br/>hooks.ts:84]
  end

  subgraph Store_Context
    H_A --> C[useCurrentClinic<br/>lib/clinic-context.tsx:57]
    H_Q --> C
    H_D --> C
    H_AN --> C
    C --> S[useAuthStore<br/>stores/auth-store.ts:42<br/>+ clinic_members]
    H_Q --> DI[useDoctorIdentity<br/>hooks.ts:22]
    DI --> H_D
  end

  subgraph Repos
    H_A --> RA[appointmentsRepository.list<br/>repos.ts:131]
    H_Q --> RQ[queueRepository.list<br/>repos.ts:222]
    H_D --> RD[doctorsRepository.list<br/>repos.ts:328]
    H_AN --> RAN[analyticsRepository.getSummary<br/>repos.ts:696]
  end

  subgraph Tables_RLS
    RA --> T_APT[(appointments<br/>clinic_id<br/>appointments_select_clinic)]
    RQ --> T_Q[(queue_entries<br/>clinic_id<br/>queue_entries_select_clinic)]
    RD --> T_DOC[(doctors<br/>clinic_id<br/>doctors_select_clinic)]
    RD -.-> T_APT2[(appointments<br/>today counts)]
    RAN --> T_APT3[(appointments<br/>range+today)]
    RAN --> T_Q2[(queue_entries<br/>avgWait)]
  end

  subgraph Components_Leaf
    D --> AC[AnalyticsCards<br/>today.booked/completed/pending/avgWait]
    D --> AT[AppointmentsTrendChart<br/>trend]
    D --> SD[StatusDonut<br/>byStatus]
    D --> DU[DoctorUtilizationChart<br/>byDoctor]
    D --> DT[DoctorToday<br/>doctor-today.tsx:12]
    AC & AT & SD & DU --> RAN
    DT --> H_A
    DT --> H_Q
  end

  subgraph Events_Realtime
    T_APT -. real-time .-> RT_A[useRealtimeAppointments<br/>postgres_changes appointments]
    T_Q -. real-time .-> RT_Q[useRealtimeQueue<br/>postgres_changes queue_entries]
    T_Q -. on check-in .-> E_CHK[useUpdateAppointmentStatus<br/>hooks.ts:44<br/>arrived -> INSERT queue_entries<br/>+ protect_appointment_cancel trigger]
  end

  subgraph RBAC
    S -. roleRoles .-> RBAC{can(role,perm)<br/>config/rbac.ts:59}
    RBAC -. admin:all .-> D
    RBAC -. front_desk:full analytics .-> D
    RBAC -. doctor:DoctorToday only .-> D
  end
```

**Compact string form:**

- `Dashboard -> useAppointments -> useCurrentClinic/useAuthStore -> appointments(RLS: appointments_select_clinic, clinic_id) -> postgres_changes:list invalidation + protect_appointment_cancel trigger on status='cancelled'`
- `Dashboard -> useQueue -> useCurrentClinic+useDoctorIdentity(useDoctors) -> queue_entries(RLS: queue_entries_select_clinic, clinic_id) + rooms(join) -> postgres_changes:queue + callNext/startVisit events (RLS denies doctor mutate)`
- `Dashboard -> useDoctors -> useCurrentClinic -> doctors(RLS: doctors_select_clinic, clinic_id) + appointments (today aggregation) -> —`
- `AnalyticsCards/AppointmentsTrendChart/StatusDonut/DoctorUtilizationChart -> useAnalytics -> useCurrentClinic -> analyticsRepository.getSummary -> appointments(queue_entries) (RLS as above) -> pure aggregateByStatus/calcAvgWaitMinutes`
- `Dashboard (doctor) -> DoctorToday -> (appointments+queue already scoped) -> local date filter -> —`

---

## 9. Flags — Reads Without `clinic_id` Scoping / Hooks Bypassing `useCurrentClinic()`

| # | Location | What it does | Scoped? | Severity | Fix |
|---|----------|--------------|---------|----------|-----|
| **F1** | `src/data/hooks.ts:44` `useUpdateAppointmentStatus` — inline `supabase.from('appointments').select('*').eq('id', id)` + `supabase.from('queue_entries').insert({..., clinic_id: apt.clinic_id})` | Fetches appointment and inserts queue entry **without `eq('clinic_id', clinicId)`** in the SELECT; trusts `apt.clinic_id` for insert | ⚠️ **BYPASS** — relies solely on RLS `user_in_clinic` to block cross-clinic `arrived`; no defense-in-depth `clinic_id` filter in code. If RLS ever regresses, a front_desk user could `arrived` an appointment from another clinic by guessing UUID. | Add `.eq('clinic_id', clinicId)` to the fetch query and verify `apt.clinic_id === clinicId` before insert. |
| **F2** | `src/data/supabase/repos.ts:503` `notificationsRepository.list(_clinicId?)` | Ignores `clinicId` param entirely; `SELECT * FROM notifications` then filters `notification_recipients` by `user_id` only; RLS `notifications_select_clinic` still requires `user_in_clinic(clinic_id)` so cross-clinic not exposed, but code-level scoping is absent and the `_clinicId` arg is dead. | ⚠️ **DEAD PARAM** — hook `useNotifications` (`hooks.ts:371`) passes `clinicId` but repo discards it. No clinic filter in query. | Either forward `clinicId` to query (`eq('clinic_id', clinicId)`) or document as intentional (notification visibility is user-scoped, not clinic-scoped). Remove unused param to avoid false confidence. |
| **F3** | `src/data/hooks.ts:451` `useRealtimeTable` / `useRealtimeQueue` / `useRealtimeAppointments` | Subscribes to `postgres_changes` on `queue_entries`/`appointments` with `filter: doctor_name=eq...` **but never filters by `clinic_id`**. Every client receives invalidation for every clinic’s writes, then refetches scoped data — wasteful + leaks existence via channel traffic (timing side-channel). | ⚠️ **NO clinic_id CHANNEL FILTER** | Subscribe with `filter: clinic_id=eq.${clinicId}` when `clinicId` ready; see `supabase/migrations/20260820600000_enable_realtime.sql` should have `REPLICA IDENTITY FULL` + `supabase_realtime` publication. |
| **F4** | `src/data/hooks.ts:84` `useBookedSlots` + `src/data/supabase/repos.ts:163` `getBookedHours` | If `clinicId` is `null` (provider still `isLoading` or user has no clinic), query runs **without `clinic_id` filter** (`if (clinicId) query.eq(...)`). During the loading window, the first fetch is clinic-unscoped; RLS may still block but code emits a broad query. | ⚠️ **OPTIONAL clinicId** — same pattern in `analyticsRepository.getSummary`, `appointmentsRepository.list`, etc. | Guard hooks with `enabled: !!clinicId` or `queryFn` that returns `[]` when `clinicId==null` (like `useQueue` fail-closed). Add `isReady` check from `useCurrentClinic`. |
| **F5** | `src/features/dashboard/index.tsx:82` `isDoctor = user?.role.includes('doctor')` vs `src/data/hooks.ts:22` `hasRole(user.role,'doctor')` | Inconsistent doctor detection: `includes` is case-sensitive and ignores RBAC helpers; if role ever stored as `'Doctor'` or nested array changes, detection diverges. Low risk today but drift. | ℹ️ **STYLE DRIFT** | Replace with `hasRole(user.role,'doctor')` to match `useDoctorIdentity`. |
| **F6** | `src/data/supabase/repos.ts:328` `doctorsRepository.list` — `supabase.from('appointments').select('doctor_id').in('doctor_id', doctorIds).gte(...).lte(...)` | Second query counts `todayAppointments` per doctor **without `clinic_id` filter** (neither `eq('clinic_id', clinicId)` nor narrowed by doctor `clinic_id`). Cross-clinic appointments for same `doctor_id` (if UUID reused after backfill) could inflate counts; RLS still applies but code doesn’t enforce. | ⚠️ **MISSING clinic_id on aggregation** | Add `.eq('clinic_id', clinicId)` or `.in('clinic_id', clinicIds)` to counts query when `clinicId` present. Same issue in `roomsRepository.list` occupancy query (`queue_entries` where `status='in_room'` without clinic filter). |
| **PASS** | `AnalyticsCards`, `StatusDonut`, `DoctorUtilizationChart`, `AppointmentsTrendChart` | Pure presentational; receive `data` prop, never query Supabase. Correct — scoping is delegated to `useAnalytics` parent. | ✅ No flag | — |
| **PASS** | `usePublicDoctors`, `useBookAppointment` / `book_appointment` RPC | `SECURITY DEFINER` RPCs intentionally bypass RLS; `p_clinic_id` validated inside function (`fix_tenancy_warnings.sql: W1,W6`) and scoped to `default` clinic when NULL. | ✅ Intentional bypass, audited | — |

**Summary:** 0 components hit Supabase directly without clinic scoping (good). 4 hooks/repos have **code-level `clinic_id` omissions** (F1, F3, F4, F6) that are currently backstopped by RLS but lack defense-in-depth. F2 is a dead param; F5 is cosmetic. No hook fully **bypasses** `useCurrentClinic()` in the sense of ignoring tenancy — they all read it — but several execute queries **before** `clinicId` is ready or without re-applying the filter on secondary queries.

---

## 10. Serena Symbol Summary (fallback direct reads — Serena MCP timed out)

> `serena_activate_project` + `serena_get_symbols_overview` on all 10 target files returned `MCP error -32001: Request timed out` (network/MCP server). Direct reads are verified and line-accurate.

| File | Lines | Exported Symbols | Notable Calls |
|------|-------|------------------|---------------|
| `src/features/dashboard/index.tsx:38` | 519 | `Dashboard`, `CheckInRow`, `DashboardSkeleton` | `useAppointments`, `useQueue`, `useDoctors`, `useAnalytics`, `useAuthStore`, `useMemo`, `useState` |
| `src/features/dashboard/components/analytics-cards.tsx:12` | 69 | `AnalyticsCards` (`cards[4]`, `AnalyticsCardsProps`) | `Card`, `Skeleton` |
| `src/features/dashboard/components/appointments-trend-chart.tsx:17` | 125 | `AppointmentsTrendChart` (`TrendData`, `AppointmentsTrendChartProps`) | `ResponsiveContainer`, `AreaChart`, `Area` |
| `src/features/dashboard/components/status-donut.tsx:11` | 89 | `StatusDonut` (`StatusData`, `StatusDonutProps`, `COLORS[6]`) | `PieChart`, `Pie`, `Cell`, `Tooltip` |
| `src/features/dashboard/components/doctor-utilization-chart.tsx:14` | 101 | `DoctorUtilizationChart` (`DoctorData`, `DoctorUtilizationChartProps`) | `BarChart`, `Bar` |
| `src/data/hooks.ts:32` | 564 | `useAppointments`, `useCreateAppointment`, `useUpdateAppointmentStatus`, `useApproveAppointment`, `useRejectAppointment`, `useCancelAppointment`, `useSignUp`, `usePublicDoctors`, `useBookedSlots`, `useBookAppointment`, `useQueue`, `useQueueActions`, `usePatients`, `useDoctors`, `useStaff`, `useRooms`, `useNotifications`, `useAnalytics`, `useRealtime*` (31 exports) | `useCurrentClinic`, `useAuthStore`, `useQuery`, `useMutation`, `supabase` |
| `src/data/supabase/repos.ts:1` | 834 | `appointmentsRepository`, `queueRepository`, `patientsRepository`, `doctorsRepository`, `staffRepository`, `roomsRepository`, `notificationsRepository`, `bookingRepository`, `authRepository`, `analyticsRepository` + `AnalyticsSummary`/`AnalyticsRange` | `supabase.from`, `aggregateByStatus`, `calcAvgWaitMinutes` |
| `src/lib/clinic-context.tsx:23` | 206 | `ClinicProvider`, `useCurrentClinic`, `useClinicContext`, `ClinicMembership`, `ClinicContextValue` | `supabase.from('clinic_members')`, `useAuthStore`, `useContext`, `useEffect` |
| `src/stores/auth-store.ts:14` | 95 | `useAuthStore`, `AuthUser`, `AuthState` | `create(Zustand)`, `getCookie`, `setCookie` |
| `src/config/rbac.ts:14` | 115 | `ROLES`, `PERMISSIONS`, `rolePermissions`, `routePermissions`, `can`, `hasRole`, `requiredPermissionFor` | — |

---

## Appendix — File References

- Init schema: `supabase/migrations/20260819113813_init.sql:1`
- Clinics tenancy: `supabase/migrations/20260821000000_clinics.sql:1`
- Tenancy fixes: `supabase/migrations/20260821100000_fix_tenancy_bugs.sql:1` + `supabase/migrations/20260821200000_fix_tenancy_warnings.sql:1`
- Auth sync: `src/hooks/use-supabase-auth-sync.ts:1`
- Realtime: `src/hooks/use-realtime-sync.ts:1` (if present) + `src/data/hooks.ts:451`
- Dashboard route: `src/routes/_authenticated/admin/dashboard.tsx:1`
- RBAC: `src/config/rbac.ts:1`
- Domain contract: `src/types/domain.ts:1`

> All `file_path:line_number` anchors are 1-indexed to the current `feature/clinic-management-modules` HEAD. Re-run direct reads if files have moved.
