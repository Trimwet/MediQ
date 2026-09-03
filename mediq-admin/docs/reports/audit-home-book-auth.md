# Audit: Home (/) · Book (/book) · Auth (/sign-in, /sign-up, /create-clinic, /check-in)

**Scope:** `mediq-admin/src/features/landing/index.tsx`, `src/features/landing/components/pricing-section.tsx`, `src/features/booking/index.tsx`, `src/features/auth/sign-up/components/sign-up-form.tsx`, `src/features/auth/sign-in/components/user-auth-form.tsx`, `src/features/create-clinic/index.tsx`, `src/features/check-in/index.tsx` + routes + `src/routeTree.gen.ts` + `src/data/hooks.ts` + `src/data/supabase/repos.ts`
**Date:** 2026-09-03 · **Tooling:** Serena `get_symbols_overview` / `find_symbol` / `search_for_pattern` + direct reads (1-indexed lines)
**Design spec:** shadcn/ui + Radix + `tailwind-merge` via `cn()` + `motion` via `TimelineAnimation` (`delay: i*0.2`)

---

## 1. Atoms — inventory per surface

### 1.1 Home `/` — `src/features/landing/index.tsx:1` + `src/features/landing/components/pricing-section.tsx:1` + `src/features/landing/components/NavBar.tsx:1` + `Footer.tsx:1`

| Atom | File:Line | Primitive | Props / note |
|------|-----------|-----------|--------------|
| `FloatIcon` | `landing/index.tsx:34` | `cn` + `lucide-react` | `animate-icon-pulse absolute` — decorative, `aria-hidden` correct |
| `Hero` CTA primary | `landing/index.tsx:111` | `Button size=lg asChild` | `<Link to='/book'>` + `<CalendarCheck>` — shadcn Button |
| `Hero` CTA secondary | `landing/index.tsx:117` | `Button variant=outline asChild` | `<Link to='/sign-up'>` |
| Carousel dots | `landing/index.tsx:134` | raw `<button>` | `type=button`, `aria-label`, `aria-current`, `onClick setActiveIndex` — **not** `ui/button` |
| Stats strip | `landing/index.tsx:152` | `div` grid 2/4 | Hardcoded 0 values — not bound to data |
| `SectionHeading` | `landing/index.tsx:176` | `h2` + `p` | Shared, no motion |
| `UnifiedPlatform` Tabs | `landing/index.tsx:323` | `Tabs/TabsList/TabsTrigger/TabsContent` | `src/components/ui/tabs.tsx:1` (Radix) — correct, `orientation=vertical` |
| Role card detail | `landing/index.tsx:368` | `div rounded-2xl border bg-card` | Uses `group-data-[state=active]:animate-in` (Tailwind), not `TimelineAnimation` |
| Role CTA | `landing/index.tsx:411` | `Button asChild` | `<Link to={role.cta.to}>` where `role.cta.to` in `/book\|/sign-in\|/sign-up\|/create-clinic` |
| `Step` | `landing/index.tsx:432` | `span size-14 rounded-full bg-primary/10` | 3 instances via `HowItWorks` |
| Rhombus SVG | `landing/index.tsx:459` | `<svg>` backdrop | Decorative, `aria-hidden` |
| `ClinicFloor` list items | `landing/index.tsx:844` | `li flex gap-4 rounded-xl border bg-card p-5` | 4 features, `hover:border-primary/40` |
| `ClinicFloor` CTAs | `landing/index.tsx:832` | `Button asChild` x2 | `/book` + `/doctors` |
| `CTA` banner | `landing/index.tsx:896` | `Button variant=secondary asChild` | `/book` + `Button variant=outline asChild` → `/sign-in` |
| `PricingSection` header h2 | `pricing-section.tsx:87` | `TimelineAnimation animationNum=1` | `timelineRef`, `as='h2'` |
| `PricingSection` subhead | `pricing-section.tsx:95` | `TimelineAnimation animationNum=2` | `as='p'` |
| Billing toggle | `pricing-section.tsx:104` | `TimelineAnimation animationNum=3` + `Switch` | `src/components/ui/switch.tsx` (Radix) + `cn` for active/inactive |
| Free banner | `pricing-section.tsx:152` | `TimelineAnimation animationNum=4` | `border-dashed`, `Button variant=outline asChild` → `freePlan.to=/create-clinic` |
| Plan cards (3) | `pricing-section.tsx:179` | `TimelineAnimation animationNum=5+index` | `cn` conditional `plan.featured` vs `bg-card`, `NumberFlow` for price, `Button asChild` → `/create-clinic?plan=…` |
| `NavBar` | `NavBar.tsx:26` | `Button`, `Sheet` (`ui/sheet` → Radix Dialog), `cn`, `Logo` | `allLinks` → `/,/doctors,/about,/faq,/contact` — uses `useMatchRoute` |
| `Footer` | `Footer.tsx:24` | `Link` + `<a href>` | `quickLinks` + `patientLinks` + social `<a>` external |

