# MediQ Patient Dashboard — Frontend Audit

**Date:** 2026-08-28 — verified at current workspace (commit `d43368c` + uncommitted changes)
**Scope:** `src/features/patient/index.tsx`, `src/features/patient/components/getting-started-checklist.tsx`, `src/data/hooks.ts` (`useAppointments`, `useQueue`, `useDoctors`, `useCancelAppointment`), `src/lib/clinic-context.tsx`, `src/stores/auth-store.ts`, `src/routes/patient.tsx` (plus `src/routes/_authenticated/route.tsx`, `src/hooks/use-realtime-sync.ts`, `src/data/supabase/repos.ts`, `supabase/migrations/*` for cross-check)
**Method:** Full file reads, Serena symbol inspection, manual line-by-line trace. Every issue cites `file:line`, severity, and fix.

---

## 1. Executive Summary

Patient portal renders `ClinicProvider`-less, so `useCurrentClinic()` always returns `clinicId=null`. `useAppointments`/`useQueue` are `enabled: !!clinicId` and `appointmentsRepository.list(null)` is fail-closed `[]`. Supabase RLS since `20260828100000_fix_patient_appointments_rls.sql` *explicitly allows* `lower(patient_email)=lower(jwt.email)` **without** `user_in_clinic`, so backend and frontend now contradict: patients see infinite skeletons or `No upcoming` while `localStorage` fakes `hasAppointment` to hide the bug. Route guard is client-side `useEffect` (flash), cancel has no optimistic update, no error UI exists, and realtime is only the global `useRealtimeSync` (no per-patient channel). Checklist derives state from `localStorage` synchronously in render, mixes email+name matching inconsistently with portal, and has duplicate `id` + hydration risks.

**Counts:** 8 Critical, 9 Important, 7 Minor — 24 findings.

---

## 2. Component Structure — `PatientPortal` Loading / Error / Empty

### C1 — Critical — Patient portal never fetches when `clinicId` is null (always pending)

*Files:* `src/features/patient/index.tsx:42-44` → `src/data/hooks.ts:50-56`, `298-317`, `394-402` · `src/lib/clinic-context.tsx:49-57` · `src/routes/patient.tsx:1-6` · `src/components/layout/authenticated-layout.tsx:41` · `src/data/supabase/repos.ts:133`, `234`, `334`

`PatientRoute` (`src/routes/patient.tsx:4`) is a child of `__root.tsx`, **not** of `/_authenticated`. `ClinicProvider` only wraps `AuthenticatedLayout` (`src/components/layout/authenticated-layout.tsx:41`), so `/patient` has no provider. `useCurrentClinic()` (`clinic-context.tsx:49-57`) then returns the context default `{clinicId:null, isReady:false}` (initial `isLoading:true` → `clinicId:null`). Every data hook is `enabled: !!clinicId` (`hooks.ts:55`, `303`, `400`) and the repo fail-closes `if(!clinicId) return []` (`repos.ts:136`, `237`, `335`). Result:

* `appointmentsQuery.isPending` stays `true` forever (no fetch), the `appointmentsQuery.isPending ? <Skeleton> : <Upcoming>` branch at `index.tsx:210` shows 3 skeletons forever **or**, after the fix-migration, if a future change enables the query without `clinicId`, the repo returns `[]` and the UI shows `No upcoming appointments. Book one below.` (`index.tsx:224-229`) even though RLS would have returned rows.

Contradicts `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql:8-20` which intentionally removed `user_in_clinic` for `lower(patient_email)=...`.

**Suggested fix:** Either (a) wrap `/patient` in `ClinicProvider` but make it tolerant of `no clinic_members row` (patients have none), or (b) add a patient-specific hook that queries **without** `clinicId` and relies on RLS email match, e.g.:

```ts
// hooks.ts
export function usePatientAppointments() {
  const { clinicId } = useCurrentClinic();
  const user = useAuthStore(s=>s.auth.user);
  // enable even without clinicId for patient role
  return useQuery({
    queryKey: ['appointments', 'patient', user?.email, clinicId ?? 'none'],
    queryFn: () => supabase.from('appointments').select('*').ilike('patient_email', user!.email).then(...)
    // or call appointmentsRepository.list(clinicId ?? undefined) but make repo NOT fail-closed for patient email case
    enabled: !!user?.email
  })
}
```

