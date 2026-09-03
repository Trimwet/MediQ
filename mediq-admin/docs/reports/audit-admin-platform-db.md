# Audit: Admin (`/admin/*`) · Platform Owner (`platform_admin`) · Database (`supabase/migrations/*`)

**Scope:** `src/features/dashboard/index.tsx:1` · `src/features/staff/index.tsx:1` + `schema.ts:1` + `components/staff-dialog.tsx:1` · `src/features/doctors/index.tsx:1` + `schema.ts:1` + `components/doctor-dialog.tsx:1` · `src/features/rooms/index.tsx:1` + `schema.ts:1` + `components/room-dialog.tsx:1` · `src/data/hooks.ts:1` + `src/data/supabase/repos.ts:1` + `src/data/index.ts:1` + `src/config/rbac.ts:1` + `src/lib/clinic-context.tsx:1` + `src/routes/_authenticated/admin/*` + `src/routeTree.gen.ts:1` + `supabase/migrations/20260820_multi_tenancy.sql:1` + `20260825_notifications_audit_hardening.sql:1` + `20260902000000_list_public_clinics.sql:1`  
**Date:** 2026-09-03 · **Method:** Serena `get_symbols_overview` / `find_symbol` / `search_for_pattern` + full reads, traced `create` → `clinic_id` → RLS → `GRANT`/`pg_cron`. All citations `file:line` are 1-indexed under `mediq-admin/`.  
**Spec divergence:** The task lists `src/data/platform-hooks.ts`, `src/routes/_platform/*`, `src/config/rbac.ts` `platform_admin = all perms`, and migrations `20260821000000_clinics.sql`, `20260823_create_clinic.sql`, `20260827000000_repair_profiles_500.sql`, `20260828000000_platform_users_with_email.sql`, `20260829000000_fix_patient_queue_and_insert.sql` — **none of those 8 paths exist** in this repo (verified via `filesystem_search_files` + `filesystem_list_directory`). The actual DB surface is the 3 migrations above.

---

## Summary — 10 bullets

1. **Admin analytics is clinic-scoped correctly at the happy path** (`dashboard/index.tsx:67`, `hooks.ts:750` → `repos.ts:752` `eq('clinic_id',clinicId)` + `throw Missing clinic context` when null) but falls through to **whole-clinic KPIs for unlinked doctors** (`dashboard/index.tsx:297` `isDoctor && doctor` else admin branch — see BB-01).
2. **All 3 admin `create` flows thread `clinic_id` from `useCurrentClinic()`** — `doctors` (`hooks.ts:633`, `repos.ts:371` `if (!clinicId) throw`), `staff` (`hooks.ts:671`, `repos.ts:421` `if (!clinicId) throw`, `upsert onConflict email`), `rooms` (`hooks.ts:700`, `repos.ts:498` `if (!clinicId) throw`). `staff` and `patients` inserts are the exceptions (see BB-02–BB-05).
3. **`doctors.user_id` exists in DB but is never written by the frontend** — `repos.ts:371` inserts `{name,specialization,email,status,clinic_id}` without `user_id`; `doctors.user_id` was added at `20260825_notifications_audit_hardening.sql:61` and backfilled via `lower(email)` join at `:65`, but new creates stay `NULL` and rely on the email-fallback branch in `user_is_this_doctor` (`20260825:219`).
4. **`staff` upsert on `email` is tenant-unsafe** — `repos.ts:424` `upsert({…}, {onConflict:'email'})` assumes a global `unique(email)`; the canonical multi-tenancy invariant is `unique(clinic_id,email)` or a partial `lower(email)` index. Cross-clinic invite overwrites the global row / throws `duplicate` incorrectly (BB-02). Invite of an **existing auth user** also silently skips `clinic_members` (`staff-dialog.tsx:121` `userId null`).
5. **Platform surface is entirely missing** — no `platform_admin` role (`rbac.ts:13` `ROLES=['admin','front_desk','doctor','patient']`), no `is_platform_admin()` / `is_admin()` is the only platform helper, no `get_platform_users()` (`auth.users` join), no `usePlatformStats/Clinics/Users` hooks, no `src/routes/_platform/*`, no `src/data/platform-hooks.ts`, no UI to promote to `platform_admin` (BB-07/08).
6. **Every data table is still `clinic_id` NULLABLE after backfill** — `20260820:132` and `20260825:80` do `add column if not exists clinic_id uuid references clinics(id)` with **no `NOT NULL`**, backfill at `20260820:193` / `20260825:120` sets `= default_clinic_id where is null`, but never `alter … set not null`. A future insert without `clinic_id` lands as `NULL` and becomes invisible (`repos.ts:690` patient insert without `clinic_id` is the live instance — BB-05).
7. **RLS is clinic-scoped everywhere except one gap** — all 11 core tables have `user_in_clinic(clinic_id)` or `user_is_clinic_admin` or `user_is_this_patient(email)` or `is_admin()` branches; the gap is `queue_entries` **no patient branch** (`20260825:802` `user_in_clinic && (not doctor-membership OR doctor_name IN …)`), so patient `useQueue` (`hooks.ts:488`) always returns `[]` despite a clinic-less fallback select at `hooks.ts:492` (BB-06). `profiles` avoids recursion via `is_admin()` SECURITY DEFINER (`20260825:881`).
8. **GRANTS are an allow-list for the public RPCs but missing an explicit `GRANT SELECT ON clinics` and leaking `link_clinic_member`** — `book_appointment→anon` (`20260825:1081`), `list_public_doctors→anon,authenticated` (`20260825:1121`), `list_public_clinics→anon,authenticated` (`20260902:23`), `call_next_in_queue→authenticated` (`20260825:1168`), `link_clinic_member→authenticated` (`20260825:1216`) are correct; `pg_cron` for reminders is **not set** (zero `pg_cron` / `cron.schedule` hits) — see DB §4.
9. **Migrations are only half-idempotent** — `20260825` wipes policies via `pg_policies` loop (`20260825:619`) and `drop function … cascade` (`20260825:149`), so it is idempotent; `20260820` is not (`create policy "Public can read active clinics"` without prior drop → `duplicate_object` on re-run; same for every `add column` is safe but `create table clinics` + `create policy` is not). Backfill blocks use `on conflict do nothing` correctly.
10. **Immediate fixes before ship:** set `clinic_id NOT NULL` after backfill, wire `doctors.user_id` on create (or drop the column and keep email-only), change `staff` upsert to `onConflict: 'clinic_id,email'` + add that unique index, call `link_clinic_member` for existing-user invites, add `platform_admin` to `ROLES` + `rolePermissions` + `is_platform_admin()` + `/platform` routes + cron, add `queue_entries` patient RLS branch, and guard doctor unresolved fallback.

---

## 1. Admin States

### 1.1 Dashboard — `src/features/dashboard/index.tsx:1` (admin view: analytics + stats + charts)