**Atoms count:** 14 `Button` (all `asChild` or with `onClick`), 4 `Card`-like divs, 1 `Switch`, 1 `Tabs` set, 7 `TimelineAnimation` instances, 2 raw `<button>` dots (intentional).

### 1.2 Book `/book` — `src/features/booking/index.tsx:1`

| Atom | File:Line | Primitive | Note |
|------|-----------|-----------|------|
| `formSchema` | `booking/index.tsx:52` | `z.object` 7 fields | `patientName, email, phone, clinicId?, doctorId?, date, time, reason?` |
| `TIME_SLOTS` | `booking/index.tsx:41` | const 8 items | 9-16h, filtered vs `isToday` at `booking/index.tsx:140` |
| `useForm` | `booking/index.tsx:80` | `zodResolver(formSchema)` | `defaultValues` with `clinicId: defaultClinicId`, `doctorId: no_preference` |
| Header back | `booking/index.tsx:245` | `Button variant=ghost size=sm asChild` | `<Link to='/'>` |
| Header Logo | `booking/index.tsx:250` | `<Logo>` | `<Link to='/'>` |
| `ThemeSwitch` | `booking/index.tsx:255` | `ThemeSwitch` | — |
| Header Sign in | `booking/index.tsx:256` | `Button variant=outline size=sm asChild` | `<Link to='/sign-in'>` |
| `Card` | `booking/index.tsx:273` | `Card/CardHeader/CardContent` | `CalendarCheck2` in header |
| `FormField patientName` | `booking/index.tsx:285` | `FormField/FormItem/FormLabel/Input/FormMessage` | `src/components/ui/form.tsx:34` + `ui/input.tsx:1` |
| `FormField email` | `booking/index.tsx:298` | same | `type=email` |
| `FormField phone` | `booking/index.tsx:315` | same | `Input` |
| `FormField clinicId` | `booking/index.tsx:328` | `SelectDropdown` | `isControlled`, `defaultValue field.value \|\| defaultClinicId`, resets `doctorId` |
| `FormField doctorId` | `booking/index.tsx:355` | `SearchableSelect` | `groups={doctorGroups}` grouped by `specialization`, `isPending` |
| `FormField date` | `booking/index.tsx:384` | `DatePicker` | `disabled: date < startOfDay(new Date())` |
| `FormField time` | `booking/index.tsx:403` | `SelectDropdown` | `items={availableTimeSlots}` |
| `FormField reason` | `booking/index.tsx:423` | `Input` | optional |
| Submit | `booking/index.tsx:444` | `Button type=submit col-span-2` | `disabled={book.isPending}`, `Loader2` vs `CalendarCheck2` |
| `BookingSuccess` — success `Card` | `booking/index.tsx:536` | `Card/CheckCircle2` | `hasAccount \|\| accountCreated` branch |
| `BookingSuccess` password `Form` | `booking/index.tsx:609` | `Form` + `FormField x2 PasswordInput` | `zodResolver(passwordSchema)` second form |
| Disabled email `Input` | `booking/index.tsx:617` | `Input type=email disabled value={email}` | standalone, not `FormField` (correct — display only) |
| Ghost Book another | `booking/index.tsx:673` | `Button variant=ghost onClick={onBookAnother}` | — |

**Forms:** 2× `useForm` with `zodResolver`, 8× `FormField` in Booking, 2× in BookingSuccess — all inside `<Form {...form}>` (=`FormProvider` alias, `ui/form.tsx:16`).

### 1.3 Auth — `src/features/auth/sign-up/components/sign-up-form.tsx:1`, `sign-in/components/user-auth-form.tsx:1`, `forgot-password/components/forgot-password-form.tsx:1`, `src/features/auth/auth-layout.tsx:1`

| Atom | File:Line | Primitive |
|------|-----------|-----------|
| `sign-up-form` | `sign-up-form.tsx:48` | `useForm zodResolver`, 5× `FormField` (`name, phone, email, password, confirmPassword`), `Input` ×3, `PasswordInput` ×2, `Button mt-3 disabled={isLoading}` (`UserPlus`/`Loader2`), `cn` |
| `user-auth-form` | `user-auth-form.tsx:46` | `useForm zodResolver`, 2× `FormField` (`email, password`), `Input`, `PasswordInput`, `Button mt-3 disabled={isLoading}` (`LogIn`/`Loader2`), `cn`, `Link to='/forgot-password'` absolute, `Link to='/book'` |
| `forgot-password-form` | `forgot-password-form.tsx:32` | `useForm zodResolver`, 1× `FormField`, `Input`, `Button mt-2 disabled` (`ArrowRight`/`Loader2`), `cn` |
| `AuthLayout` | `auth-layout.tsx:38` | `Logo`, `ThemeSwitch`, `Card/CardContent/CardFooter`, `Link to={back.to}` conditional, visual `<img>` + feature list |

All auth forms use `Form` (=`FormProvider`) + `zodResolver` + `cn`.

### 1.4 Create Clinic `/create-clinic` — `src/features/create-clinic/index.tsx:1`