At minimum guard `index.tsx:210` with `isPending && clinicId` and show empty only after `isSuccess`.

---

### C2 — Critical — No error UI; failures masquerade as empty

*Files:* `src/features/patient/index.tsx:210-359` · `src/features/patient/components/getting-started-checklist.tsx:44-136`

None of `appointmentsQuery`, `queueQuery`, `doctorsQuery` checks `isError`/`error`. If `supabase.from(...).select` throws (RLS, network, expired JWT), `myAppointments` is `[]`, UI shows `No upcoming appointments` and checklist shows `0 of 4 done`. Operators will mis-diagnose as "no data" not "fetch failed".

**Fix:** Add an error branch *before* pending:

```tsx
if (appointmentsQuery.isError || queueQuery.isError) return <Card><CardContent className="py-10 text-center text-destructive">Failed to load appointments. {appointmentsQuery.error?.message} <Button variant="outline" onClick={()=>{appointmentsQuery.refetch(); queueQuery.refetch();}}>Retry</Button></CardContent></Card>
```

Show per-query banners (appointment error vs queue error).

---

### I1 — Important — Queue and Doctors loading ignored; partial Skeleton only

*Files:* `src/features/patient/index.tsx:210-215`, `42-44`, `103-106`, `232-233`

Only `appointmentsQuery.isPending` drives `<Skeleton>`. `queueQuery` and `doctorsQuery` may still be pending when `upcoming.map` runs. `getSpecialization()` at `index.tsx:103` returns `undefined` → no specialty shown initially, then pops in — layout shift. `queuePosition` at `94-101` is computed from `queueQuery.data ?? []` which is empty while loading → banner hidden briefly then flashes.

**Fix:** Co-ordinate loading:

```tsx
const isLoading = appointmentsQuery.isPending || queueQuery.isPending || doctorsQuery.isPending
if (isLoading) return <Skeletons />
```

Or at least gate queue banner with `!queueQuery.isPending`.

---

### I2 — Important — Duplicate DOM `id="patient-queue-banner"` + unreachable scroll

*Files:* `src/features/patient/index.tsx:162`, `188` · `src/features/patient/components/getting-started-checklist.tsx:215-216`, `249-251`

Two distinct divs share `id='patient-queue-banner'` (`index.tsx:162` waiting, `188` in_progress). `getElementById` (`getting-started-checklist.tsx:215`) is non-deterministic (first match). Duplicate IDs also fail a11y/HTML validation.

**Fix:** Use unique IDs (`patient-queue-waiting`, `patient-queue-inprogress`) and `document.querySelector('[data-testid=patient-queue-banner]')` or a React `ref` forwarded to `PatientPortal`.

---

### M1 — Minor — Timezone-naïve `isToday`

*Files:* `src/features/patient/index.tsx:84-87`

`isToday(new Date(a.scheduledFor))` uses client local zone while `scheduled_for` is stored as `timestamptz` and serialized as UTC ISO. Patient in UTC+1 booking 23:00 UTC appears as next day locally — `todayAppointment` mis-matched, banner hidden.

**Fix:** Normalize to clinic timezone (e.g., `Africa/Lagos` per `docs/research-offline-booking.md`) or compare `yyyy-MM-dd` strings after converting both to same zone with `date-fns-tz`.

---

## 3. Hooks — `useAppointments` / `useQueue` / `useDoctors`

### C3 — Critical — `useQueue` RLS denies patients; banner never appears via repo

*Files:* `src/data/hooks.ts:298-317` · `src/data/supabase/repos.ts:234-251` · `supabase/migrations/20260821000000_clinics.sql:367-371` · `supabase/migrations/20260828100000_fix_patient_appointments_rls.sql` (queue untouched)

`queue_entries_select_clinic` (`20260821000000_clinics.sql:367`) is:

```sql
USING (user_in_clinic(clinic_id) AND (is_admin OR has_role('front_desk') OR has_role('doctor')))
```

No `lower(patient_email)=...` branch. Patients have no `clinic_members` row → `user_in_clinic` false → `select` returns 0 rows always. `PatientPortal` then computes `waitingQueue=[]`, `queuePosition=-1`, hides banner. `GettingStartedChecklist.hasQueue` (`getting-started-checklist.tsx:122-136`) also always false unless `myAppointments` email hack matches — but the `.some(entry=>...)` will never iterate.