| State | File:Line | Render | Data bond | Clinic / RLS |
|-------|-----------|--------|-----------|--------------|
| Admin KPI cards | `dashboard/index.tsx:306` `AnalyticsCards data={analyticsQuery.data}` | `analytics-cards.tsx:34` `today.booked/completed/pending/avgWait` | `hooks.ts:750` `useAnalytics(range)` → `repos.ts:752` `analyticsRepository.getSummary(clinicId, range)` → 3× `supabase.from('appointments'/'queue_entries').eq('clinic_id',clinicId)` `gte/lte scheduled_for` | `if (!clinicId) throw Missing clinic context` (`repos.ts:758`) — fail-closed. RLS `appointments_select_clinic` `user_in_clinic` |
| Trend + Donut + Utilization | `dashboard/index.tsx:312` `AppointmentsTrendChart data={analyticsQuery.data?.trend}` `StatusDonut data={byStatus}` `DoctorUtilizationChart data={byDoctor}` | `analytics-helpers.ts:15` `aggregateByStatus` + `repos.ts:818` aggregation | Same `analyticsRepository.getSummary` — `byStatus` from `aggregateByStatus(rows)` where rows are range-filtered appointments; `byDoctor` map `completed` per `doctor_name` | Same |
| Legacy stats grid (4 cards) | `dashboard/index.tsx:330` `stats.map` `Appointments / In queue / Served / Active doctors` | `inRangeAppointments.length`, `waitingCount`, `servedCount`, `activeDoctors` | `hooks.ts:69` `useAppointments()` → `repos.ts:133` `eq('clinic_id',clinicId)` fail-closed `if (!clinicId) return []`; `hooks.ts:478` `useQueue()` → `repos.ts:236`; `hooks.ts:606` `useDoctors()` → `repos.ts:335` | `user_in_clinic` on all three tables |
| LineChart (appointments over time) | `dashboard/index.tsx:362` `LineChart data={chartData}` | `HOURS` map for `today`, else `eachDayOfInterval` | `chartData` derived from `inRangeAppointments` (`dashboard/index.tsx:221`) | — |
| Recent Check-ins (5) | `dashboard/index.tsx:429` `recentCheckIns.map CheckInRow` | `queue.filter(status!=='left').sort(checkedInAt)` | `useQueue()` | — |
| Doctor mirror branch | `dashboard/index.tsx:297` `isDoctor && doctor ? <DoctorToday>` | `doctor-today.tsx:16` filtered `today` + `myQueue filter doctorName` | `dashboard/index.tsx:93` `doctors.find(d.email.toLowerCase()===user.email.toLowerCase())` + `hooks.ts:37` `useDoctorIdentity` same | Same RLS but client narrows further; when unresolved shows admin branch (BB-01) |
| Loading | `dashboard/index.tsx:295` `isPending → DashboardSkeleton` | `isPending = appointmentsQuery.isPending || queueQuery.isPending || doctorsQuery.isPending` | Hooks `enabled: !!clinicId` (or `isPatient` branch) | While `useCurrentClinic().isLoading` → `clinicId=null` → hooks idle → `isPending=false` → flashes 0-state not skeleton (BB-09) |

**Route guard:** `_authenticated/route.tsx:7` `beforeLoad` checks `!user → /sign-in`, `hasRole(patient) && pathname.startsWith('/admin') → /patient`, then `requiredPermissionFor(pathname)` (`rbac.ts:114`) — `/admin/dashboard` inherits no entry → open to every signed-in role; drill-down shows doctor does have `dashboard:view` (`rbac.ts:69`) so allowed.

### 1.2 Staff — `src/features/staff/index.tsx:1` + `components/staff-dialog.tsx:1` + `schema.ts:1` + `src/data/hooks.ts:661` + `src/data/supabase/repos.ts:408`

| Step | File:Line | Bond | `clinic_id`? | RLS |
|------|-----------|------|--------------|-----|
| List | `hooks.ts:661` `useStaff()` → `repos.ts:409` `from('staff').select('*').eq('clinic_id',clinicId).order('name')` | `enabled: !!clinicId`, fail-closed `if (!clinicId) return []` | ✅ `eq clinic_id` | `staff_select_clinic` `using (user_in_clinic(clinic_id))` (`20260825:777`) |
| RBAC gate | `staff/index.tsx:21` `can('staff:manage')` → Invite button + `onDelete` | `rbac.ts:46` `admin: PERMISSIONS` includes `staff:*`; `front_desk`/`doctor` lack | — | — |
| Invite dialog | `staff-dialog.tsx:89` `role = form.watch('role')` + doctors lookup | Local | — | — |
| Create auth account | `staff-dialog.tsx:99` `supabase.auth.signUp({email, password: tempPassword, options:{data:{name,role}}})` | **No `clinic_id`** at auth layer (correct — auth is global) | — | — |
| Create directory row | `staff-dialog.tsx:131` `onCreated({name,role,phone,email,status:'active'})` → `staff/index.tsx:28` `createStaff.mutate(member)` → `hooks.ts:671` `useCreateStaff` `mutationFn: staffRepository.create(input, clinicId)` | `repos.ts:421` `if (!clinicId) throw; insert({name,role,phone,email,status,clinic_id:clinicId})` via `upsert {onConflict:'email'}` | ✅ passes `clinic_id` but see BB-02 for `onConflict` scope | `staff_insert_clinic` `with check (user_is_clinic_admin(clinic_id))` (`20260825:781`) — only `admin` can insert; `front_desk` invite would be blocked (UI hides but API would 403) |
| Link membership | `staff-dialog.tsx:140` `if (userId && clinicId) supabase.from('clinic_members').insert({clinic_id:clinicId, user_id:userId, role: memberRole})` | ✅ `clinic_id` passed | BUT when `authError includes 'already been registered'` then `userId` stays `null` (`staff-dialog.tsx:121`) and insert is **skipped silently** — existing user left bricked (BB-03). Correct path is `rpc('link_clinic_member', {p_clinic_id,p_email,p_role})` (`20260825:1174`) |
| Doctor mirror | `staff-dialog.tsx:161` `if (role==='doctor') createDoctor.mutate({name,specialization,email,…})` | `hooks.ts:633` `doctorsRepository.create(input, clinicId)` → `repos.ts:371` `insert({…,clinic_id:clinicId})` **without `user_id`** (BB-01) | ✅ `clinic_id` but ❌ `user_id` null | `doctors_insert_clinic` `with check (user_is_clinic_admin(clinic_id))` |
| Delete | `staff/index.tsx:35` `deleteStaff.mutate(id)` → `hooks.ts:681` → `repos.ts:443` `from('staff').delete().eq('id',id)` | **No `clinic_id` predicate** (relies on RLS) | — | `staff_delete_clinic` `using (user_is_clinic_admin(clinic_id))` (`20260825:785`) |
| Realtime | `hooks.ts:764` `useRealtimeTable('staff',…)` (defined, not called by page) + global `useRealtimeSync` (`src/hooks/use-realtime-sync.ts:47`) | — | — | Unfiltered channel `mediq-realtime-sync` invalidates `['staff']` on every clinic's change (BB-09) |

**Upsert safety:** `repos.ts:424` `upsert(…, {onConflict:'email'})` — the task asks "Is `staff` upsert on `email` safe with partial index?" No partial index exists in either migration, and no `unique(clinic_id,email)` does either. The backfill only creates `unique(clinic_id,user_id)` (`20260825:101`) and `unique(slug)` (`20260825:92`). A tenant-isolated invite must be `onConflict: 'clinic_id,email'` (or `lower(email)`) with a matching `create unique index if not exists staff_clinic_email_uidx on staff(clinic_id, lower(email))`. Today invite for `alice@acme.ng` in clinic B overwrites / collides with same email in clinic A.

### 1.3 Doctors — `src/features/doctors/index.tsx:1` + `schema.ts:1` + `components/doctor-dialog.tsx:1`