| Atom | File:Line | Primitive |
|------|-----------|-----------|
| `plans` | `create-clinic/index.tsx:54` | 4 radio-like options (Free/Starter/Professional/Enterprise) |
| `combinedSchema` | `create-clinic/index.tsx:66` | zod 8 fields + refine passwords |
| `clinicOnlySchema` | `create-clinic/index.tsx:101` | zod 3 fields |
| `SlugIndicator` | `create-clinic/index.tsx:139` | `cn`, `Loader2`/`Check`/`span` per `slugStatus` |
| `useSlugField` | `create-clinic/index.tsx:183` | `useEffect` ×3, `supabase.from('clinics').select('id').eq('slug', slug).maybeSingle()` at `create-clinic/index.tsx:229` |
| `CombinedForm` | `create-clinic/index.tsx:279` | `useForm<CombinedValues> zodResolver`, `FormProvider`, 5× account `FormField` + divider + 3× clinic `FormField` (`clinicName Input`, `slug Input` in `div border bg-muted/50` + `Input border-0`, `plan Select`), `Button type=submit size=lg w-full disabled={isFormSubmitting \|\| !isValid}` |
| `ClinicOnlyForm` | `create-clinic/index.tsx:617` | `useForm<ClinicOnlyValues>`, `FormProvider`, 3× `FormField`, `useEffect []` restore pending clinic, `Button type=submit` |
| `CreateClinic` shell | `create-clinic/index.tsx:804` | `Card/CardHeader/CardTitle/CardDescription/CardContent`, `Logo`, `Link to='/'` |

Both forms explicitly use `FormProvider` (spec-compliant, unlike booking/sign-up alias).

### 1.5 Check-in `/check-in` — `src/features/check-in/index.tsx:1`

| Atom | File:Line | Primitive |
|------|-----------|-----------|
| `PageState` | `check-in/index.tsx:31` | discriminated union `loading\|error\|not-found\|detail\|success\|already-checked-in` |
| `getStatusBadgeClasses` | `check-in/index.tsx:43` | `switch(status)` → sky/amber/indigo/emerald/destructive |
| `CheckInPage` | `check-in/index.tsx:78` | `useState PageState`, `useState isCheckingIn`, `appointmentId = new URLSearchParams(window.location.search).get('id')` at `check-in/index.tsx:83` |
| Loading | `check-in/index.tsx:198` | `Card` + `div animate-spin rounded-full border-4 border-t-primary` |
| Error | `check-in/index.tsx:211` | `CardHeader CardTitle text-destructive` |
| NotFound | `check-in/index.tsx:226` | `CardDescription` |
| Already | `check-in/index.tsx:242` | `position: count ?? 1` |
| Success | `check-in/index.tsx:265` | `text-emerald-600` |
| Detail | `check-in/index.tsx:288` | `CardHeader/CardContent`, `formatDateTime`, `canCheckIn`/`isPendingApproval`, `Button w-full size=lg onClick={handleCheckIn} disabled={isCheckingIn}` — 3 branches: eligible → Button, awaiting → amber message, else → status message |

Zero `Form`, zero `TimelineAnimation`, zero `Select` — read-only detail + single CTA.

---

## 2. Bonds — data flow & `clinic_id` / RLS

### 2.1 `useBookAppointment` + `usePublicDoctors` + `usePublicClinics`

*Declared:* `src/data/hooks.ts:383`/`425`/`463` · *Consumed:* `src/features/booking/index.tsx:9` / `68` / `95`

| Step | File:Line | Bond | RLS / clinic_id correct? |
|------|-----------|------|--------------------------|
| `usePublicClinics` → `supabase.rpc('list_public_clinics')` fallback `from('clinics').select(...).eq('status','active')` | `hooks.ts:388`/`398` | anon-safe public clinics | ✅ `SECURITY DEFINER` RPC; fallback returns filtered `active`; if empty returns `[{id:'default'}]` sentinel |
| `urlClinicId = new URLSearchParams(window.location.search).get('clinicId')` | `booking/index.tsx:72` | URL → clinic | ⚠️ see Broken Bonds |
| `defaultClinicId = urlClinicId ?? clinics[0]?.id ?? ''` | `booking/index.tsx:78` | fallback chain | ✅ tolerates empty |
| `selectedClinicId = form.watch('clinicId') \|\| defaultClinicId` | `booking/index.tsx:94` | form value → query key | ✅ |
| `usePublicDoctors(selectedClinicId \|\| undefined)` → `supabase.rpc('list_public_doctors', clinicId?{p_clinic_id}:{})` | `hooks.ts:431` | anon-safe doctors, DEFAULT NULL → default clinic | ✅ RPC bypasses RLS intentionally (`fix_tenancy_warnings.sql W1,W6`); `data.map id/name/specialization` |
| `doctorGroups` memo groups by `specialization` | `booking/index.tsx:108` | UI grouping | ✅ |
| `form.handleSubmit(onSubmit)` → `book.mutate({patientName,email,phone,doctorId,doctorName,scheduledFor,reason,clinicId: chosenClinicId})` | `booking/index.tsx:161` | booking payload | ✅ `chosenClinicId = values.clinicId \|\| selectedClinicId` |
| `useBookAppointment` → `bookingRepository.book(input)` | `hooks.ts:465` → `supabase/repos.ts:589` | sanitizes `isUuid` check, `p_clinic_id: validClinicId` else `null` → default clinic; fallback `from('appointments').insert(...)` | ✅ but see Broken Bonds #B-08 historical |
| `onSuccess` → 9× `localStorage.setItem` + `mediq_last_booked_appointment` + `mediq_patient_appointment:{id}` | `booking/index.tsx:174` | local mirror for `useAppointments` patient fallback | ⚠️ see Broken Bonds (try/catch ok but quota silent) |