The patient-fix migration only patched `appointments`, not `queue_entries`.

**Fix (backend):** Add a queue RLS branch for patients mirroring appointments, or expose a patient-safe RPC/view:

```sql
CREATE POLICY queue_entries_select_patient
 ON queue_entries FOR SELECT USING (lower(patient_name)=lower(auth.jwt()->>'email') OR lower(appointment_id::text) IN (SELECT id::text FROM appointments WHERE lower(patient_email)=lower(auth.jwt()->>'email')))
```

Frontend fallback: derive queue position from appointments’ status alone (`arrived`/`in_progress`) if `queueQuery.data` empty, and surface "Ask front desk" rather than silent empty.

---

### I3 — Important — Client-side email filter is inconsistent across files

*Files:* `src/features/patient/index.tsx:60-62` vs `src/features/patient/components/getting-started-checklist.tsx:68-77`, `122-136`

- Portal: `a.patientEmail?.toLowerCase() === user.email?.toLowerCase()` — **email only**.
- Checklist: `emailMatch || nameMatch` where `nameMatch = a.patientName?.toLowerCase() === userName` and `userName = (user as any).name ?? user.email.split('@')[0]`.

Two problems: (1) Portal will hide a patient’s appointment if `patient_email` is null (walk-in converted) while checklist shows it — contradictory progress. (2) Name match is collision-prone (`"John"` matches any John) and derives `userName` from `user.name` (which `auth-store.ts:9-20` never stores) falling back to `email.split('@')[0]` (`getting-started-checklist.tsx:70`) — so `john.smith+mediq@example.com` yields `john.smith+mediq` not `"John Smith"`.

**Fix:** Standardize on email-only, case-insensitive, using `supabase.auth.getUser().email` via `useSupabaseAuthSync` as source of truth. Remove `nameMatch` or gate it behind `patientEmail == null && levenshtein` — but do it once and share via a `useMyAppointments()` hook.

---

### I4 — Important — Doctor queue filter trusts string `doctor_name` not `doctor_id`

*Files:* `src/data/hooks.ts:311-314`

```ts
return all.filter(e => e.doctorName === doctor.name)
```

`doctor` is matched by email (`hooks.ts:41-42` case-insensitive, good), but queue entries are matched by string `doctor_name` exact (`===`, case-sensitive). If a doctor was renamed, walk-ins have no `appointmentId`, and entries linger under old name → doctor’s queue goes empty.

**Fix:** Prefer `e.appointmentId` → lookup `appointment.doctorId === doctor.id` (as comment says), fallback to normalized lower compare.

---

### M2 — Minor — Query keys mix `'none'` sentinel with real clinicId; stale closure

*Files:* `src/data/hooks.ts:53`, `302`, `398`, `542-576`

`queryKey: ['appointments', clinicId ?? 'none']` plus `useRealtimeTable`'s `queryKey.join('/')` (`hooks.ts:576`). When `clinicId` resolves from `null → uuid` after `ClinicProvider.fetchMemberships`, React Query correctly refetches due to key change, but `useRealtimeTable`'s effect deps `combinedFilter` will close over stale `clinicId` until next render — a one-render window where realtime filter is `clinic_id=eq.none`. Low severity but adds noise.

**Fix:** Use conditional key `clinicId ? ['appointments', clinicId] : ['appointments','none']` and memoize `combinedFilter` with `clinicId`.

---

### M3 — Minor — `useDoctors` second query not scoped by appointment status pessimistically

*Files:* `src/data/supabase/repos.ts:351-357`

`.not('status','in','("cancelled","rejected")')` keeps `pending` in today counts — admin sees inflated `todayAppointments`. Not patient-impacting but mentioned for completeness.

---

## 4. State — `GettingStartedChecklist` Derivation vs `localStorage`

### C4 — Critical — `hasProfile` initialized `true`, so checklist flashes "done" before fetch

*Files:* `src/features/patient/components/getting-started-checklist.tsx:49-65`

```ts
const [hasProfile, setHasProfile] = useState(true)
```

Initial `true` makes `doneCount` 1 higher for ~200ms until `supabase.from('profiles').select('full_name')` resolves. Combined with `isDone` per task, progress bar goes `75% → 50%` flicker. `setHasProfile(true)` on error (line 59) also masks a real missing profile.