| Step | File:Line | Bond | `clinic_id`? | `user_id`? | RLS |
|------|-----------|------|--------------|------------|-----|
| List | `hooks.ts:606` `useDoctors()` → `repos.ts:335` `from('doctors').select('*').eq('clinic_id',clinicId)` + today counts via `appointments` `in('doctor_id', ids).eq('clinic_id',clinicId)` | `enabled: isPatient || !!clinicId`, `if (!clinicId) return []` | ✅ | — | `doctors_select_clinic` `using (user_in_clinic(clinic_id))` (`20260825:760`) |
| RBAC | `doctors/index.tsx:25` `can('doctors:manage')` → Add + status/delete | `rbac.ts:46` `admin` has `doctors:*` | — | — | — |
| Dialog create | `doctor-dialog.tsx:55` `onCreated({name,specialization,email,status:'active',todayAppointments:0})` | No `user_id` field in form (by design — doctor may not have account yet) | — | — | — |
| Repo create | `hooks.ts:633` `useCreateDoctor` `mutationFn: doctorsRepository.create(input, clinicId)` → `repos.ts:371` `insert({name,specialization,email,status,clinic_id:clinicId})` `.select().single()` then `mapDoctor({…,today_appointments:0})` | ✅ `clinic_id` required else `throw Missing clinic context` | ❌ `user_id` **never set** (`repos.ts:373`) | `doctors_insert_clinic` `with check (user_is_clinic_admin(clinic_id))` |
| `user_id` contract | `20260825:61` `alter table doctors add column if not exists user_id uuid references profiles(id) on delete set null` + `20260825:65` backfill `set user_id=u.id from auth.users where lower(d.email)=lower(u.email)` + `20260825:205` `user_is_this_doctor` checks `d.user_id=auth.uid() OR (d.user_id is null and d.email = auth.users.email)` | — | — | — |
| Update status / Delete | `hooks.ts:643` `useUpdateDoctorStatus` → `repos.ts:389` `from('doctors').update({status}).eq('id',id)` ; `hooks.ts:652` `useDeleteDoctor` → `repos.ts:398` `delete().eq('id',id)` | **No `clinic_id` predicate** (relies on RLS) | — | — | `doctors_update/delete_clinic` `using (user_is_clinic_admin(clinic_id))` — so `front_desk` cannot bypass despite missing predicate; tenant isolation is via RLS not client filter |
| Queue scoping via doctor name | `hooks.ts:478` `useQueue` doctor branch + `queue_entries_select` `doctor_name in (select d.name where d.user_id=uid OR email…)` | Doctor sees own queue via `doctorName` match | — | — | When `doctors.user_id IS NULL` the fallback `d.email = auth.users.email` still works, but a later email change breaks the bond (stale). Setting `user_id` on create would make `user_is_this_doctor` stable. |

**Answer to audit question:** "Is `doctors.user_id` linked correctly?" Partially — migration adds column + backfill, but the **create path never links it**, so every new doctor starts as `NULL` and queue `select` depends on the email-fallback. Inviting a doctor via **Staff** path (`staff-dialog.tsx:161`) also creates a doctor row without `user_id`. Correct would be in `staff-dialog.tsx:161` after `userId` is known: `insert {…, user_id:userId}` (or via `link_clinic_member` + doctor row update), and in `doctors` standalone flow: after the doctor account is created, set `user_id`.

### 1.4 Rooms — `src/features/rooms/index.tsx:1` + `schema.ts:1` + `components/room-dialog.tsx:1`

| Step | File:Line | Bond | `clinic_id`? | RLS |
|------|-----------|------|--------------|-----|
| List | `hooks.ts:690` `useRooms()` → `repos.ts:454` `from('rooms').select('*').eq('clinic_id',clinicId)` → join `queue_entries` `in('room_id', ids).eq('status','in_room').eq('clinic_id',clinicId)` to populate `doctorName/patientName` occupancy | `if (!clinicId) return []`, `enabled !!clinicId` | ✅ | `rooms_select_clinic` `using (user_in_clinic(clinic_id))` |
| RBAC + feature flag | `rooms/index.tsx:22` `can('rooms:manage')` + `facility-store trackRooms` | Invite button only if both `canManage && trackRooms` | — | — |
| Dialog create | `room-dialog.tsx:54` `onCreated({number,type,status:'available'})` | — | — | — |
| Repo create | `hooks.ts:700` `useCreateRoom` → `repos.ts:498` `insert({number,type,status,clinic_id:clinicId})` `if (!clinicId) throw` | ✅ | `rooms_insert_clinic` `with check (user_in_clinic(clinic_id))` (`20260825:794`) — note **any member** can insert rooms (not admin-only, unlike doctors/staff). Matches `rbac.ts:52` `front_desk` lack `rooms:*` but RLS would still allow via API bypass (same pattern as queue) |
| Update status | `hooks.ts:710` `useUpdateRoomStatus` → `repos.ts:515` `from('rooms').update({status}).eq('id',id)` | **No `clinic_id` predicate** | `rooms_update_clinic` `using (user_in_clinic(clinic_id))` |
| Visibility | `rooms/index.tsx:79` `!trackRooms → Card "Room tracking is turned off. Enable it in Settings → Facility"` | `facility-store.ts` | — | — |
| Sidebar | `app-sidebar.tsx:82` `isVisible` checks `item.url==='/admin/rooms' ? trackRooms : true` + `routePermissions['/admin/rooms']='rooms:view'` | `rbac.ts:102` | — | — |

**Answer to audit question:** "Do they all pass `clinic_id` from `useCurrentClinic()`?" **Yes for the happy path** — all three `useCreate*` hooks read `const {clinicId}=useCurrentClinic()` and forward to `*Repository.create(input, clinicId ?? undefined)` which throws if `!clinicId`. The two gaps are (a) `staff` upsert key is wrong scope, (b) `doctors.user_id` never set, (c) `patients` insert in `authRepository.signUp` passes no `clinic_id` at all (`repos.ts:690`).

---

## 2. Platform States — `platform_admin` is unimplemented

> **Finding:** This codebase has **no platform owner surface**. Every platform file referenced in the task is absent, and every platform capability it asks to trace is unimplemented. The section below proves the absence and describes what exists instead.

### 2.1 What the task asked vs what exists

| Asked | Expected path | Found | Evidence |
|-------|---------------|-------|----------|
| `src/data/platform-hooks.ts` — `usePlatformStats/Clinics/Users` | `is_platform_admin()` RLS guard + `get_platform_users() join auth.users` | ❌ **Missing** | `filesystem_search_files **/*platform*` → 0 hits; `src/data/` contains `hooks.ts`, `index.ts`, `repos.ts`, `supabase/repos.ts` only |
| `src/routes/_platform/*` | Platform layout + `/platform/clinics`, `/platform/users`, `/platform/analytics` | ❌ **Missing** | `filesystem_list_directory src/routes` → `(auth)`, `(errors)`, `_authenticated`, `_public`, `book.tsx`, `change-password.tsx`, `check-in.tsx`, `create-clinic.tsx`, `patient.tsx`, `__root.tsx` — no `_platform` |
| `src/config/rbac.ts` `platform_admin = all perms` | `platform_admin: PERMISSIONS` | ❌ **Missing** | `rbac.ts:13` `ROLES=['admin','front_desk','doctor','patient']`; `rbac.ts:46` only `admin: PERMISSIONS` (clinic admin, not platform). No `platform_admin` entry, no `is_platform_admin` helper |
| `supabase/migrations/20260821000000_clinics.sql` | Clinics table + `is_platform_admin()` | ❌ **Missing** | `supabase/migrations/` has `20260820_multi_tenancy.sql`, `20260825_notifications_audit_hardening.sql`, `20260902000000_list_public_clinics.sql` only |
| `20260823_create_clinic.sql` | `create_clinic(p_name,p_slug,p_plan)` RPC | ❌ **Missing as file** — RPC exists at runtime? | No migration file, but `src/features/create-clinic/index.tsx:362` calls `supabase.rpc('create_clinic', {p_name,p_slug,p_plan})` and migration `20260825:1174` contains `link_clinic_member` not `create_clinic` — suggests `create_clinic` lives in the remote DB built from an older ad-hoc migration, not this repo |
| `20260827000000_repair_profiles_500.sql` | Profile recursion fix `is_admin()` | ✅ **Exists but renamed** | Canonical is `20260825:881` `create or replace function is_admin() …` + `20260825:894` `Platform admins can read all profiles using (is_admin())` — the repair is baked into the hardening migration, not a standalone file |
| `20260828000000_platform_users_with_email.sql` | `get_platform_users() join auth.users` | ❌ **Missing** | `filesystem_search_files get_platform` → 0 hits; `is_platform_admin` → 0 hits |
| `20260829000000_fix_patient_queue_and_insert.sql` | Queue patient INSERT + patient branch | ❌ **Missing** | Queue still has no patient branch (`20260825:802`) |
| `pg_cron` for reminders | `cron.schedule('reminders', …)` | ❌ **Missing** | `filesystem_search_files pg_cron|cron|remind` → 0 hits across repo |