**Verdict:** Bond is end-to-end (URL → clinic → doctors → book → localStorage → patient portal). `clinic_id` correctly threaded where UI provides it; anon fallback to default clinic is *intentional* for public booking (mirrors `src/data/supabase/repos.ts:592` UUID guard).

### 2.2 `authRepository.signUp` + `supabase.auth`

*Declared:* `src/data/supabase/repos.ts:660` · *Consumed:* `src/features/auth/sign-up/components/sign-up-form.tsx:61` + `src/features/booking/index.tsx:507` (via `useSignUp`)

| Step | File:Line | Bond |
|------|-----------|------|
| `sign-up-form onSubmit` → `authRepository.signUp({name,email,password,phone})` → `toast.promise` | `sign-up-form.tsx:62` → `repos.ts:662` `supabase.auth.signUp({email,password,options:{data:{name,phone}}})` |
| Post-signUp `supabase.from('profiles').select('role').eq('id', user.id).single()` | `repos.ts:678` → returns `role ?? ['patient']` |
| Patient directory insert `supabase.from('patients').insert({name,phone,email,visits:0})` | `repos.ts:690` — **no `clinic_id`** |
| `useSignUp` in `BookingSuccess` `signUp.mutate({email,password})` | `booking/index.tsx:507` → `hooks.ts:372` `authRepository.signUp` — name/phone omitted (booking already has them) |

**RLS:** `patients_insert` in `repos.ts:690` will be blocked when RLS requires `clinic_id` + `user_in_clinic` (see `supabase/migrations` tenancy). The insert is purposely without `onConflict lower(email)` handling — duplicate is the expected path (`authRepository` throws `An account already exists`). Duplicate patient insert is swallowed only if `msg.includes('duplicate')` (line 697). Missing `clinic_id` means the row lands as `clinic_id IS NULL` and is invisible to clinic staff (prior `INV-01`/`F03`).

### 2.3 `create_clinic` RPC + `supabase.auth`

*Declared:* `supabase/migrations/20260823_create_clinic.sql:15` · *Consumed:* `src/features/create-clinic/index.tsx:312` (CombinedForm) + `660` (ClinicOnlyForm)

| Step | File:Line | Bond |
|------|-----------|------|
| `CombinedForm onSubmit` → `supabase.auth.signUp({email,password,options:{data:{name,phone}}})` | `create-clinic/index.tsx:312` |
| `supabase.auth.getSession()` — gate | `create-clinic/index.tsx:340` — if null, `localStorage.setItem('mediq_pending_clinic', {clinicName,slug,plan,email})` then `navigate /sign-in` |
| `supabase.rpc('create_clinic', {p_name,p_slug,p_plan})` | `create-clinic/index.tsx:362` / `660` — `REVOKE FROM anon` → `GRANT authenticated` (migration :106) |
| Return `clinicData.clinic_id` → `useAuthStore setClinic(clinicId,'admin',clinicName)` | `create-clinic/index.tsx:385` / `680` |
| `navigate /admin/dashboard` + `toast.success` | `create-clinic/index.tsx:397` |
| `ClinicOnlyForm useEffect []` restores `mediq_pending_clinic` if `email.toLowerCase` matches | `create-clinic/index.tsx:634` |

**Clinic_id bond:** RPC enforces `EXISTS slug` → `INSERT clinics` + `INSERT clinic_members(admin)` atomically (fixed in later `20260823100000_add_free_plan.sql`). The JS layer correctly extracts `clinic_id` string and seeds `auth-store` + `ClinicProvider`. Cross-check `src/lib/clinic-context.tsx:87` fetches `from('clinic_members').select(...).eq('user_id', authUser.id)` — will see the new row after commit (read-after-write; cache invalidation via `ClinicProvider`).

### 2.4 `supabase.auth` usage map (serena `search_for_pattern`)

| File:Line | Call | Bond |
|-----------|------|------|
| `sign-up-form.tsx:62` | `authRepository.signUp` → `supabase.auth.signUp` | anon → authenticated candidate |
| `user-auth-form.tsx:58` | `supabase.auth.signInWithPassword` | auth → `supabase.from('profiles')` → `auth.setUser` + `setAccessToken` → `navigate redirect‖/patient‖/admin/dashboard` |
| `create-clinic/index.tsx:312` | `supabase.auth.signUp` direct | same as above but inline |
| `create-clinic/index.tsx:340` | `supabase.auth.getSession()` | gate for clinic creation |
| `hooks.ts:80` | `supabase.auth.getUser()` inside `ClinicProvider` | resolves clinic membership |
| `hooks.ts:10` | `supabase.auth.onAuthStateChange` in `useSupabaseAuthSync` | `SIGNED_IN/INITIAL_SESSION/PASSWORD_RECOVERY` → fetch profile, preserve clinic fields only if `prev.accountNo === session.user.id` |
| `check-in/index.tsx:98` | none directly — uses `supabase.from('appointments')` / `queue_entries` (public QR flow) | relies on RLS, no `supabase.auth` guard |