**Fix:** `useState<boolean | null>(null)` or `useState(false)` and guard rendering with `hasProfile !== null ? ... : <Skeleton>`. Or better, derive from `useQuery(['profile', user.accountNo], ...)` so loading/error are first-class.

---

### C5 — Critical — `hasLocalBookingFlag` reads `localStorage` in render, SSR/hydration & race

*Files:* `src/features/patient/components/getting-started-checklist.tsx:78-117`

The entire IIFE (`(() => { try { localStorage.getItem(...) } ... })()`) runs **during render**. In SSR (Vite prerender, tests, or if component is ever server-rendered) `localStorage` is undefined → throws, swallowed, returns `false`. In concurrent mode, render should be pure. The flag is also not reactive: booking via `src/features/booking/index.tsx:171-200` sets keys **after** mutate success, but checklist on `/patient` (already mounted) will not re-read until next render caused by unrelated state.

Additionally global key `mediq_has_booked` (`booking/index.tsx:180`) is shared across clinics and users on same device — user B on same browser inherits user A’s flag until 7-day TTL expires (`getting-started-checklist.tsx:81,89,99,109`). `clinicId` may be `null` (see C1), so `if(!clinicId) return false` at `80` discards the legacy global key, but portal still filters `appointments` by email empty → checklist says “not booked” while banner says `hasLocalBookingFlag`.

**Fix:** Move to `useState`/`useEffect` + `storage` event:

```ts
const [hasLocalFlag, setHasLocalFlag] = useState(false);
useEffect(() => {
  if(!clinicId||!userEmail) return;
  const flag = computeFlag(clinicId, userEmail);
  setHasLocalFlag(flag);
  const h = (e: StorageEvent)=> e.key?.startsWith('mediq_has_booked') && setHasLocalFlag(compute...);
  window.addEventListener('storage', h); return ()=>removeEventListener('storage',h);
}, [clinicId, userEmail]);
```

Or drop `localStorage` entirely now that `hasAppointment` is reliably `myAppointments.length>0` after RLS fix — localStorage was a workaround for the very bug fixed in `20260828100000`.

---

### I5 — Important — `hasQueue` / `myAppointments` derived before queries settle → flicker

*Files:* `src/features/patient/components/getting-started-checklist.tsx:72-77`, `122-136`, `156-159`

`allAppointments = appointmentsQuery.data ?? []` is `[]` while `isPending` → `myAppointments=[]` → `hasAppointment=false`, `hasQueue=false`. `doneCount` momentarily 1 (only `hasPassword`), then jumps to 2-4 when data arrives. No `isLoading` gate.

**Fix:** Coalesce loading:

```ts
if (appointmentsQuery.isPending || queueQuery.isPending) return <Skeleton />
const myAppointments = useMemo(()=>..., [allAppointments,userEmail,userName])
```

---

### I6 — Important — `hasQueue` logic is over-permissive and diverges from portal `queuePosition`

*Files:* `src/features/patient/components/getting-started-checklist.tsx:122-136` vs `src/features/patient/index.tsx:90-101`

Checklist `hasQueue` returns true if:
* `entry.status==='waiting'` (any waiting entry with matching name) — OK,
* OR (`linked` appointment status `arrived/in_progress/waiting`) — but `linked` is found via `myAppointments.find(a=>a.id===entry.appointmentId)` where `myAppointments` may be empty (loading) → false negative,
* OR `entry.status` `arrived/in_progress/waiting` (type-cast `as string`) — matches `called`? Not `called` but portal’s `waitingQueue` filters only `waiting` (`index.tsx:91`). So checklist may say "queue done" while portal still shows `No upcoming` / no banner.

**Fix:** Unify into one helper `isUserInQueue(entry, myAppointments, userEmail)` shared by both components, covering `waiting|called|in_room` → map to `queue_entries` statuses `waiting|called|in_room` (`queue/schema.ts:3-10`). Document the mapping.

---

### I7 — Important — Missing dependency / stale fetch if `user` object identity jitters

*Files:* `src/features/patient/components/getting-started-checklist.tsx:50-65` · `src/features/patient/index.tsx:48-56`