### 2.2 What *does* exist as the "platform" primitive

| Primitive | File:Line | Semantics | Why it is not `platform_admin` |
|-----------|-----------|-----------|--------------------------------|
| `is_admin()` | `20260825:881` `select exists(select 1 from profiles where id=auth.uid() and role='admin')` `security definer` | "Global admin" checked via `profiles.role='admin'` | Used only for `profiles` RLS (`20260825:894` `Platform admins can read all profiles`), not for clinics/tenancy. `20260820:250` `user_is_clinic_admin` also has `or exists(select 1 from profiles where role='admin')` bootstrap, but no `platform_admin` distinct role |
| `user_is_clinic_admin(clinic_id)` | `20260820:237` / `20260825:185` | `clinic_members role='admin' OR profiles role='admin'` | Clinic admin, not platform owner — can manage own clinic's doctors/staff (`doctors_insert_clinic`, `staff_insert_clinic`), not all clinics |
| `admin: PERMISSIONS` | `rbac.ts:48` `admin: PERMISSIONS` | Clinic manager has every UI permission | The task's "platform_admin = all perms" is already true for `admin`, but `admin` is **tenant-scoped** (`user_is_clinic_admin(clinic_id)` + `user_in_clinic`), not cross-tenant |
| `clinics` public read | `20260825:640` `using (status='active' or user_in_clinic(id))` | Anyone sees active clinics; members see own even if suspended | No `platform_admin` bypass (`is_admin()`) — a platform owner cannot list suspended/cancelled clinics unless they are a member |
| No `platform_admin` route guard | `routeTree.gen.ts:241` `FileRoutesByFullPath` contains only `'/admin/*'`, `'/patient'`, `'/book'` etc | — | Any `/platform/*` link would 404 |

### 2.3 Tracing the asked platform bonds (all absent)

**`usePlatformStats/Clinics/Users` — do they use `is_platform_admin()` RLS correctly?**  
No hooks exist. The closest analogues are `useAnalytics` (`hooks.ts:750`), `usePublicClinics` (`hooks.ts:383` `rpc('list_public_clinics')`), and `useDoctors` — all tenant-scoped or public, never `is_platform_admin()`-gated. A correct implementation would be:

```sql
create or replace function is_platform_admin() returns boolean … select exists(select 1 from profiles where id=auth.uid() and role='platform_admin');
create policy "Platform can read all clinics" on clinics for select using (is_platform_admin());
create policy "Platform can read all clinic_members" on clinic_members for select using (is_platform_admin());
-- plus get_platform_users() exposing auth.users.email via is_platform_admin() guard
```

and on the frontend:

```ts
// src/data/platform-hooks.ts (missing)
export function usePlatformStats() { return useQuery({ queryFn: () => supabase.rpc('get_platform_stats'), enabled: hasRole(user.role,'platform_admin') }) }
```

None of this exists.

**Does `get_platform_users()` join `auth.users` correctly?**  
No function exists. The closest is `supabase/migrations/20260825:1174` `link_clinic_member` which does `select u.id from auth.users where lower(email)=lower(p_email)` — that is a direct `auth.users` read inside SECURITY DEFINER, which is the correct pattern for a platform users RPC (needs `security definer` because PostgREST cannot expose `auth.users`). A `get_platform_users` would need the same but is absent. The `staff-dialog.tsx:99` invite flow also tries to link `auth.users` from the client and fails for existing users (BB-03) — exactly what `get_platform_users` + `link_clinic_member` should solve.

**Is there a UI to promote a user to `platform_admin`?**  
No. `src/features/staff/components/staff-dialog.tsx:31` `staffRoles=['front_desk','admin','doctor']` — no `platform_admin`. No route, no RPC, no `supabase.from('profiles').update({role:'platform_admin'})`. The `supabase/functions/invite-staff` Edge Function hinted at `supabase.ts:30` is also not in repo. Promoting would require a `SECURITY DEFINER is_platform_admin()`-gated `promote_to_platform_admin(p_user_id uuid)` RPC — absent.

### 2.4 Platform RBAC gap

`rbac.ts:13` must become:

```ts
export const ROLES = ['admin','front_desk','doctor','patient','platform_admin'] as const
export const rolePermissions: Record<Role,…> = {
  platform_admin: PERMISSIONS, // or a superset including 'platform:*'
  admin: PERMISSIONS,
  …
}
```

and `routePermissions` needs `/platform/*` entries. Today a user with `role=['platform_admin']` would hit `rolePermissions[platform_admin] → undefined → can() false` (`rbac.ts:82` `?? []`) and be denied every route — the exact inversion of "platform_admin = all perms".

---

## 3. DB Structure

### 3.1 `clinic_id` — `NOT NULL` after backfill?

| Table | Migration that added `clinic_id` | Definition | Backfill | `NOT NULL`? | Verdict |
|-------|----------------------------------|------------|----------|-------------|---------|
| `clinics` (parent) | `20260820:17` `create table clinics …` | PK — N/A | — | ✅ `id uuid primary key` | — |
| `clinic_members` | `20260820:62` `clinic_id uuid not null references clinics(id)` | `not null` from birth | — | ✅ | Correct |
| `appointments` | `20260820:132` `add column if not exists clinic_id uuid references clinics(id)` + `20260825:80` same | `uuid` **nullable** | `20260820:193` `update … set clinic_id=default where clinic_id is null` + `20260825:120` same | ❌ **Still nullable** — no `alter column set not null` after backfill | Broken |
| `patients` | `20260820:137` / `20260825:81` | `uuid` nullable | Same backfill + `20260825:745` special `insert with check (clinic_id is null)` for own-record sign-up | ❌ Still nullable (required for sign-up null row, but should be `check (clinic_id is not null or auth-derived)` not open null) | Broken by design + bug (`repos.ts:690` inserts null without clinic) |
| `doctors` | `20260820:142` / `20260825:82` + `20260825:61` `user_id uuid references profiles(id)` | Both `uuid` nullable | `20260825:65` backfill `user_id`, `20260825:122` clinic backfill | ❌ Both still nullable | Broken — should be `user_id` nullable (doctor may be directory-only) but `clinic_id` should be `not null` |
| `staff` | `20260820:147` / `20260825:83` | `uuid` nullable | Same | ❌ Still nullable | Broken |
| `rooms` | `20260820:152` / `20260825:84` | `uuid` nullable | Same | ❌ Still nullable | Broken |
| `queue_entries` | `20260820:157` / `20260825:85` | `uuid` nullable | Same plus `20260825:128` backfill check `insert … clinic_id: apt.clinic_id` may be null (`check-in/index.tsx:83` path historically) | ❌ Still nullable | Broken |
| `notifications` | `20260820:162` / `20260825:86` | `uuid` nullable | Same | ❌ Still nullable | Broken |
| `notification_recipients` | `20260820:167` / `20260825:87` | `uuid` nullable | Same | ❌ Still nullable | Broken |
| `audit_logs` | `20260825:255` `create table audit_logs (… clinic_id uuid references clinics(id) …)` | `uuid` **nullable** intentionally (global events) | — | ✅ Intentional nullable (actor may have no clinic) | Correct |
| `profiles` | Pre-existing | `id uuid primary key` — no `clinic_id` (correct — profile is global, membership is in `clinic_members`) | — | — | Correct |