**Verdict:** All authenticated paths go through `supabase.auth` with `persistSession:true` (`src/lib/supabase.ts:18`). Half-auth edge (sign-in profile fetch failure leaves JWT alive while store null) remains — see Broken Bonds.

### 2.5 Route bonds (`src/routeTree.gen.ts:1`)

| Link `to` | File:Line | Exists? | Search param |
|-----------|-----------|---------|--------------|
| `/book` | `landing/index.tsx:112,832,902`, `NavBar.tsx:65`, `Footer.tsx:14` etc | ✅ `BookRoute /book` |
| `/sign-up` | `landing/index.tsx:123`, `Footer.tsx:15` | ✅ `/(auth)/sign-up → /sign-up` |
| `/sign-in` | `landing/index.tsx:913`, `NavBar.tsx:62`, `Footer.tsx:16`, `CTA` | ✅ `/(auth)/sign-in → /sign-in` |
| `/create-clinic` | `landing/index.tsx:838?` (via `PricingSection freePlan.to`) + `pricing-section.tsx:19` | ✅ `CreateClinicRoute /create-clinic` with `?plan=free\|starter\|professional\|enterprise` (`validateSearch` via `getInitialPlan`) |
| `/doctors` | `landing/index.tsx:839`, `NavBar.tsx:20`, `Footer.tsx:6` | ✅ `PublicDoctorsIndexRoute /doctors/` maps to `FileRoutesByTo '/doctors'` |
| `/doctors/$doctorId` | implicit via doctors list | ✅ `PublicDoctorsDoctorIdRoute` |
| `/about,/faq,/contact` | `NavBar.tsx:20`, `Footer.tsx:6` | ✅ `PublicAbout/Contact/Faq` |
| `/check-in?id=` | QR / manual | ✅ `CheckInRoute /check-in` |
| `/patient` | `user-auth-form.tsx:114`, `booking/index.tsx:588` | ✅ `PatientRoute /patient` |
| `/admin/dashboard` | `create-clinic/index.tsx:397,690` | ✅ `AuthenticatedAdminDashboardRoute` |
| `/terms`, `/privacy` | `auth-layout.tsx:32,40` (`<a href='/terms'>`) | ❌ no route — 404 |

---

## 3. Broken Bonds — `file:line` severity

> `Critical` = data leak / auth bypass / bricked user · `High` = RLS / cross-tenant / SSR crash · `Medium` = UX / retry / deps · `Low` = lint / a11y / token drift · `Info` = intentional placeholder