`useEffect` deps are `[user?.accountNo, user?.email]` — correct primitive deps, but inside `then` closure it reads `user?.email` at resolve time (line 63: `!!user?.email`). If `user` flipped from Alice to Bob between request and response, stale Alice response writes `setHasProfile` for Bob. No abort.

**Fix:** Capture `const emailAtFetch = user?.email` before fetch and compare on resolution, or use `AbortController` / `useQuery`.

---

### M4 — Minor — `useState` that should be derived: `hasProfile`, `hasLocalBookingFlag`, `hasPassword`

*Files:* `src/features/patient/components/getting-started-checklist.tsx:49`, `78`, `139`, `141-159`

`hasProfile` (fetch), `hasLocalBookingFlag` (localStorage), `hasPassword` (`!!user` — always true when rendered) and `isDone` (pure switch) are stored/derived via `useState` or manual `isDone` calls. `TASKS.filter(t=>isDone(t.id)).length` at `157` recomputes on every render, iterating 4 items (cheap but unmemoized).

**Fix:** Replace `hasProfile` with `useQuery`, replace `hasLocalBookingFlag` with `useMemo`+`useEffect` as above, inline `hasPassword = !!user`. Memoize `doneCount = useMemo(()=>TASKS.filter(...).length, [hasProfile, hasAppointment, hasQueue, hasPassword])`.

---

## 5. Routes — `/patient` Guard

### C6 — Critical — Guard is post-render `useEffect`, so unauthorized roles flash the portal

*Files:* `src/routes/patient.tsx:1-6` · `src/features/patient/index.tsx:48-58` · `src/routes/_authenticated/route.tsx:1-34` · `src/routes/__root.tsx:19-20`

`Route:4` has **no** `beforeLoad`. Guard lives in `PatientPortal:48-56`:

```ts
useEffect(()=>{ if(!user) navigate({to:'/sign-in'}); if(!hasRole(user.role,'patient')) navigate({to:'/'}) }, [user, navigate])
if(!user) return null
```

* Flash: Doctor/front_desk/admin see `<header>` + `GettingStartedChecklist` + skeletons for one frame before the effect fires.
* No `replace` semantic after first render → browser history polluted (back button returns to `/patient` → redirects again).
* No handling for expired session (`user.exp < Date.now()` as in `_authenticated:11`). `useSupabaseAuthSync` (`src/hooks/use-supabase-auth-sync.ts:14-45`) restores `user` async via `getUser()`; initial `user` is `null` from cookie parse (`auth-store.ts:64`) for ~100ms → effect eagerly `navigate('/sign-in')` even though a session exists, causing redirect loop on reload.

`_authenticated/route.tsx:22-24` correctly blocks `patient` from `/admin/*` with `throw redirect({to:'/patient'})`, but there is no inverse `beforeLoad` for `/patient` blocking `admin|front_desk|doctor`. The latter case falls through to `'/'` (public landing), not to `403` or `/admin/dashboard`.

**Fix:** Move guard to `createFileRoute('/patient', { beforeLoad: ... })`:

```ts
export const Route = createFileRoute('/patient')({
  beforeLoad: ({location})=>{
    const user = useAuthStore.getState().auth.user;
    if(!user || user.exp < Date.now()) throw redirect({to:'/sign-in', search:{redirect:location.href}});
    if(!hasRole(user.role,'patient')) {
      if(hasRole(user.role,'admin')||hasRole(user.role,'front_desk')||hasRole(user.role,'doctor'))
        throw redirect({to:'/admin/dashboard'});
      throw redirect({to:'/403'});
    }
  },
  component: PatientPortal
})
```

Keep the in-component skeleton fallback for the brief `useSupabaseAuthSync` loading window instead of immediate null.

---

### I8 — Important — `/patient` outside `ClinicProvider` → clinic switch not reflected

*Files:* `src/lib/clinic-context.tsx:194-208` · `src/routes/patient.tsx:1-6`

Since `/patient` is not under `AuthenticatedLayout`, `switchClinic()` (`clinic-context.tsx:194`) and `useCurrentClinic()` are no-ops. If a platform admin tests `/patient` with multiple clinics, the `clinicId` mismatch between `localStorage` keys (`mediq_has_booked:${clinicId}`) and displayed data is invisible.

**Fix:** As with C1, wrap `/patient` with `ClinicProvider` (or make `ClinicProvider` wrap the root route) but skip the "No clinic assigned" error for `patient` role.