**Fix:** After the backfill `do $$ … update … where clinic_id is null; end $$;` add for each table:

```sql
alter table public.appointments alter column clinic_id set not null;
alter table public.staff alter column clinic_id set not null;
-- … etc, except patients (keep nullable with check) and audit_logs (intentionally nullable)
```

And add a `check (clinic_id is not null)` on `patients` inserts that come from `book_appointment` (already `not null` there) plus keep the `clinic_id is null` allow-list only for the own-record path.

### 3.2 Every RLS policy has `user_in_clinic` or patient/platform branch?

| Table | Policies (canonical `20260825:606` wipe + recreate) | `user_in_clinic`? | Patient branch? | Platform branch? | Verdict |
|-------|------------------------------------------------------|-------------------|-----------------|------------------|---------|
| `clinics` | `Public can read active clinics using (status='active' or user_in_clinic(id))` (`20260825:640`) ; `Clinic admins can update their clinic using (clinic_id in (select … role='admin'))` | ✅ | — | ❌ no `is_admin()` bypass for platform listing of suspended clinics | Mostly correct; platform gap |
| `clinic_members` | `Users can read own memberships using (user_id=auth.uid())`; `Clinic admins can insert/update/delete` (`20260825:654`) | ❌ read is `user_id=uid` not `user_in_clinic` (correct — avoids recursion) | — | ❌ | Correct |
| `appointments` | `Clinic members can read … using (user_in_clinic(clinic_id) and (not doctor-membership OR user_is_this_doctor OR user_is_this_patient))` (`20260825:686`) ; `Clinic staff can insert with check (user_in_clinic)` ; `Clinic members can update … using (user_in_clinic and not doctor)` ; `Patients can cancel … using (user_is_this_patient and status in (pending,booked)) with check (status='cancelled')` (`20260825:721`) + trigger `protect_appointment_patient_updates` (`20260825:932`) | ✅ | ✅ `user_is_this_patient` + `user_is_this_doctor` | ✅ `is_admin()` via `user_is_clinic_admin` bootstrap | Correct — the only table with all three branches |
| `patients` | `Clinic members can read using (user_in_clinic)` ; `Clinic staff can insert with check (user_in_clinic)` ; `Users can create their own patient record with check (lower(email)=lower(auth.users.email) and clinic_id is null)` (`20260825:745`) ; `Clinic staff can update using (user_in_clinic)` | ✅ | ✅ own-record `clinic_id is null` | ❌ | Correct (null clinic is intentional for pre-booking sign-up) |
| `doctors` | `Clinic members can read using (user_in_clinic)` ; `Clinic admins can insert/update/delete using (user_is_clinic_admin)` (`20260825:759`) | ✅ | — | ❌ | Correct |
| `staff` | Same pattern as doctors (`20260825:776`) | ✅ | — | ❌ | Correct |
| `rooms` | `Clinic members can read using (user_in_clinic)` ; `Clinic staff can insert with check (user_in_clinic)` ; `Clinic staff can update using (user_in_clinic)` (`20260825:789`) | ✅ | — | ❌ | Correct — but note insert/update is any member, not just admin (unlike doctors/staff). Matches `front_desk` not having `rooms:manage` but API would allow (design gap BB-12) |
| `queue_entries` | `Clinic members can read … using (user_in_clinic and (not doctor-membership OR doctor_name in (select d.name where d.user_id=uid or email…)))` (`20260825:802`) ; `Clinic staff can insert with check (user_in_clinic)` ; `Clinic staff can update using (user_in_clinic)` (`20260825:830`) | ✅ | ❌ **Missing** — `audit-patient-staff-doctor.md` P-03 same | ❌ | **Broken** — patient has no branch, `useQueue` patient fallback (`hooks.ts:492`) always RLS-blocked |
| `notifications` | `Clinic members can read using (user_in_clinic)` ; `Clinic staff can insert/update with check (user_in_clinic)` (`20260825:834`) | ✅ | — | ❌ | Correct |
| `notification_recipients` | `Users can read own … using (user_id=auth.uid() and user_in_clinic(clinic_id))` ; `Clinic staff can insert with check (user_in_clinic)` ; `Users can update own … using (user_id=auth.uid())` ; `Clinic admins can update all in clinic using (user_is_clinic_admin)` (`20260825:848`) | ✅ (plus `user_id`) | — | ❌ | Correct |
| `profiles` | `Users can read/update own using (id=auth.uid())` ; `Platform admins can read/manage all using (is_admin())` (`20260825:894`) — via `20260825:881` `is_admin()` SECURITY DEFINER to avoid `42P17` recursion | — | — | ✅ `is_admin()` | Correct |

**Enforcement helpers (all `security definer`, `stable`, `set search_path=public`):**

- `current_user_clinic_id()` (`20260825:159`) — `select clinic_id from clinic_members where user_id=auth.uid() limit 1`
- `user_in_clinic(uuid)` (`20260825:171`) — `exists(select 1 from clinic_members where user_id=auth.uid() and clinic_id=target)`
- `user_is_clinic_admin(uuid)` (`20260825:185`) — `exists(clinic_members role='admin') OR exists(profiles role='admin')` (bootstrap)
- `user_is_this_doctor(uuid,uuid)` (`20260825:205`) — `d.user_id=uid OR (d.user_id is null and d.email=auth.users.email)` OR `is_admin()` — correctly handles `NULL user_id` fallback
- `user_is_this_patient(text)` (`20260825:233`) — `lower(auth.users.email)=lower(patient_email)` OR `is_admin()`
- `is_admin()` (`20260825:881`) — `exists(profiles role='admin')` via SECURITY DEFINER to break `profiles` recursion (`20260825:876` comment)
- `column_type_of(text,text)` (`20260825:39`) — catalog lookup for enum-vs-text resilience

**Publication for realtime:** `20260825:583` `alter publication supabase_realtime add table public.<t>` for `appointments,queue_entries,patients,doctors,staff,rooms,notifications` (idempotent via `duplicate_object` catch).

### 3.3 Every `GRANT` is correct?

| Object | Grant in repo | Correct? | Evidence / note |
|--------|---------------|----------|-----------------|
| `book_appointment(p_name,p_email,p_phone,p_scheduled_for,p_doctor_id,p_reason,p_clinic_id)` | `20260820:616` `grant execute to anon`; `20260825:1081` re-grant to `anon` | ✅ | Anon must book; function validates `clinic status='active'`, spam `count pending <8`, resolves doctor in same clinic (`20260825:1034`), locks `status='pending'` |
| `list_public_doctors(p_clinic_id uuid default null)` | `20260825:1121` `grant execute to anon, authenticated` | ✅ | SECURITY DEFINER, returns only `id,name,specialization` filtered `status='active'` + legacy `clinic_id is null` fallback (`20260825:1116`) |
| `list_public_clinics()` | `20260902:23` `grant execute to anon, authenticated` | ✅ | SECURITY DEFINER, `where status='active'` |
| `call_next_in_queue(p_clinic_id uuid default null, p_doctor_name text default null)` | `20260825:1168` `grant execute to authenticated` | ✅ | SECURITY DEFINER, `FOR UPDATE SKIP LOCKED` (`20260825:1159`), fallback to `current_user_clinic_id()` when null, checks `user_in_clinic` |
| `link_clinic_member(p_clinic_id,p_email,p_role)` | `20260825:1216` `grant execute to authenticated` | ✅ but **no anon** — invite via existing-user path requires caller be `user_is_clinic_admin` (`20260825:1187`), not platform | `staff-dialog.tsx:140` bypasses this RPC and does direct `from('clinic_members').insert` which will RLS-fail for `front_desk`; should call `rpc('link_clinic_member')` |
| `clinics` table `select` | No explicit `grant select on clinics to anon, authenticated` in either migration | ⚠️ **Missing** | RLS `enable row level security` without a table GRANT means PostgREST returns 0 rows even when policy would allow, depending on Supabase default grants. The  `Public can read active clinics` policy implies an intended `grant select on clinics to anon, authenticated` — verify in Dashboard → SQL Editor `has_table_privilege`. Same for `clinic_members`, `appointments`, etc — but Supabase project template usually pre-grants `select,insert,update,delete on all tables in schema public to authenticated` and `select` to `anon` where needed; repo should still declare it explicitly. The hardening migration revokes `all on audit_logs from anon` (`20260825:273`) but not the positive grants. |
| `audit_logs` | `20260825:273` `revoke all from anon`; `20260825:284` `grant select to authenticated` (via policy `user_is_clinic_admin` gate) | ✅ | Writes only via `SECURITY DEFINER audit_row_change` trigger (`20260825:292`) — no insert/update/delete policy for users |