| # | File:Line | Kind | Severity | Detail |
|---|-----------|------|----------|--------|
| **B-01** | `src/features/create-clinic/index.tsx:41` | `window` without SSR guard | **High** | `getInitialPlan()` does `new URLSearchParams(window.location.search)` with no `typeof window` check. During SSR / Vitest browser headless without `window`, throws `ReferenceError`. Fix: `if (typeof window==='undefined') return 'free'`. |
| **B-02** | `src/features/check-in/index.tsx:83` | `window` without SSR guard | **High** | `const appointmentId = new URLSearchParams(window.location.search).get('id')` runs on every render, no `useMemo`, no SSR guard, no `try/catch`. Also not reactive to TanStack Router `search` — stale if route updates without full reload. Fix: `useSearch({from:'/check-in'})` or `useMemo` + guard. |
| **B-03** | `src/features/check-in/index.tsx:98` | Supabase without `clinic_id` | **High** | `supabase.from('appointments').select('*').eq('id', id).single()` exposes cross-tenant read if RLS is `anon` permissive. Check-in is public QR flow intentionally, but policy must enforce `appointmentId` scoped to bearer token or signed QR. Document as intentional public path; add `select` column allowlist instead of `*`. |
| **B-04** | `src/features/check-in/index.tsx:112` | Supabase without `clinic_id` | **High** | `from('queue_entries').select('id').eq('appointment_id', apt.id).order(...)` no `clinic_id` filter — count query at `:124` *does* filter by `clinic_id`, but this one doesn't, leaked count across clinics if `apt.clinic_id` is `NULL`. |
| **B-05** | `src/features/check-in/index.tsx:160` | Supabase `clinic_id` may be `NULL` | **High** | `insert({appointment_id, patient_name, appointment_time, doctor_name, clinic_id: apt.clinic_id})` — if `apt.clinic_id` is `NULL` (booking fallback without UUID), row lands unscoped. RLS `clinic_id IS NULL` rows are invisible to dashboard. Fix: `if (!apt.clinic_id) throw`. |
| **B-06** | `src/data/supabase/repos.ts:690` | Supabase without `clinic_id` | **High** | `authRepository.signUp` → `from('patients').insert({name,phone,email,visits:0})` omits `clinic_id`. RLS `patients_insert_clinic` requires `user_in_clinic` → blocked; row with `NULL` is orphaned. Matches prior `INV-01`/`F03`. Fix: omit insert and rely on booking-created patient, or pass `clinic_id:null` explicitly + add `patients_insert_own` policy (exists only in `mediq-admin/supabase/migrations` not canonical `supabase/migrations`). |
| **B-07** | `src/data/supabase/repos.ts:618` | Fallback insert without `clinic_id` | **Medium** | `bookingRepository.book` fallback `from('appointments').insert({..., ...(validClinicId?{clinic_id}:{})})` intentionally allows `NULL` for anon bookings to survive RLS. Local `fallbackApt` also has no `clinicId` field propagation. Acceptable for public booking but dashboard won't see `NULL` rows. |
| **B-08** | `src/features/booking/index.tsx:72` | `useMemo` with `[]` reading `window` | **Medium** | `urlClinicId = useMemo(()=> new URLSearchParams(window.location.search).get('clinicId'), [])` never reacts to router navigation. User picks clinic A, navigates to `?clinicId=B` via Link, mem stays A. Fix: `const {clinicId} = useSearch({from:'/book'})` or `useEffect` + `location.search`. |
| **B-09** | `src/features/booking/index.tsx:80` | `useForm defaultValues` stale | **Medium** | `defaultValues: {clinicId: defaultClinicId}` where `defaultClinicId = clinics[0]?.id` is async. `useForm` defaultValues are only read on mount; when `usePublicClinics` resolves, field stays `''` until SelectDropdown's `defaultValue` fallback `field.value \|\| defaultClinicId` masks it. Still uncontrolled→controlled risk and `zod` `clinicId?` allows empty submit → sanitizes to `null` → lands in default clinic. Fix: `useEffect(()=> form.reset({clinicId: defaultClinicId}), [defaultClinicId])` when clinics load. |
| **B-10** | `src/features/create-clinic/index.tsx:200` | `useEffect` missing dep | **Low** | Auto-generate slug `useEffect(()=> setValue('slug', generateSlug(clinicName)), [clinicName, isSlugTouched])` omits `setValue`. Stable via RHF but lint `exhaustive-deps` fires. |
| **B-11** | `src/features/create-clinic/index.tsx:215` | `useEffect` deps `[slug]` only | **Medium** | Debounced slug check lists `if (!slug \|\| ... schema.safeParse) return` but deps omit `schema`. If caller passes different schema (combined vs clinicOnly) closure stale. Also `Promise.race` timeout resolves with `{error}` shape that mimics Supabase error but not identical — `result.error` branch treats timeout as idle. Add `schema` to deps; use `AbortSignal` instead of race. |
| **B-12** | `src/features/create-clinic/index.tsx:634` | `useEffect` with `[]` | **Medium** | `useEffect(()=>{ const raw=localStorage.getItem('mediq_pending_clinic'); ... methods.setValue ...}, [])` reads `user` and `methods` but never re-runs if `user` arrives after mount (async auth restore). Currently guard `if (!raw \|\| !user?.email) return` means data silently dropped if effect runs before user hydrates. Deps should be `[user?.email]`. |
| **B-13** | `src/features/auth/auth-layout.tsx:33` | Link to non-existent route | **Medium** | `<a href='/terms'>` and `<a href='/privacy'>` at `auth-layout.tsx:32,40` and `sign-up/index.tsx:32-40` footer — no `routeTree` entry for `/terms` or `/privacy` → 404. External `<a>` also lacks `rel`/target handling. Fix: add `src/routes/terms.tsx`/`privacy.tsx` or change to external docs URL. |
| **B-14** | `src/features/auth/sign-in/components/user-auth-form.tsx:81` | Half-auth state | **Medium** | On `profileError` the toast shows but `supabase.auth` session remains alive while Zustand `user===null`. `ClinicProvider` then sees `supabase.auth.getUser()` success and confuses membership. Fix: `await supabase.auth.signOut(); useAuthStore.getState().auth.reset()` on profile failure (as noted in `bug-bounty-auth-platform.md:A2`). |
| **B-15** | `src/features/auth/sign-up/components/sign-up-form.tsx:69` | Error surface raw | **Low** | `toast.promise` `error: (e)=> e.message` surfaces `AuthApiError: User already registered` verbatim. `create-clinic/index.tsx:324` correctly maps `msg.includes('already')`. Sign-up should do same friendly mapping. |
| **B-16** | `src/features/auth/sign-up/components/sign-up-form.tsx:161` | Button missing explicit `type` | **Low** | `<Button className='mt-3' disabled={isLoading}>` inside `<form>` defaults to `submit` in HTML5 but Radix `Slot` may lose default. Add `type='submit'` for a11y/lint parity with create-clinic. |
| **B-17** | `src/components/password-input.tsx:23` | Raw `<input>` not `ui/input` | **Low** | Uses plain `<input>` with `h-9 rounded-md border border-input` copy-pasted from `ui/input.tsx:4` instead of importing `Input`. Bypasses `Input` a11y `data-slot` + `focus-visible:ring` tokens. Fix: `import {Input} from '@/components/ui/input'` and wrap eye Button. |
| **B-18** | `src/features/landing/index.tsx:134` | Raw `<button>` not `ui/button` | **Info** | Carousel dots use native `<button>` with `h-2 rounded-full` — intentionally minimal (4 instances max), but inconsistent with design tokens. Accept as intentional, but add `cn` already does. Not a bug. |
| **B-19** | `src/features/landing/index.tsx:56` | Static placeholder | **Info** | `heroStats` all zeros (`0`, `0 min`, `0%`) not bound to `analyticsRepository.getSummary`. Intentional mock until live stats; consider wiring `useAnalytics('today')` when clinic context exists. |
| **B-20** | `src/features/create-clinic/index.tsx:362` | Fragile error string match | **Low** | `msg.includes('duplicate')\|\|msg.includes('unique')` maps `unique_violation` to `This slug is already taken`. Postgres message is stable today but i18n/driver wrapping could break. Better to check `error.code==='23505'`. |
| **B-21** | `src/lib/clinic-context.tsx:139` | Stale closure comment todo | **Info** | Already guarded by `lastFetchedEmail` ref; no bug. |