---

## 6. Forms — Cancel Appointment

### C7 — Critical — No optimistic update; GLOBAL pending lock; naive `confirm()` not accessible

*Files:* `src/features/patient/index.tsx:108-118` · `src/data/hooks.ts:212-225` · `src/features/appointments/schema.ts:54`

```ts
function handleCancel(id:string){
  if(!myAppointments.some(a=>a.id===id)) toast.error(...);
  if(confirm('Are you sure...?')) cancelAppointment.mutate(id, {onSuccess: toast...})
}
```

* `useCancelAppointment` (`hooks.ts:212-225`) has no `onMutate`/`onError` rollback — unlike `useUpdateAppointmentStatus` (`113-131`), `useApproveAppointment` (`146-173`) which optimistically patch `['appointments', clinicId]`. Cancel waits full round-trip (~300ms) → UI feels stuck.
* `disabled={cancelAppointment.isPending}` (`index.tsx:284`) locks **all** Cancel buttons when **any** cancel is pending (global `isPending`). Patient with 2 upcoming cannot cancel the second while first pending.
* `confirm()` is blocking, not keyboard/a11y-compliant, and cannot be tested with Playwright without `page.on('dialog',...)`.
* `CANCELLABLE_STATUSES = ['pending','booked']` (`index.tsx:35`) diverges from domain `canCancel = ['booked','arrived']` (`schema.ts:54`). So `pending` (unapproved) shows Cancel but `arrived` (checked-in) does not, opposite of clinic workflow where `arrived` *can* be no-show/cancel.
* No guard for `clinicId` missing — `hooks.ts:217` throws `Missing clinic context` → `onError: toast.error('Failed to cancel appointment.')` masks the root cause.

**Fix:** Add optimistic update mirroring `useUpdateAppointmentStatus`:

```ts
onMutate: async (id)=>{
  const key=['appointments', clinicId ?? 'none']
  await queryClient.cancelQueries({queryKey:key})
  const prev=queryClient.getQueryData(key)
  queryClient.setQueryData(key, old=>old.map(a=>a.id===id?{...a,status:'cancelled'}:a))
  return {prev}
},
onError: (_e,_id,ctx)=> ctx?.prev && queryClient.setQueryData(key, ctx.prev),
onSuccess: ()=>{queryClient.invalidateQueries({queryKey:['appointments']}); queryClient.invalidateQueries({queryKey:['queue']});}
```

Track pending per-id: `const [pendingId,setPendingId]=useState<string|null>(null)` → `disabled={pendingId===appointment.id}`. Replace `confirm()` with `<AlertDialog>` and check `['booked','arrived','pending'].includes` consistently.

---

### M5 — Minor — Client-side `myAppointments.some` guard is spoofable

*Files:* `src/features/patient/index.tsx:109-111`

`if(!myAppointments.some(a=>a.id===id)) toast.error('You can only cancel...')` is purely client-side; attacker can tamper `myAppointments` via devtools or call `supabase.from('appointments').update` directly. RLS `appointments_update_clinic` (`20260828100000`) now correctly enforces `lower(patient_email)=lower(jwt.email) AND status='cancelled'` server-side, so this check is cosmetic — but misleadingly implies security.

**Fix:** Remove client check or treat as UX only; leave RLS as source of truth and surface its `403` as "You can only cancel your own appointments."

---

## 7. Realtime — Missing Patient Subscriptions

### I9 — Important — Portal depends on global `useRealtimeSync`, not patient-scoped channel

*Files:* `src/hooks/use-realtime-sync.ts:43-72` · `src/routes/__root.tsx:20` · `src/data/hooks.ts:534-600`

* Global `useRealtimeSync` (`__root.tsx:20`) subscribes to `supabase.channel('mediq-realtime-sync')` with 8 tables, **no** `filter` (`use-realtime-sync.ts:50-57`). Every change in any clinic invalidates `['appointments']` and `['queue']` for every client — redundant refetches, but functional.

* Patient-specific helpers `useRealtimeAppointments` (`hooks.ts:591-594`) and `useRealtimeQueue` (`580-588`) exist but are **never called** from `PatientPortal` or `GettingStartedChecklist`. They *do* add `filter: clinic_id=eq.${clinicId}` (`useRealtimeTable:549`) which the global channel lacks.