### 3.4 `pg_cron` for reminders is set?

**Not set.** `filesystem_search_files` for `pg_cron`, `cron.schedule`, `remind`, `reminder`, `pg_cron` across `mediq-admin` and `MediQ` yields 0 hits. No `supabase/migrations/*` contains `cron`, `pg_cron`, or `supabase_cron`. No Edge Function under `supabase/functions/` exists in this repo. Expected hardening would include:

```sql
select cron.schedule('appointment-reminders', '0 8 * * *', $$ select public.send_appointment_reminders(); $$);
-- or pg_cron job calling the notify_* triggers / Edge Function
```

Absent — appointment reminders, `no_show` sweeps, and delayed `rejection_reason` cleanups must be manual.

---

## 4. Broken Bonds — `file:line` severity

> `Critical` = cross-tenant leak / bricked user / RLS bypass · `High` = invisible data / unlinked identity / privilege gap · `Medium` = duplicate round-trip / stale UX / missing guard · `Low` = lint / token drift · `Info` = intentional placeholder

| # | File:Line | Severity | Bond | Detail |
|---|-----------|----------|------|--------|
| **BB-01** | `src/data/supabase/repos.ts:371` `insert({name,specialization,email,status,clinic_id})` + `src/features/staff/components/staff-dialog.tsx:161` same | **High** | `doctors.user_id` never set on create | `20260825:61` added `doctors.user_id uuid references profiles(id)` + `20260825:65` backfill via `lower(email)`, but `doctorsRepository.create` never writes `user_id`. New directory rows stay `NULL`; `user_is_this_doctor` falls back to `d.email = auth.users.email` (`20260825:219`). Email change or case drift breaks queue scoping (`queue_entries` `doctor_name in (select d.name … d.email=…)`) and dashboard `isDoctor && doctor` fails → falls to admin analytics (P-01 in `audit-patient-staff-doctor.md:98`). Fix: `insert({…, user_id: userId ?? null})` where `userId` is resolved via `auth.users` (Staff path already has `userId` at `staff-dialog.tsx:121`; Doctors standalone needs a `link_doctor_account` RPC or `maybeSingle` lookup). |
| **BB-02** | `src/data/supabase/repos.ts:424` `upsert({…}, {onConflict:'email'})` | **High** | `staff` upsert on `email` unsafe with partial / cross-tenant index | Task asks "Is `staff` upsert on `email` safe with partial index?" — no such partial index exists, and the correct tenancy index is `unique(clinic_id, lower(email))`. `onConflict:'email'` assumes global uniqueness; inviting `nurse@clinic.ng` in clinic B overwrites / conflicts with same email in clinic A, or spurious `23505`. `20260825:95` `delete from clinic_members a using b where clinic_id+user_id dup` creates `unique(clinic_id,user_id)` but not `staff`. Fix: `create unique index if not exists staff_clinic_email_uidx on staff(clinic_id, lower(email));` and `upsert({…}, {onConflict:'clinic_id,email'})` or `{onConflict:'clinic_id,lower_email'}` depending on generated column. |
| **BB-03** | `src/features/staff/components/staff-dialog.tsx:121` `if (!authError) userId=authData.user.id else { // skip }` + `staff-dialog.tsx:140` `if (userId && clinicId) insert clinic_members` | **High** | Existing-user invite loses `clinic_members` | When `authError message includes 'already been registered'`, `userId` stays `null` and the `clinic_members` insert is skipped with a `// existing user can be linked manually` comment. The user is then directory-visible but has **no membership** — `ClinicProvider` (`clinic-context.tsx:87` `from('clinic_members').select… eq user_id`) finds 0 rows → `error='No clinic assigned'` → app bricked. `20260825:1174` `link_clinic_member(p_clinic_id,p_email,p_role)` was added explicitly to fix this ("The invite dialog could only link brand-new accounts… bricked at sign-in" `20260825:1170`). Dialog should call `await supabase.rpc('link_clinic_member', {p_clinic_id:clinicId,p_email:values.email,p_role:memberRole})` on the `already registered` branch. |
| **BB-04** | `src/data/supabase/repos.ts:389` `from('doctors').update({status}).eq('id',id)` · `repos.ts:398` `delete().eq('id',id)` · `repos.ts:443` `from('staff').delete().eq('id',id)` · `repos.ts:515` `from('rooms').update({status}).eq('id',id)` · `repos.ts:207` `from('appointments').update({status:'booked'/'rejected'}).eq('id',id)` | **Medium** | Mutations without `clinic_id` predicate | Relies solely on RLS `user_is_clinic_admin` / `user_in_clinic`. Not an RLS bypass (RLS still blocks cross-tenant), but violates defense-in-depth: a future `is_admin()` regression would leak. The appointments / queue `updateStatus` that *do* pass `clinicId` (`repos.ts:196` `.eq('clinic_id',clinicId)`) are the correct pattern — apply it everywhere: `.eq('clinic_id', clinicId)` with `if (!clinicId) throw`. |
| **BB-05** | `src/data/supabase/repos.ts:690` `supabase.from('patients').insert({name,phone,email,visits:0})` **no `clinic_id`** + `repos.ts:642` booking fallback `...(validClinicId?{clinic_id}:{})` | **High** | Invisible `clinic_id IS NULL` rows | `authRepository.signUp` (`repos.ts:660`) inserts a patient directory row without `clinic_id`. RLS `Users can create their own patient record with check (clinic_id is null)` (`20260825:745`) allows the insert, but clinic staff's `patients_select_clinic using (user_in_clinic(clinic_id))` never returns `null` rows — patient is orphaned from the clinic's directory until `book_appointment` claims it via `where lower(email)=lower(p_email)` + `set clinic_id=v_clinic_id` (`20260825:1059`). `bookingRepository.book` fallback at `repos.ts:618` also allows `clinic_id: null` for anon bookings to survive RLS. Dashboard queues/analytics `where clinic_id = X` miss these rows. Fix: pass `clinicId` through sign-up (or drop the insert and rely solely on booking-created patient, as `20260820:606` `patients_insert` originally did via RPC). |
| **BB-06** | `supabase/migrations/20260825_notifications_audit_hardening.sql:802` `queue_entries_select_clinic` **no patient branch** | **High** | Patient queue invisible | Policy is `user_in_clinic && (not doctor-membership OR doctor_name in …)` — no `user_is_this_patient` / `appointment_id IN (select id … where lower(patient_email)=…)` branch. `hooks.ts:478` `useQueue` patient branch tries clinic-less `from('queue_entries').select('*,rooms').limit(50)` at `:492`, but `user_in_clinic(null)` is false → 0 rows. Comment at `hooks.ts:490` "Queue RLS has no patient branch yet — primary fallback is appointment status" acknowledges. The migration spec `20260829000000_fix_patient_queue_and_insert.sql` was expected to add `create policy "Patients can read own queue" …` but file does not exist. |
| **BB-07** | `src/config/rbac.ts:13` `ROLES=['admin','front_desk','doctor','patient']` (no `platform_admin`) + `src/config/rbac.ts:46` no `platform_admin` entry | **Critical** | Platform owner role absent — every `platform_admin` check denies | Task requires `platform_admin = all perms`. Today `can(['platform_admin'], 'any')` → `rolePermissions['platform_admin'] ?? []` → `false` (`rbac.ts:82`). A platform owner cannot open any admin route (`requiredPermissionFor` maps `/admin/*` to `*:view` which `platform_admin` lacks) and no `routePermissions['/platform/*']` exists. Add `platform_admin` to `ROLES` and `rolePermissions` with `PERMISSIONS` (or `platform:*`), and route `beforeLoad` needs `is_platform_admin()` guard (separate from `user_in_clinic`). |
| **BB-08** | **Missing files** `src/data/platform-hooks.ts` + `src/routes/_platform/*` + `supabase/migrations/20260828000000_platform_users_with_email.sql` | **Critical** | Platform UI + RPCs absent | `filesystem_search_files platform` → 0 hits. No `usePlatformStats/Clinics/Users`, no `get_platform_users()` (`select p.*, u.email from profiles p join auth.users u on u.id=p.id where is_platform_admin()`), no `is_platform_admin()` SECURITY DEFINER helper, no promotion UI (`UPDATE profiles SET role='platform_admin' WHERE id=…` via RPC). Any `Link to='/platform/*'` 404s (`routeTree.gen.ts:241` has no `/platform` entries). |
| **BB-09** | `src/features/dashboard/index.tsx:297` `isDoctor && doctor ? <DoctorToday> : <AdminDashboard>` | **High** | Unlinked doctor sees whole-clinic analytics | When `doctor` unresolved (`doctors.find` email mismatch, case drift, invite-before-signup), ternary falls to admin branch showing `AnalyticsCards`, `Trend`, `Donut`, `Utilization`, `waitingCount/served/activeDoctors` for entire clinic — violates `dashboard/index.tsx:88` "Doctor view is scoped to their own work". Prior bounty P-01 (`audit-patient-staff-doctor.md:98`). Fix: `if (isDoctor) return doctor ? <DoctorToday/> : <UnlinkedDoctorState ask admin to relink via link_clinic_member + doctor user_id>` |
| **BB-10** | `src/lib/clinic-context.tsx:55` `if (isLoading) return {clinicId:null,isReady:false}` + `src/data/hooks.ts:170` `enabled: isPatient ? !!email : !!clinicId` | **Medium** | Flash of 0-state while `ClinicProvider` resolves `clinic_members` | Hooks are `enabled:false` while loading, so `isPending=false`; `dashboard/index.tsx:295` `isPending ? <Skeleton> : …` renders 0 appointments / 0 queue instead of `DashboardSkeleton`. Same for queue/rooms/doctors/staff/analytics. `AuthenticatedLayoutInner` (`authenticated-layout.tsx:58` `if (error) return null`) does not gate on `isLoading`. Fix: `const {isLoading} = useClinicContext(); if (isLoading) return <DashboardSkeleton/>` or `enabled = isReady` with distinct `isLoading` flag. |
| **BB-11** | `supabase/migrations/20260820_multi_tenancy.sql` policies **not idempotent** | **Medium** | Re-apply fails with `duplicate_object` | Migration creates `clinics`/`clinic_members` with `if not exists` (safe) but every `create policy "Public can read active clinics"` at `:44` and tenant rewrites at `:360` lack `drop policy if exists` / `if not exists` guard — second apply throws `policy "…" for relation "…" already exists`. `20260825:619` fixes this by looping `pg_policies` and dropping before recreate — `20260820` should be superseded or made rerunnable via `drop policy if exists` preambles. Backfill is idempotent via `on conflict do nothing` + `where clinic_id is null`. |
| **BB-12** | `src/data/supabase/repos.ts:618` `...(validClinicId?{clinic_id}:{})` else omit + `20260820:132` / `20260825:80` nullable column | **Medium** | `clinic_id` omission lands invisible `NULL` | When `validClinicId` fails `isUuid` (`repos.ts:591` `isUuid` guard), booking falls through to `insert({…, …validClinicId?{clinic_id}:{} })` with no `clinic_id`; row lands `NULL` and RLS `eq('clinic_id',clinicId)` never returns it. `book_appointment` RPC (`20260825:582` `v_clinic_id := p_clinic_id; if null then select default`) is the correct fallback — direct `from('appointments').insert` should not exist except as last-resort `fallbackApt` in memory (`repos.ts:636`). Remove the direct insert fallback and rely on RPC only. |
| **BB-13** | `src/data/supabase/repos.ts:745` `Users can create their own patient record with check (clinic_id is null)` is **the only patient insert path** but `bookingRepository.book` also does `patients upsert` via RPC | **Low** | Dual patient-creation races | Sign-up insert (`repos.ts:690`) and `book_appointment` upsert (`20260825:1059` `update patients where lower(email)=…` else `insert … catch unique_violation`) can race on same email. The `unique_violation` catch at `20260825:1069` handles it, but the client-side `if (patientErr && !msg.includes('duplicate'))` at `repos.ts:697` surfaces duplicate as silent success — correct but fragile (string match not `23505`). |
| **BB-14** | `supabase/migrations/*` — no `pg_cron` / no `NOT NULL` alter after backfill | **Medium** | Reminders + invariants not enforced | See DB §3.1 and §3.4 — `pg_cron` absent means no nightly `no_show` sweep, no `appointment_reminders` (should be `cron.schedule('reminders','0 */6 * * *', 'select notify_upcoming()')`). `clinic_id` staying nullable is a standing invariant violation. |
| **BB-15** | `src/lib/clinic-context.tsx:87` `supabase.from('clinic_members').select('clinic_id,role,clinics(id,name,slug,plan)').eq('user_id',authUser.id)` — selects `plan` without `status` | **Low** | Suspended clinic still shows plan | Clinic `status='suspended'` is not surfaced to `ClinicMembership`; UI cannot block booking. `20260825:640` clinics select policy does `status='active' or user_in_clinic(id)` so members still see own suspended clinic — correct, but admin pages don't show a suspension banner because `plan` is fetched without `status`. |