**No broken:** `FormField` without `FormProvider` — none (all forms use `Form` alias or `FormProvider`). `Button` with no `onClick`/`type`/`asChild` — none (every `Button` has one of the three). `localStorage` without `try/catch` — all public surfaces wrap in `try{}` (booking `:174`, create-clinic `:342`, patient fallback). The only unwrapped is `window.location` reads (B-01/B-02/B-08) which are equivalent.

---

## 4. Design Language Violations

| # | File:Line | Token | Violation | Fix |
|---|-----------|-------|-----------|-----|
| **D-01** | `src/features/landing/index.tsx:73,313` | `motion` | Hero auto-rotate + UnifiedPlatform role rotate use `useEffect` + `setTimeout` but **no** `TimelineAnimation`. Spec expects `motion` + `delay i*0.2`. Only `pricing-section.tsx:87` uses `TimelineAnimation` correctly (`defaultSequenceVariants visible: (i)=>delay i*0.2 duration 0.4 blur 20→0` at `timeline-animation.tsx:30`). Landing's other sections (Hero, UnifiedPlatform, HowItWorks, ClinicFloor, CTA) have zero motion. | Wrap each section's `h2/p` + card list in `TimelineAnimation` with `animationNum` increments, sharing a `timelineRef` per section. |
| **D-02** | `src/components/password-input.tsx:23` | `ui/input` | Raw `<input>` instead of `ui/input.tsx:4` (`data-slot=input`). Duplicates Tailwind but misses `dark:bg-input/30` parity. | `import {Input}` and render `<Input type={show? 'text':'password'} ... className='pe-9'>` plus absolute eye `Button`. |
| **D-03** | `src/features/landing/index.tsx:134` | `ui/button` | Carousel dots as native `<button>` bypass `buttonVariants` (cva) & `cn` focus ring. Minor but inconsistent. | Either keep native (document as intentional chroma) or use `<Button variant=ghost size=icon className='h-2 w-2 rounded-full'>`. |
| **D-04** | `src/features/check-in/index.tsx:202` | `ui/skeleton` | Loading uses raw `div animate-spin rounded-full border-4 border-t-primary` instead of `ui/skeleton` or `WavePhysicsLoader` (used in `__root.tsx:42`). | Use `Skeleton` or shared loader. |
| **D-05** | `src/features/booking/index.tsx:80` vs `create-clinic/index.tsx:284` | `FormProvider` | Booking + auth forms import `Form` alias (`FormProvider` at `ui/form.tsx:16`) while create-clinic imports `FormProvider` explicitly. Functional equivalence but inconsistent naming violates “one vocabulary” rule. | Standardize to `Form` alias everywhere (or explicit `FormProvider` everywhere). |
| **D-06** | `src/features/landing/index.tsx:98` | `cn` / tokens | `bg-slate-950/70 dark:bg-slate-950/80` hardcodes slate, not `bg-background` token. Overlay is decorative but breaks dark/light token contract. | Use `bg-background/70` or `bg-foreground/70` via `cn`. |
| **D-07** | `src/features/booking/index.tsx:444` vs `sign-up-form.tsx:161` | `Button type` | Booking submit is `<Button type=submit>` explicit, sign-up/sign-in are `<Button disabled>` implicit `submit`. Lint `react/button-has-type` would flag. | Add `type='submit'` everywhere inside forms. |
| **D-08** | `src/features/create-clinic/index.tsx:532` | `cn` | Slug `div className='flex items-center rounded-md border border-input bg-muted/50'` + `Input className='border-0 bg-transparent'` composes `Input` border off — correct visual but double-wraps `border-input` (once on div, once on Input override). Works due to `focus-visible:ring-0`. Document as pattern. | No fix needed — keep but extract to `SlugInput` component. |
| **D-09** | `src/features/landing/components/pricing-section.tsx:10` | `useId` | `const id = useId()` at `:80` is used only for `Switch id={id}`. Correct. No violation. | — |
| **D-10** | `src/features/booking/index.tsx:279` vs `create-clinic/index.tsx:410` | `zodResolver` | Both use `zodResolver` correctly. No violation. | — |