Consequence: if global channel were ever disabled (e.g., feature-flagged), `/patient` would be stale. Cancellation by staff (status→`cancelled`/`booked→arrived`) and queue calls would not reflect until manual refresh. `protect_appointment_cancel` trigger timing makes this visible.

**Fix:** Call them explicitly:

```tsx
useRealtimeAppointments();
useRealtimeQueue(); // no doctorName for patient — want own queue only, so pass undefined and filter client-side, or add patient-specific filter
```

Or at minimum document that `PatientPortal` intentionally relies on the root sync and add a regression test that global channel is mounted.

---

### M6 — Minor — `useRealtimeTable` `queryKey.join('/')` in channel name is fragile

*Files:* `src/data/hooks.ts:541-576`

`channel('rt:${table}:${queryKey.join('/')}')` with `queryKey=['appointments',clinicId??'none']` creates channels like `rt:appointments:appointments/none`. Two hooks with same table but different `queryKey` create duplicate WebSocket subscriptions. No deduplication.

**Fix:** Use a stable channel name `rt:${table}:${clinicId}` and ensure cleanup `supabase.removeChannel` on unmount (already done at `573`).

---

## 8. React Correctness — `useEffect` / `useMemo` / `useState` Hooks

### C8 — Critical — `ClinicContext` `useEffect` missing `allClinics` dep → stale sentinel

*Files:* `src/lib/clinic-context.tsx:150-192`

```ts
useEffect(()=>{
  if(user?.clinicId && ...){
    const real = allClinics.find(c=>c.clinicId===user.clinicId) // reads allClinics
    setClinic(real ?? { clinicId:user.clinicId, ... clinicSlug:'', plan:'' })
    if(lastFetchedEmail.current===user.email && real?.clinicSlug) { setIsLoading(false) } else fetch...
  }
}, [user, fetchMemberships]) // <- missing allClinics
```

`allClinics` is read but not a dep. After `fetchMemberships` populates `allClinics`, a subsequent render with new `user` (e.g., after `setUser` with refreshed `clinicName`) may still see stale empty `allClinics` and set the empty sentinel `{clinicSlug:''}` again, causing a second unnecessary fetch.

**Fix:** Add `allClinics` to deps and guard with ref equality, or derive `real` via `useMemo`.

---

### I10 — Important — `hasProfile` effect lacks cancellation

*Files:* `src/features/patient/components/getting-started-checklist.tsx:50-65`

`.then(({data,error})=> setHasProfile(...))` will call `setState` on unmounted component if user navigates away before resolve (React warning) or if `user.accountNo` changes mid-flight and older response overwrites newer.

**Fix:**

```ts
useEffect(()=>{
  if(!user?.accountNo) return;
  let cancelled=false;
  supabase.from('profiles').select('full_name').eq('id',user.accountNo).single()
    .then(({data,error})=>{ if(cancelled) return; setHasProfile(...) })
  return ()=>{ cancelled=true }
}, [user?.accountNo, user?.email])
```

---

### M7 — Minor — Derived values should be `useMemo` (not recomputed every render)

*Files:* `src/features/patient/index.tsx:60-101`, `103-106` · `src/features/patient/components/getting-started-checklist.tsx:68-136`, `141-159`

`myAppointments`, `upcoming`, `past`, `todayAppointment`, `waitingQueue`, `queuePosition`, `getSpecialization` (actually a function inside component — new closure each render), `hasAppointment`, `hasQueue`, `doneCount`, `pct` are all recomputed every render. With 50 appointments, sorting `.sort((a,b)=> ...)` twice per render is cheap but pointless; moreover if a child is memoized it will re-render needlessly.

**Fix:** Wrap in `useMemo`:

```ts
const myAppointments = useMemo(()=> (appointmentsQuery.data??[]).filter(...), [appointmentsQuery.data, user.email])
const upcoming = useMemo(()=> myAppointments.filter(...).sort(...), [myAppointments])
// etc.
const getSpecialization = useCallback((appointment:Appointment)=> doctorsQuery.data?.find(...), [doctorsQuery.data])
```

---

## 9. Positive Notes (Keep)