---

## 5. Design Violations

| # | File:Line | Principle | Violation | Fix |
|---|-----------|-----------|-----------|-----|
| **D-01** | `src/config/rbac.ts:1` vs `supabase/migrations/20260825:881` | Backend is source of truth | RBAC hides `rooms/doctors/staff` from `front_desk`/`doctor` via `routePermissions` + `keepItem` (`app-sidebar.tsx:131`), but RLS for `rooms` insert/update is `user_in_clinic` (any member) and queue update is `user_in_clinic` — API bypass succeeds despite UI hidden. `rbac.ts:63` even documents "doctor *could* bypass … time to tighten RLS". Spec `src/types/domain.ts:7` says backend MUST enforce same rules — hardening migration left queue/rooms permissive. | Change `queue_entries_update` to `using (user_in_clinic AND role IN ('admin','front_desk'))` via `exists(select 1 from clinic_members where user_id=auth.uid() and clinic_id=queue_entries.clinic_id and role in ('admin','front_desk'))` OR add `user_is_clinic_admin` + `front_desk` helper. Same for `rooms_insert/update`. |
| **D-02** | `src/data/hooks.ts:37` `useDoctorIdentity` + `dashboard/index.tsx:93` + `hooks.ts:478` | Single source of truth (`src/data/index.ts:1` repos) | Doctor identity is resolved 3× differently: `dashboard/index.tsx:95` `doctors.find(email===user.email)`, `hooks.ts:42` same, `user_is_this_doctor` in DB uses `user_id OR email`. Client scoping for patients (`hooks.ts:584` `appointments → patient email|name` set) reimplements RLS in JS. Should be `SELECT … WHERE user_is_this_doctor(clinic_id,doctor_id)` in the DB, not `all.filter(name.includes)`. | Push doctor scoping into `appointments`/`patients`/`queue` SELECT policies (already there) and remove client `filter` — or expose `list_doctor_patients()` RPC with `security definer` and `is_doctor` check. |
| **D-03** | `src/features/dashboard/index.tsx:93` vs `doctor-today.tsx:22` vs `analytics-helpers.ts:15` | Consistent date semantics | Dashboard uses `startOfDay/endOfDay/subDays/isSameDay` (`dashboard/index.tsx:3` `date-fns`), `DoctorToday` uses bare `new Date(); setHours(0,0,0,0)` inline (`doctor-today.tsx:23`), `today` analytics uses yet another `new Date()` per row (`repos.ts:710`). Inconsistent DST handling. | Centralize on `date-fns startOfDay/endOfDay/isSameDay` and memoize bounds (Dashboard already does `useMemo bounds`). |
| **D-04** | `src/hooks/use-realtime-sync.ts:47` (mounted at `src/routes/__root.tsx:20`) vs `src/data/hooks.ts:764` `useRealtimeTable` | Clinic isolation contract (`src/lib/clinic-context.tsx:5` "every repo and hook reads current clinic from `useCurrentClinic()` — never from props/URL") | `useRealtimeSync` creates a single `channel('mediq-realtime-sync').on('postgres_changes',{event:'*',schema:'public',table}, … invalidateQueries([key]))` **with no `filter`** — every `queue_entries` insert in clinic B busts clinic A's `['queue']` cache (extra fetch, no leak due to RLS but cadence leaks + waste). `useRealtimeTable` builds `and(clinic_id=eq…,doctor_name=eq…)` which Supabase docs say is a **single `filter: 'col=eq.val'` only** — `and()` syntax is undocumented/version-dependent and may silently receive all rows. | Either `supabase.channel(`rt:${clinicId}`).on('postgres_changes',{filter:`clinic_id=eq.${clinicId}`},…)` if supported, or filter in callback: `if (payload.new.clinic_id !== clinicId) return; invalidateQueries`. Also gate `useRealtimeSync` on `clinicId` and call `supabase.removeChannel` on cleanup with `clinicId` change. |
| **D-05** | `src/features/staff/components/staff-dialog.tsx:31` `staffRoles=['front_desk','admin','doctor']` vs `src/config/rbac.ts:13` `ROLES` same plus `patient` | Role vocabulary parity | Two role enums exist: `staffRoles` (directory role) and `ROLES`/`roleLabels` (auth role). They overlap but diverge — `patient` exists in `ROLES` but not `staffRoles` (correct), but `platform_admin` would need to be added in both places plus `clinic_members.role check`. Hard-coded `role` strings in `staff-dialog.tsx:141` `memberRole = role==='doctor'?'doctor':role==='admin'?'admin':'front_desk'` duplicates `column_type_of` casting logic. | Single `ROLE` union in `src/config/rbac.ts` imported by `staff/schema.ts`; add `platform_admin` there once. |
| **D-06** | `src/data/hooks.ts:541` `useQueueActions.callNext` `mutationFn: () => queueRepository.callNext(isDoctor?doctor?.name:undefined, clinicId)` + `src/data/supabase/repos.ts:254` `rpc('call_next_in_queue', {p_clinic_id: clinicId ?? null})` | `enabled` / `isReady` contract | `callNext` can be invoked while `clinicId===null` (loading) — RPC then falls back to `current_user_clinic_id()` (`20260825:1143`) so it works by accident, while `useUpdateAppointmentStatus` (`hooks.ts:227` `if (!clinicId) throw Missing clinic context`) would throw in same state. Inconsistent `isReady` handling across mutations. | Guard every mutator with `if (!clinicId) throw new Error('Missing clinic context')` or disable `Button disabled={!clinicId \|\| …}` (`queue/index.tsx:118` already `disabled={waiting.length===0 \|\| callNext.isPending}` — add `|| !clinicId`). |
| **D-07** | `src/features/landing` vs public booking (`pricing-section.tsx:87` uses `TimelineAnimation`) | Design tokens | Not admin/platform, but the public booking → admin transition is the trust boundary: `usePublicClinics` → `book_appointment(p_clinic_id)` → `audit_logs` → `notify_staff`. The admin's `AnalyticsCards` (`analytics-cards.tsx:34`) still renders `--` for `avgWaitMinutes null` (no queue called) without explaining filter — minor but the drill-down `DoctorUtilizationChart` sorts by `completed` count which can be gamed by marking `in_progress→completed` via the permissive queue RLS (D-01). | Already covered by D-01 + add `avgWaitMinutes` tooltip "no called entries in range". |