**Overall compliance:** `cn` used in 28 places (landing 14, pricing 12, check-in 0, booking 0, auth via `cn` on form class). `Button`/`Card`/`Input`/`Select`/`Tabs`/`Switch`/`Form` all from `ui/*` (Radix + shadcn). `motion` partially compliant — PricingSection follows `TimelineAnimation delay i*0.2` contract, landing's other sections do not. `tailwind-merge` correctly via `cn` (`clsx` + `twMerge` at `lib/utils.ts:4`). No `Dialog` usage on public surfaces (Sheet uses Dialog correctly in NavBar).

---

## 5. Summary — 10 bullets

1. **Landing is token-compliant but motion-incomplete:** all Buttons/Cards/Tabs/Switch come from `ui/*` with `cn`; only `pricing-section.tsx:87` honors `TimelineAnimation delay i*0.2`, Hero/UnifiedPlatform/HowItWorks/ClinicFloor/CTA still static — add `timelineRef` per section. Raw carousel dots at `landing/index.tsx:134` are intentional.
2. **Booking data-bond is sound:** `useBookAppointment` + `usePublicDoctors` correctly chain `window clinicId → /public-clinics RPC → doctors RPC (DEFAULT NULL)` → `book_appointment(p_clinic_id)` with `isUuid` sanitization at `supabase/repos.ts:592`; anon fallback to default clinic is intentional (see `hooks.ts:431`). Fix stale `defaultValues` at `booking/index.tsx:80` with `useEffect reset`.
3. **Auth bond half-closed:** `authRepository.signUp` at `repos.ts:660` inserts `patients` without `clinic_id` at `repos.ts:690` (High, blocks under tenancy RLS); `useSignUp` → `supabase.auth.signUp` is correct, but `user-auth-form.tsx:81` leaves JWT alive on profile fetch failure — signOut on `profileError`.
4. **Create-clinic bond is atomic but SSR-brittle:** `create_clinic` RPC at `create-clinic/index.tsx:362/660` (`authenticated` only, slug regex matches migration) threads `clinic_id → setClinic → /admin/dashboard`; `getInitialPlan()` at `:41` and slug debounced check at `:215` need `typeof window` guard + correct `useEffect` deps, and `useEffect []` at `:634` misses `user.email`.
5. **Check-in has two High RLS gaps:** public `select *` at `check-in/index.tsx:98` and `queue_entries` at `:112` lack `clinic_id`; insert at `:160` may write `NULL` clinic; QR-ID-in-URL at `:83` is `window` without SSR guard — move to TanStack `useSearch`.
6. **Routes are wired:** every `Link to='/book|/sign-in|/sign-up|/create-clinic|/doctors|/about|/faq|/contact|/check-in|/patient|/admin/dashboard'` exists in `routeTree.gen.ts:57`; only `<a href='/terms|/privacy'>` at `auth-layout.tsx:33` is 404 — add routes or external link.
7. **No FormField or Button orphan:** every `FormField` lives inside `<Form>`/`FormProvider` with `zodResolver` (`booking/index.tsx:80,498`, `sign-up-form.tsx:48`, `user-auth-form.tsx:46`, `create-clinic/index.tsx:284,623`); every `Button` has `onClick` or `type=submit` or `asChild` (Link) — zero dead buttons.
8. **localStorage is guarded, window is not:** booking's 9× `setItem` at `booking/index.tsx:174` is inside single `try/catch`; `ClinicProvider` + `hooks.ts` wrap gets in `try`; only `window.location.search` reads at `create-clinic/index.tsx:41`, `booking/index.tsx:72`, `check-in/index.tsx:83` are unguarded — wrap or use router `search`.
9. **Design tokens:** `cn` (`clsx`+`twMerge` at `lib/utils.ts:4`) used consistently; `password-input.tsx:23` bypasses `ui/input` with raw `<input>` — swap to `Input`; `Button type` should be explicit on all form submits; check-in loading spinner should use shared `Skeleton`/`WavePhysicsLoader`.
10. **Immediate fixes before ship:** guard `window` (B-01/B-02/B-08), add `clinic_id` to `patients` insert or drop it (B-06), scope check-in queries with `clinic_id` + abort `pending_clinic` restore deps (B-12), map sign-up duplicate error to friendly toast (B-15), and bring Hero/UnifiedPlatform into `TimelineAnimation` parity (D-01).

---

*Generated via Serena + direct reads · 6 feature files + `routeTree.gen.ts` + `hooks.ts`/`supabase/repos.ts` · All `file:line` in 1-indexed canonical paths `mediq-admin/src/...`.*