* **Patient email filter** at `index.tsx:60-62` is case-insensitive — correct for `lower(patient_email)` RLS.
* **Appointment RLS fix** (`20260828100000`) is sound; repo already scoped by `clinic_id` for staff, patient bypass is narrow.
* **`protect_appointment_cancel` trigger** and `CANCELLABLE_STATUSES` guard limit field overwrites during cancellation.
* **Checklist derives `hasAppointment/hasQueue` from real data**, not just `localStorage` toggle — well-intentioned since `506e73f`.
* **Auth store cookie hygiene** (`auth-store.ts:22-40`, `65-66`) correctly clears invalid JSON and isolates per-user cookie.

---

## 10. Consolidated Fix Checklist (by priority)

| Priority | File:Line | Fix |
|----------|-----------|-----|
| P0 | `patient.tsx:1` | Add `beforeLoad` guard with `redirect` and `exp` check; remove `useEffect` guard from `PatientPortal`. |
| P0 | `patient/index.tsx:42-56`, `hooks.ts:50-56` | Make `useAppointments/useQueue` enable for patients without `clinicId`; or wrap `/patient` in tolerant `ClinicProvider`. |
| P0 | `supabase: queue_entries RLS` | Add patient `select` branch for queue or expose via `booked` appointment status. |
| P0 | `hooks.ts:212-225` | Add optimistic `onMutate`/`onError` to `useCancelAppointment`, per-id pending, dialog instead of `confirm()`. |
| P0 | `getting-started-checklist.tsx:49,78` | Initialize `hasProfile` to `null`/`false` and read `localStorage` in `useEffect` + `storage` listener, not render. |
| P0 | `patient/index.tsx:210` | Add `isError` branches + `Refetcher`; handle `clinicId===null` loading. |
| P1 | `patient/index.tsx:162,188` | Unique IDs for queue banners; use `ref`. |
| P1 | `getting-started-checklist.tsx:68-77` vs `index.tsx:60-62` | Unify email-only `useMyAppointments()` hook; remove name fallback. |
| P1 | `hooks.ts:591` | Call `useRealtimeAppointments/Queue` from `PatientPortal`. |
| P1 | `clinic-context.tsx:150` | Add `allClinics` to `useEffect` deps (or use selector). |
| P1 | `patient/index.tsx:210-215` | Coalesce `isPending` across all three queries for skeleton. |
| P2 | `patient/index.tsx:103` | `useCallback` `getSpecialization`. |
| P2 | `patient/index.tsx:60-101`, checklist derivations | `useMemo` for derived lists/counters. |
| P2 | `getting-started-checklist.tsx:50` | Cancellation flag for profile fetch. |

---

## 11. Suggested Minimal Patch (illustrative)

```tsx
// src/routes/patient.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { PatientPortal } from '@/features/patient'
import { hasRole } from '@/config/rbac'
import { useAuthStore } from '@/stores/auth-store'
export const Route = createFileRoute('/patient')({
  beforeLoad: ({location})=>{
    const user = useAuthStore.getState().auth.user
    if(!user || user.exp < Date.now()) throw redirect({to:'/sign-in', search:{redirect: location.href}})
    if(!hasRole(user.role,'patient')){
      if(hasRole(user.role,'admin')||hasRole(user.role,'front_desk')||hasRole(user.role,'doctor'))
        throw redirect({to:'/admin/dashboard'})
      throw redirect({to:'/403'})
    }
  },
  component: PatientPortal,
})

// src/data/hooks.ts — useCancelAppointment
useMutation({
  mutationFn: (id:string)=>{ if(!clinicId) throw new Error('Missing clinic context'); return appointmentsRepository.updateStatus(id,'cancelled',clinicId) },
  onMutate: async (id)=>{ const key=['appointments', clinicId??'none'] as const; await queryClient.cancelQueries({queryKey:key}); const previous=queryClient.getQueryData<Appointment[]>(key); queryClient.setQueryData(key, (old)=>(old??[]).map(a=>a.id===id?{...a,status:'cancelled'}:a)); return {previous}},
  onError: (_e,_v,ctx)=>{ if(ctx?.previous) queryClient.setQueryData(['appointments', clinicId??'none'], ctx.previous)},
  onSettled: ()=>{ queryClient.invalidateQueries({queryKey:['appointments']}); queryClient.invalidateQueries({queryKey:['queue']}) },
})
```

---

*Audit generated by reading 6 in-scope files + 8 cross-reference files + 3 migrations. Every `file:line` above can be verified with `Read`.*