---

## 6. What to fix first (in order)

1. **DB invariant:** add `alter table … alter column clinic_id set not null` for every table that backfilled (except `patients` partial-null and `audit_logs`). Re-run `supabase/migrations/20260820_multi_tenancy.sql` idempotency guard first.
2. **Doctors identity:** patch `src/data/supabase/repos.ts:371` to `insert({…, user_id: userId})` where `userId` is resolved (Staff path has it; Doctors direct add should call `link_clinic_member` then `update doctors set user_id=… where email=…`). Add `create unique index doctors_clinic_email_uidx on doctors(clinic_id, lower(email))`.
3. **Staff tenancy:** `create unique index staff_clinic_email_uidx on staff(clinic_id, lower(email))` then `repos.ts:424` `upsert(…, {onConflict:'clinic_id,lower_email'})` (or composite). Fix `staff-dialog.tsx:121` existing-user branch to `await supabase.rpc('link_clinic_member', {p_clinic_id:clinicId,p_email:values.email,p_role:memberRole})` and toast error if `memberErr`.
4. **Patient queue RLS + patient insert:** add policy `create policy "Patients can read own queue" on queue_entries for select using (appointment_id in (select id from appointments where lower(patient_email)=lower((select email from auth.users where id=auth.uid()))))`; either drop the `patients` null-insert or thread `clinicId` into sign-up (`repos.ts:690` should be `insert({…, clinic_id: pendingClinicId})` or removed).
5. **Platform surface:** add `platform_admin` to `ROLES` + `rolePermissions` (`rbac.ts:46`), `create function is_platform_admin() returns boolean … role='platform_admin'`, policies `Platform can read all clinics/clinic_members/profiles` using it, `create function get_platform_users()` SECURITY DEFINER joining `profiles` + `auth.users`, `src/data/platform-hooks.ts` with `usePlatformStats/Clinics/Users` guarded by `hasRole('platform_admin')`, and `src/routes/_platform/*` guarded by `beforeLoad: if (!is_platform_admin()) throw redirect('/403')`.
6. **PG cron + UI polish:** add `pg_cron` job for `appointment_reminders` / `no_show` sweep, fix `dashboard/index.tsx:297` unlinked-doctor fallback, gate `ClinicProvider isLoading` skeletons, and tighten `rooms`/`queue` RLS to admin+front_desk only per D-01.

---

*Verified via Serena + direct reads · 3 migrations + 12 feature/route/data files · All `file:line` in 1-indexed canonical `mediq-admin/src/...` and `mediq-admin/supabase/migrations/...` at HEAD.*
