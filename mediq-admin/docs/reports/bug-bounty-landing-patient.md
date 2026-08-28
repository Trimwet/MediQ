# Bug Bounty Report — Fresh Hunt (Landing / Patient / Booking / Settings)

**Date:** 2026-08-28  
**Scope:** `src/features/landing/` · `src/features/patient/` · `src/features/booking/` · `src/features/settings/`  
**Method:** Full manual read of every file in scope. Checked: button handlers + disabled states, zod validation / error display / reset, `clinic_id` scoping + RLS gate, `useEffect` deps / stale closures, `localStorage` / `cookie` shape / expiry / XSS, a11y + empty states. No fixes — report only.  
**Files inspected:** 15 source files + cross-cutting stores/data layer (`auth-store.ts`, `clinic-context.tsx`, `cookies.ts`, `facility-store.ts`, `data/hooks.ts`, `data/supabase/repos.ts`, `data/repos.ts`, routes).

---

## Executive Summary — Severity Counts

| Severity | Count | Examples |
|----------|-------|----------|
| **Critical** | 4 | Fake password change never hits backend (`account-form.tsx:63`), fake account deletion, patient name-only queue matching leaks wrong position, booking without `clinic_id` creates in default clinic |
| **High** | 11 | IDOR cancel any appointment, `clinic_id` optional → list-all fallback in every repo, `localStorage` forever flag marks checklist done, `hasAppointment` false-positive via `allAppointments.length>0`, RLS bypass via crafted `mediq_user` cookie |
| **Medium** | 18 | Stale disabled buttons, stale `localStorage` not clinic-scoped, mobile sheet not closing on Book CTA, pricing `/yr` vs `/mo` confusion, silent booking failures, infinite skeleton on profile fetch error |
| **Low** | 14 | A11y label/Switch associations, duplicate DOM `id`, single-dot carousel churn, placeholder `Theme` text, missing `aria-current` |

---

## 1. `src/features/landing/` — Pricing · Hero · How It Works · Clinic Floor

### 1.1 `src/features/landing/index.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| L-01 | `index.tsx:28` | Medium | Empty state / data | `heroStats` hard-coded to `0 / 0 min / 0 / 0%`. Strip looks like a data failure; no skeleton, no fetch, no `isPending` handling. Users see a credibility-damaging “all zeroes” banner. |
| L-02 | `index.tsx:33-40` | Low | Logic / perf | `heroImages = ['/images/hero-waiting-room.jpg']` single entry but full carousel machinery remains: interval (`HERO_ROTATE_MS:46`), `setTimeout` loop (`51-58`), dot nav (`117-134`). Modulo is always `0`; timer churns forever for no visual change. Should hide dots + disable interval when `length <= 1`. |
| L-03 | `index.tsx:51-58` | Low | `useEffect` | Correct reset-on-click pattern (`setTimeout` not `setInterval`) but recreates timer on every `activeIndex` change. Not a bug, but worth noting dependency is intentional. No deps issue. |
| L-04 | `index.tsx:60-63` | Low | XSS / injection | `style={{ backgroundImage: \`url('\${image}')\` }}` wraps URL in single quotes. URL containing `'` breaks CSS. Use `url("${image}")` + encode or `CSS.escape`. Low risk with static asset but pattern is fragile. |
| L-05 | `index.tsx:121-133` | Medium | A11y | Carousel dots are `<button aria-label="Show hero image N" aria-current>` — but `aria-current` boolean is co-present with `aria-label` and unannounced correctly only when `aria-current="true"` string; React `boolean` → `"true"/"false"` okay. However keyboard left/right arrow navigation between dots is missing — no `role="tablist"` / arrow-key handling. |
| L-06 | `index.tsx:283-289` | Low | `useEffect` deps | `UnifiedPlatform` auto-rotate effect depends only on `activeId`. `roles` is module-const (stable), so fine. Computes `nextId` via `findIndex` each tick — okay. No missing dep. |
| L-07 | `index.tsx:307-313` | Low | A11y | `<Tabs orientation="vertical">` grid layout is visual only; `TabsList` lacks `aria-label` describing vertical navigation. Minor. |
| L-08 | `index.tsx:562-571` | Info | Composition | `Landing()` composes only inner sections; `NavBar`/`Footer` come from `routes/_public/route.tsx:11-18`. Not a bug, but confirm new `/landing` routes keep that wrapper. |

### 1.2 `src/features/landing/components/NavBar.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| N-01 | `NavBar.tsx:48-55` | Low | A11y | Active-link styling via `matchRoute` but no `aria-current="page"` on the active `<Link>`. Screen readers get no “current page” signal. |
| N-02 | `NavBar.tsx:13` | Info | Routing | `allLinks` includes `/doctors`, `/about`, `/faq`, `/contact` — all exist under `_public` so valid. No dead-link, but `/doctors` highlight uses `fuzzy:true` (line 40) so `/doctors/anything` correctly stays active. For `/` `fuzzy:false` (exact) is correct. |
| N-03 | `NavBar.tsx:76-98` | Medium | Button handler | Sheet close pattern is `SheetClose asChild > Link`. Works for nav links but **final “Book appointment” CTA in `SheetFooter` (`108-117`) is NOT wrapped in `SheetClose`**. After tapping Book on mobile, the sheet stays mounted until the route transition commits; can flash behind the new page or require a second tap to dismiss if navigation is intercepted. Wrap with `SheetClose`. |
| N-04 | `NavBar.tsx:73` | Low | A11y | Hamburger button `aria-label="Toggle menu"` never flips to `"Close menu"` when `open===true`. |
| N-05 | `NavBar.tsx:43` | Low | Style | `bg-background/85 backdrop-blur` standalone without `supports-[backdrop-filter]` fallback — okay but note. |

### 1.3 `src/features/landing/components/Footer.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| F-01 | `Footer.tsx:14` | Medium | Data / broken link | `href: 'https://wa.me/2348000000000'` placeholder number. WhatsApp link is dead; should be driven by env/clinic config or removed. |
| F-02 | `Footer.tsx:49-54` | Low | UX / A11y | Contact email rendered as `<span>hello@mediq.clinic</span>` not `mailto:` nor copy affordance. Not clickable, fails user expectation. |
| F-03 | `Footer.tsx:28` | Low | Hydration | `&copy; {new Date().getFullYear()}` — SSR build year vs client year mismatches on Jan 1 boundary (rare). Prefer build-time constant. |
| F-04 | `Footer.tsx:10-22` | Low | Redundancy | `quickLinks` + `patientLinks` both contain `/book`; duplication is confusing but not harmful. |

### 1.4 `src/features/landing/components/pricing-section.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| P-01 | `pricing-section.tsx:25-52` | High | Data / misleading UX | Yearly prices (`12000`, `40000`, `120000`) displayed with `/{billing==='monthly'?'/mo':'/yr'}` suffix. Starter yearly `₦12,000/yr` reads as 92% cheaper than `₦15,000/mo` (180k/yr). Likely intent is “per-month billed yearly” — missing `/mo billed yearly` clarification. Pricing misinterpretation risk. |
| P-02 | `pricing-section.tsx:86-100` | Medium | A11y / form | Billing toggle `Switch id={id}` has no associated `<Label htmlFor={id}>`. The `Monthly`/`Yearly` texts are plain `<span>`s with color-only active state (no `aria-label`, no `htmlFor`). Screen readers hear “Switch” with no context. Add `aria-label="Toggle yearly billing"` or wrap in `<label htmlFor>`. |
| P-03 | `pricing-section.tsx:95` | Low | A11y | “Save 20%” badge presence is `opacity-50/100` only — inactive state is still visible dimmed, okay, but color-alone distinction when `yearly` active vs not is insufficient (WCAG 1.4.1). Add text change or `aria-hidden`. |
| P-04 | `pricing-section.tsx:107-125` | Low | Responsive | Free plan price `₦0` bubble is `hidden sm:flex` (line 116) — on mobile the cheapest tier has no visual price cue at all. |
| P-05 | `pricing-section.tsx:158-181` | Low | Perf / key | `plans.map((plan, index)` passes `animationNum={5+index}` sequential; `plan.features.map((feature,i)=> key={i})` uses index key. Stable here (features static) but worth using feature literal as key. |
| P-06 | `pricing-section.tsx:2` | Info | Directive | `'use client'` is Next.js convention; no effect in Vite but harmless. |

---

## 2. `src/features/patient/` — Patient Portal · Getting Started Checklist · Upcoming/Past

### 2.1 `src/features/patient/index.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| PA-01 | `index.tsx:32-43` | High | Route guard / data leak | `useEffect` guard: if `!user` → `/sign-in` (no `search.redirect` preserved), if wrong role → `/`. Guard runs **after paint** and component only `return null` when `!user`, not when wrong role. A non-patient (e.g., doctor) briefly renders patient appointments before redirect — can flash RLS-scoped data from React Query cache (stale clinic rows) before navigation commits. Add `if (!user \|\| !hasRole(user.role,'patient')) return null` and preserve `location.href` in redirect. |
| PA-02 | `index.tsx:45-47` | High | `clinic_id` / RLS | `myAppointments` filters by `patientEmail.toLowerCase() === user.email.toLowerCase()`. Relies on **client-side** filtering; no `clinic_id` equality check in render. If `appointmentsRepository.list` fails to scope (see §7), a patient sees cross-clinic appointments whose email matches. Should also match `clinicId` or depend on RLS row visibility. |
| PA-03 | `index.tsx:49-62` | Medium | Data / filtering | `upcoming` excludes `completed|cancelled|no_show|rejected` but **includes `pending`**. Pending requests are awaiting approval and `scheduledFor` may be unapproved; showing them alongside booked visits confuses patients (no way to know “not yet confirmed” except badge color). Pending should be its own “Requests” section or flagged. |
| PA-04 | `index.tsx:72-78` (`patient/index.tsx:60-62` for queue) | **Critical** | Cross-tenant / wrong identity | `queuePosition = waitingQueue.findIndex(e => e.patientName.toLowerCase() === todayAppointment.patientName.toLowerCase())`. **Name-only match.** Two patients named “John Doe” collide → shows wrong position or hides banner (`-1`). Case collisions (`JOhn` vs `john`) normalized but duplicates not. Should match `appointmentId` or `patientEmail`. Same weak match repeats in `getting-started-checklist.tsx:97-108`. This is horizontally exploitable in clinics with name duplicates. |
| PA-05 | `index.tsx:68` | Medium | Data / empty state | `waitingQueue = queue.filter(e=>e.status==='waiting')`. Patients in `called` / `in_room` disappear from banner even though still actively queued. Banner vanishes at the most anxious moment. Include `called`. |
| PA-06 | `index.tsx:71-84` | Medium | Data correctness | `todayAppointment` is `upcoming.find(isToday && status in booked|arrived|in_progress)`. If patient has 2 appointments today, picks earliest sorted first; but if earliest is `booked` 9am and later is `in_progress` 2pm, the earlier stays shown even though later is the live one. Should pick `in_progress` first, else earliest `booked|arrived`. |
| PA-07 | `index.tsx:94-99` | Medium | Error display | `handleCancel` uses blocking `confirm()` (not a11y, no custom UI, browser suppression after repeated calls) and `cancelAppointment.mutate(id)` **without clinic scoping** — any patient who guesses a UUID can cancel any appointment (IDOR if RLS on `appointments.update` lacks `patient_email = auth.email()` check). Also no error UI beyond toast. |
| PA-08 | `index.tsx:100-104` | Medium | Session / cache | `handleSignOut` does `supabase.auth.signOut().finally(()=>{reset(); navigate("/")})`. Does **not** clear React Query cache (`queryClient.clear()`). On shared device, next user briefly sees previous patient’s cached appointments/queue until refetch. Call `queryClient.clear()` before `navigate`. |
| PA-09 | `index.tsx:121-126` | Medium | Button disabled | Cancel button `disabled={cancelAppointment.isPending}` uses **global** pending flag — while one row’s cancel is in-flight, **all** Cancel buttons disable. Use `variables===appointment.id && isPending`. |
| PA-10 | `index.tsx:115, 140-200, 174` | Medium | Errors / crashes | Date formatting `format(new Date(appointment.scheduledFor), ...)` throws `RangeError: Invalid time value` if `scheduledFor` is malformed/null. No `isValid` guard; one bad row crashes the whole portal. Wrap with `try` / `isValid` fallback (`—`). Same for `getSpecialization`. |
| PA-11 | `index.tsx:125-138` | Medium | Empty state / error | Only `appointmentsQuery.isPending` skeleton is shown. No handling for `isError` / `error` — fetch failure (RLS denied, network) renders “No upcoming appointments” (line 170-174) misleadingly instead of an error + retry. |
| PA-12 | `index.tsx:140, 165` | Medium | A11y / DOM | Two separate banners both use `id="patient-queue-banner"` (position banner + in-progress banner). When `todayAppointment.status==='in_progress'` both conditions can be true simultaneously if also `queuePosition>=0` (patient `in_progress` still in `waiting` array in mock) → duplicate `id` in DOM, `document.getElementById` returns first only, `checklist` scroll targets the wrong one, HTML invalid. Use unique ids or `data-testid`. |
| PA-13 | `index.tsx:80` | Low | Data | `getSpecialization` does `doctors.find(d=>d.id===appointment.doctorId)` — when `doctorId===""` (no preference, pending assignment) shows nothing, okay but should show “To be assigned”. |

### 2.2 `src/features/patient/components/getting-started-checklist.tsx`

This file is **high-signal** — checklist progress is driven by overly permissive client logic and persistent `localStorage` flags.

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| C-01 | `getting-started-checklist.tsx:50-64` | Medium | `useEffect` / race | Profile fetch uses `user?.accountNo` effect with no `cancelled` cleanup for the `.then`. Rapid account switch → previous fetch’s `.then` can overwrite `hasProfile` for the new user. Also initial `useState(true)` (line 51) optimistically marks profile done before evidence; flashes 100% then corrects. Should default `false` with loading state. |
| C-02 | `getting-started-checklist.tsx:55` | Medium | `useEffect` deps | Effect deps `[user?.accountNo, user?.email]` but `supabase.from('profiles').select` uses `user.accountNo` (truthiness check line 53) — if `user` reference rotates without email/accountNo change, effect re-runs unnecessarily. Minor but indicates fragile identity model. |
| C-03 | `getting-started-checklist.tsx:66-76` | Medium | Identity | `userName` derived as `(user as unknown as {name?:string})?.name ?? emailPrefix`. Typing cheat hides that `useAuthStore` user has no `name` field — falls back to email prefix, so `nameMatch` on appointments is actually email-prefix match, under-specific (`aisha` matches `aisha.bello@` vs `aisha@other.com`). Should prefer `profiles.full_name` when available. |
| C-04 | `getting-started-checklist.tsx:77-93` | **High** | `localStorage` / persistence | `hasLocalBookingFlag` reads `localStorage['mediq_has_booked']` + `mediq_has_booked_email` **synchronously in render**. (a) SSR-crash risk when `document` undefined (guarded by try but still per-render). (b) **Never expires** — permanent `true` even after appointment cancelled / rejected. (c) **Not clinic-scoped** — booking in clinic A marks checklist done in clinic B. (d) Cross-device: desktop books but mobile checklist stays incomplete → inconsistency. |
| C-05 | `getting-started-checklist.tsx:82-85` | High | Data / false-positive | `hasAppointment = hasLocalBookingFlag \|\| myAppointments.length>0 \|\| allAppointments.length>0 \|\| data.some(upcomingStatuses)`. The **`allAppointments.length>0` fallback** marks any patient as “has booked” if **any row** exists in the (RLS-scoped) list — e.g., an admin/doctor’s list leaks into patient view *or* RLS misconfig, one pending row from another patient in mock store marks you done. Masks scoping bugs and gives false celebration. |
| C-06 | `getting-started-checklist.tsx:96-108` | High | Logic / false-positive | `hasQueue = queue.some(name match) \|\| myAppointments.some(status in booked|arrived|in_progress|…)`. Fallback `myAppointments.some(... booked)` means **having a booked appointment alone marks queue done** even if patient never checked in — checklist lies. |
| C-07 | `getting-started-checklist.tsx:111-116` | Medium | Logic | `hasPassword = !!user` — any signed-in user marks “Set a secure password” done. Task is tautologically complete; progress bar is inflated by +25%. |
| C-08 | `getting-started-checklist.tsx:128-137` | High | A11y / nested interactive | Checklist row renders `<div role="button" tabIndex=0 onClick={scroll}>` **wrapping** a nested `<button>` (queue: `View`) **and** a `<Link to="/book">Go</Link>`. Nested interactives violate ARIA (screen readers announce “button inside button”, keyboard activation fires both). Parent `onClick` scrolls even when `Go` is clicked (stopPropagation works on `Link` but parent is still a `button` role → double-hit). Use plain `<li>` + separate actionable element, or `role="listitem"` only. |
| C-09 | `getting-started-checklist.tsx:142-157` | Low | UX | Queue row text `done ? 'View' : 'View'` — dead ternary, both branches `"View"`. Should differentiate: `"View"` vs `"Check status"`. |
| C-10 | `getting-started-checklist.tsx:118-126` | Low | Perf | `TASKS.filter(t=>isDone(t.id))` evaluated twice (doneCount + allDone) and again per-row inside `TASKS.map`. No memo — minor churn. |
| C-11 | `getting-started-checklist.tsx:34` | Low | Type | `href?: string` union is `/book | /change-password`; Link `to` accepts string but narrow typing lost. Acceptable. |

---

## 3. `src/features/booking/` — Public Booking Form · Success / QR · Checklist Integration

**File:** `src/features/booking/index.tsx` (single file holds both `<Booking>` + `<BookingSuccess>`)

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| B-01 | `booking/index.tsx:26` | Medium | Validation (zod) | `phone: z.string().min(7)` allows `"abcdefg"` and `"       "`. No regex `/^[\d+\s-]{7,}$/`; accepts non-phone strings. Booking repository will store garbage phone, SMS notifications (if enabled) will fail silently. |
| B-02 | `booking/index.tsx:27-28` | Low | Validation | `doctorId: z.string().optional()` — sentinel `"no_preference"` passes but so does `""` or any attacker-supplied UUID. No refine against `activeDoctors` ids. A forged `doctorId` for a different clinic would be sent to `bookingRepository.book` (see `onSubmit:121-130`). |
| B-03 | `booking/index.tsx:29` | Medium | Validation | `date: z.date({message})` correctly blocks empty, but `reason: z.string().max(300).optional()` allows 300-char XSS payload stored raw. Renders elsewhere as text (React escapes), but DB stores unsanitized HTML — email/SMS templates may render raw. Recommend `trim().max(300)` + strip `<` `>` client-side; server must also sanitize. |
| B-04 | `booking/index.tsx:50-73` | Info | Data grouping | `doctorGroups` groups by `doctor.specialization` but never checks for null/empty specialization. Doctors with null spec collapse under `undefined` heading. Low risk as seed always sets it. |
| B-05 | `booking/index.tsx:76-80` | Low | Validation | `availableTimeSlots` filters `slot.hour > currentHour` when `isToday`. No minimum lead time (e.g., <60 min); booking 15:59 for 16:00 still allowed though front desk cannot prepare. Also race: `new Date()` evaluated twice (isToday + currentHour) — if called across midnight, inconsistent. Cache `now = new Date()` once. |
| B-06 | `booking/index.tsx:82-87` | Medium | Button handler / error | `onSubmit` does `if(!slot) return` with **no user feedback** if `values.time` is tampered (e.g., `__proto__`). Form silently does nothing; user sees no error. Should `toast.error` or set field error. |
| B-07 | `booking/index.tsx:92-95` | **High** | Timezone / data | `scheduledFor.setHours(slot.hour,0,0,0)` uses **local device timezone** with explicit `TODO` comment. Clinic operates in `Africa/Lagos` (see `display-form.tsx:10`). Patient booking from `America/New_York` at 9 AM local will be stored as `14:00 UTC` (≈15:00 Lagos), shifting the slot + potentially colliding with another patient’s slot. Must construct date in clinic timezone (use `date-fns-tz` or send date+hour separately and let `book_appointment` RPC apply clinic TZ). |
| B-08 | `booking/index.tsx:106-109` | **High** | `clinic_id` scoping / RLS | `book.mutate({ ..., doctorId: doctor?.id, doctorName: doctor?.name, scheduledFor })` **never passes `clinicId`**. Component imports `useBookAppointment` which reads `clinicId` nowhere; `bookingRepository.book` receives `clinicId: undefined` → `p_clinic_id = null` → RPC’s `DEFAULT NULL` fallback resolves to “default clinic”. On multi-tenant deployments (clinic-specific slug/route), anon visitor on clinic B books into clinic A. Should resolve `clinicId` from URL slug / `useCurrentClinic` (when not anon, use `clinicId` from context; when anon, parse `window.location` slug or prop). |
| B-09 | `booking/index.tsx:111-116` | High | `localStorage` shape / expiry | Success handler writes `mediq_has_booked=true` + `mediq_has_booked_email` with **no expiry** and **no clinic scoping**. Flag persists forever, pollutes checklist globally, cross-clinic (see C-04). Should be session-only or `mediq_has_booked:<clinicId>` with TTL, or removed in favor of server state. |
| B-10 | `booking/index.tsx:117` | Low | Form reset | `form.reset()` on success resets to `defaultValues` (`doctorId:'no_preference'`, date `undefined`) but the UI immediately unmounts to `BookingSuccess`; reset is irrelevant shine — harmless. |
| B-11 | `booking/index.tsx:138-211` | Medium | Error display | `useDoctors()` `isPending` shows picker loading state, but `isError` is never surfaced. If `doctors` fetch fails (clinic scoping RLS), picker shows only “No preference” and empty specialty groups with no error message — user cannot pick a doctor and doesn’t know why. |
| B-12 | `booking/index.tsx:199` | Low | Disabled state | Time picker `SelectDropdown` has `isControlled + defaultValue={field.value}` but no `value` binding. When `availableTimeSlots` changes (date flipped), previously selected `time` that is now unavailable stays displayed. Should reset `time` field when date changes (`useEffect` to `setValue('time','')` if not in available slots). |
| B-13 | `booking/index.tsx:203-210` | Medium | Accessibility | `DatePicker disabled={(date)=>date<startOfDay(new Date())}` recomputes `startOfDay(new Date())` per call; okay. However calendar button lacks explicit `aria-label` describing disabled past dates — minor. |
| B-14 | `booking/index.tsx:263-271` | Medium | Fix-me | `book` mutation has **no `onError` handler** at call site. Network/RPC failure (duplicate slot, rate-limit, invalid doctor) → no toast, submit button just re-enables, user thinks click was ignored. Add `onError: (e)=>toast.error(e.message)`. |
| B-15 | `booking/index.tsx:285-292` | Low | UX | Submit button disables via `book.isPending` but still submits on Enter while already pending if user presses twice quickly before disabled propagates (race <1 frame). RHF `handleSubmit` guards re-entry, but still double-invoke RPC if called before mutation settles — server should enforce idempotency by (email, scheduled_for) unique constraint. |
| B-16 | `booking/index.tsx:305-337` | Medium | Validation | `passwordSchema` for BookingSuccess: `min(1, 'Please enter your password')` then `min(7, ...)` — order means empty password fails first message, correct. However `confirmPassword` `min(1)` plus refine mismatch: when both empty, two errors show but refine also triggers `Passwords don't match` → double error. Zod refine correctly `path:['confirmPassword']` adds second error on same field; UI shows duplicate. Harmless. |
| B-17 | `booking/index.tsx:362-372` | Medium | Security / disclosure | `signUp.mutate` `onError: toast.error(error.message)` surfaces raw Supabase error text (e.g., `duplicate key value violates constraint "profiles_email_key"`). Leaks DB internals. Map to friendly “An account with this email already exists.” |
| B-18 | `booking/index.tsx:380-395` | Low | Accessibility | Email field on success is `<Input value={email} disabled>` with `<FormLabel>Email</FormLabel>` but not linked via `htmlFor`/`id`. Screen readers don’t associate label. Add `id` + `aria-label`. Disabled input is non-focusable; okay but consider `readOnly`. |
| B-19 | `booking/index.tsx:352-355` | Low | Data | `email = appointment.patientEmail ?? ''` — when `undefined` (edge), disabled field is empty, “Create your password” CTA is shown but email is missing → Supabase sign-up will fail with “Invalid email”. Guard: only show password form when `email` non-empty; otherwise show “sign-in” fallback. |

---

## 4. `src/features/settings/` — Profile · Account · Display · Facility · Appearance · Notifications

### 4.1 `src/features/settings/index.tsx` (layout) + `components/sidebar-nav.tsx` + `components/content-section.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| S-01 | `components/sidebar-nav.tsx:20` | Low | A11y | `SelectValue placeholder="Theme"` — copy-paste error, should be `"Select section"` / `"Navigate"`. Mislabels the mobile settings nav for screen readers. |
| S-02 | `components/sidebar-nav.tsx:16-24` | Medium | `useEffect` / stale closure | `val` state `useState(pathname ?? '/settings')` initialized once; **never synced** when user navigates via browser back/forward or programmatic `navigate` outside Select. Select displays stale section while page content has changed. Add `useEffect(()=>setVal(pathname), [pathname])`. |
| S-03 | `components/sidebar-nav.tsx:47-55` | Medium | Routing | Active style `pathname === item.href` exact equality — navigating to `/admin/settings` with trailing slash (`/admin/settings/`) or search params fails to highlight Profile. Use `startsWith` or `useMatchRoute`. |
| S-04 | `components/sidebar-nav.tsx:51` | Low | A11y | Missing `aria-current="page"` on active Link. |
| S-05 | `components/content-section.tsx:9` | Low | Types | `children: React.JSX.Element` too narrow — rejects fragments/arrays. Should be `React.ReactNode`. |
| S-06 | `settings/index.tsx:12-26` | Medium | Approval (pre-existing hunt note) | `settings` route matrix: earlier hunts flagged `Bookings` missing `clinic_id` scoping — settings facility checkbox is similarly local-only (see F-02). Flagged for completeness. |

### 4.2 `src/features/settings/profile/profile-form.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| PR-01 | `profile-form.tsx:50-79` | Medium | `useEffect` deps / fetch | Effect deps `[user]` (object identity). Zustand selector returns new ref only on `setUser`; stable, but if `user.accountNo` changes without `user` ref change (impossible today, but fragile). Missing explicit dep `user?.accountNo` triggers lint warnings. |
| PR-02 | `profile-form.tsx:55` | Medium | Empty state | Early return `if (!user?.accountNo) return` **leaves `isFetching=true` forever** when user has no profile row (new patient, RLS). Skeleton shows indefinitely, no error, no retry. Set `isFetching(false)` on early return or handle null accountNo UI. |
| PR-03 | `profile-form.tsx:72` | Low | Data | Doctor lookup queries `doctors` by `email` with `.eq('email', user!.email)` case-sensitive. Supabase `email` is typically lowercased; case mismatch returns no row. Use `.ilike` or lower both sides. |
| PR-04 | `profile-form.tsx:87-92` | Low | Logic | `defaultName = profile?.full_name \|\| user?.email.split('@')[0] \|\| 'Staff'` recomputed per render; passed to `useForm defaultValues` once at mount (stale). Reset effect (line 106-113) patches it, but interim render briefly shows inconsistent default. Minor. |
| PR-05 | `profile-form.tsx:106-113` | Low | `useEffect` deps | Reset effect deps `[profile, isFetching]` — omits `form` and `user?.email`. ESLint would flag. Add `form` (stable) and stable string deps. |
| PR-06 | `profile-form.tsx:115-134` | **High** | `clinic_id` / RLS | `supabase.from('profiles').update(...).eq('id', user.accountNo)` — **no `clinic_id` predicate**. If RLS policy does not check `auth.uid() = id`, authenticated attacker who knows another user’s UUID can overwrite their profile (IDOR). Even with correct RLS, client should not assume ability to update arbitrary id. |
| PR-07 | `profile-form.tsx:136-149` | Medium | Loading / error | Skeleton condition `isFetching \|\| !profile` shows skeleton both while fetching and after error (profile stays null). `toast.error('Could not load profile')` is shown but UI never leaves skeleton, so user can’t retry or edit. Should set `isFetching=false` and show error card with retry. |
| PR-08 | `profile-form.tsx:170-216` | Low | A11y / styling | Role badges: `roleBadges.map(r=> r.charAt(0).toUpperCase()+r.slice(1))` for `"front_desk"` renders `"Front_desk"` (underscore kept). Use `replace('_',' ')`. Avatar `<div>` with initials lacks `aria-label="Avatar for …"` / `role="img"`. |

### 4.3 `src/features/settings/account/account-form.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| A-01 | `account-form.tsx:63-68` | **Critical** | Data / fake handler | Password submit `onSubmit={() => { passwordForm.reset(); toast.success('Password updated') }}` **never calls `supabase.auth.updateUser`**. Users think password changed; it never did. On next sign-in with new password → locked out. Must call `supabase.auth.updateUser({ password: values.newPassword })` and handle `currentPassword` re-auth if provider requires it. |
| A-02 | `account-form.tsx:22-24` | Medium | State / persistence | `marketingEmails`, `securityEmails` are `useState(true)` toggled locally, **never persisted** (no API, no cookie, no localStorage). Reload resets them. Silent data loss. |
| A-03 | `account-form.tsx:72-79` | **Critical** | Data / fake handler | `handleDeleteAccount` does `toast.success('Your account has been deleted.')` **without any DB/Auth call**. Account, clinic memberships, patient/appointment rows remain. User thinks GDPR erasure happened. Must call deletion edge function and sign out, or remove the UI until implemented. |
| A-04 | `account-form.tsx:73` | Low | Validation | Delete guard `confirmText !== 'delete'` case-sensitive; typing `Delete` fails silently (button stays disabled — correct behavior but missing helper text stating “all lowercase”). |
| A-05 | `account-form.tsx:16-30` | Low | Accessibility | `Switch` controls have `<Label>` peers but not `htmlFor`/`id`-linked; FormLabel for password fields is correctly associated, but email preference Labels are visual only. Use `id` on Switch + `htmlFor`. |

### 4.4 `src/features/settings/appearance/appearance-form.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| AP-01 | `appearance-form.tsx:32-44` | Low | Hydration / `localStorage` | Initial `useState(() => getCookie(...))` reads cookie sync in render. On SSR, `document` undefined → `getCookie` returns `undefined` → defaults `accent '#2563EB'` / `fontSize 1`. Post-hydration, real cookie may differ → flash / React hydration mismatch warning. Acceptable for CSR-only (Vite) but wrap in `useEffect` hydration guard if SSR added. |
| AP-02 | `appearance-form.tsx:33` | Medium | `localStorage`/cookie shape | `getCookie(ACCENT_COOKIE) ?? '#2563EB'` — if cookie value is invalid hex like `'red'` or attacker-set `'"; document.cookie="'` the CSS `--user-accent` will be set to garbage, potentially breaking theming. Missing validation against `ACCENT_COLORS` allowlist. Add allowlist check before applying. |
| AP-03 | `appearance-form.tsx:35-42` | Low | Error | `Number(getCookie(FONT_SIZE_COOKIE))` where cookie value may be `"%2F"` → `decodeURIComponent` may throw `URIError: URI malformed` (see `cookies.ts:16`). Uncaught exception during render crashes appearance page. Should `try/catch` cookie parse. |
| AP-04 | `appearance-form.tsx:38-42` | Medium | Perf / side effect | Two `useEffect`s each set `document.documentElement.style` + `setCookie` on every `accent`/`fontSize` change — but also run once on mount (initial state) causing an extra cookie write per visit. Harmless but generates I/O every load. |
| AP-05 | `appearance-form.tsx:60-79` | Low | A11y | Theme preview radio cards use `Label '[&:has([data-state=checked])>div]:border-primary'` styling — checked indication is **color/border only** (WCAG 1.4.1). Accent color dots only have `title` attribute; screen readers hear empty `sr-only` radio with no label text for color name. |
| AP-06 | `appearance-form.tsx:100-118` | Medium | A11y | Accent `RadioGroup` dots: `<Label title={color.name}><RadioGroupItem sr-only> + <span style bgColor>` — `title` is not conveyed to AT reliably; add `aria-label={color.name}` on the RadioItem. |

### 4.5 `src/features/settings/display/display-form.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| D-01 | `display-form.tsx:36-44, 65-68` | **High** | Persistence / fake handler | Every control is `useState` local; `handleSubmit` only does `toast.success('Display preferences updated')`. **Nothing persists** — language, timezone, 24h, itemsPerPage are lost on refresh. No `localStorage`, cookie, or profile PATCH. “Customizing settings does nothing” bug. |
| D-02 | `display-form.tsx:22-28` | Info | I18n not wired | Language selection `['en','yo','ha','ig']` has no i18n provider effect; timezones list is hard-coded but never fed to `format()` calls in patient/booking (they use local `new Date`). Settings are cosmetic. |
| D-03 | `display-form.tsx:66` | Low | Validation | `Select value` / `onValueChange` handlers assign untyped `string` (display-form passes `value:string` to setters) — safe here but bypasses the literal union of languages. |
| D-04 | `display-form.tsx:98-115` | Low | A11y | `Switch id="time-format"` correctly links `<Label htmlFor="time-format">` — correct. Good example vs account toggles. |

### 4.6 `src/features/settings/facility/facility-form.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| FA-01 | `facility-form.tsx:16-20` | Medium | Validation | `roomLabel: z.string().trim().min(1).max(24)` required **even when `trackRooms=false`**. When clinic disables room tracking, the label input is hidden (`facility-form.tsx:67-91`) but validation still requires a non-empty label. If user previously typed then cleared, then turned off tracking, submission fails even though field is hidden. Fix: `z.object({...}).refine(v=>!v.trackRooms || v.roomLabel.length>=1)` or `superRefine`. |
| FA-02 | `facility-form.tsx:32-37` | High | Scoping / persistence | `useFacilityStore` is `persist:{name:'mediq_facility'}` in `localStorage` **without clinic key** (`facility-store.ts:21-30`). Room label/toggle is per-browser, not per-clinic and not shared across staff devices. Clinic A sets “Ward” → clinic B’s admin sees “Ward” after switching. Cross-tenant contamination. Key should be `mediq_facility:${clinicId}` and backed by `clinic_settings` table RPC. |
| FA-03 | `facility-form.tsx:32` | Medium | Disabled state | Submit button never disables on `!form.formState.isValid` / `isSubmitting`; rapid double-click can fire `setTrackRooms` twice with race on `persist`. Add `disabled={form.formState.isSubmitting}`. |
| FA-04 | `facility-form.tsx:63` | Low | A11y | `Switch checked={field.value} onCheckedChange={field.onChange}` inside `FormItem` with `FormLabel` but not `id`/`htmlFor` linked — missing semantic association (compare display-form which links correctly). |

### 4.7 `src/features/settings/notifications/notifications-form.tsx`

| # | File:Line | Severity | Lens | Finding |
|---|-----------|----------|------|---------|
| NO-01 | `notifications-form.tsx:80-92` | Medium | Persistence | Hard-coded `defaultValues` with no fetch; `onSubmit` only `toast.success`, nothing persists. Same fake-success pattern as display/account. |
| NO-02 | `notifications-form.tsx:20-35` | Low | Validation | `quietHoursStart/End: z.string()` default `'21:00'`/`'07:00'`; refine only checks non-empty when `quietHoursEnabled`. If enabled and times are `'24:00'` (invalid time), passes — no `regex` for `HH:MM`. Browser `<Input type="time">` constrains but manual entry could bypass. Add `z.string().regex(/^\d{2}:\d{2}$/)`. |
| NO-03 | `notifications-form.tsx:45` | Low | A11y | `SwitchRow` helper renders `<FormLabel className="text-sm">` without `htmlFor`; Switch has no `id`. Same missing association pattern. |
| NO-04 | `notifications-form.tsx:87` | Low | Data | Notification channels (email/push/SMS) are booleans with no `clinic_id` scoping — org-wide notifications vs patient-specific are not distinguished; low concern as fake persistence hides the issue. |

---

## 5. Cross-Cutting Findings (Multiple Features)

### 5.1 `clinic_id` Scoping & RLS — Systematic Gap

| # | File:Line | Severity | Finding |
|---|-----------|----------|---------|
| X-01 | `data/supabase/repos.ts:84-102`, `124-…, 210-…` etc. | **High** | Every repository method takes `clinicId?: string` optional and **fails open** when omitted: `if (clinicId) query.eq(...)`; if caller passes `undefined` (e.g., `useAppointments` while `clinicId` is null, or anon `Booking` which never passes it), the `.eq` is skipped → **`select *` across all clinics**. Hooks mitigate via `enabled: !!clinicId`, but callers like `Booking` bypass the hook and call the repo directly without a clinic. Repos should be **fail-closed**: `if (!clinicId) throw new Error('clinicId required')` or return `[]` — never query without scoping. Verifies that every `list`/`create` enforces scoping server-side via RLS `clinic_id = current_setting('app.current_clinic')` check. |
| X-02 | `data/hooks.ts:36-42, 174-198` | Medium | `enabled: !!clinicId` quietly returns idle query (isPending `false`, data `undefined`). Components then render “No appointments” instead of loading or “Select a clinic”. Patient and Booking rendering fall through to empty states (see PA-11, B-11). Prefer showing loading `ClinicProvider.isLoading` spinner. |
| X-03 | `stores/auth-store.ts:55-92` | **High** | **Client-only RBAC from cookie** — `USER_COOKIE='mediq_user'` stores `JSON.stringify({accountNo,email,role,exp,clinicId,clinicRole})` plain text. Attacker with XSS (stored reason, name fields) can write `document.cookie='mediq_user='+JSON.stringify({role:['admin'],exp:Date.now()+1e12})` and escalate to admin with no server verification. Cookie has no HMAC/signature nor `HttpOnly`. Must be `HttpOnly`, signed by server or at least re-fetched from `supabase.auth.getUser()` + `clinic_members` on every route guard rather than trusted. Same issue in `clinic-context.tsx:77-94` where `user.email` is trusted for membership lookup (should use `authUser.id` exclusively — it already does for query, but email branch in `lastFetchedEmail` sync is extraneous). |
| X-04 | `data/hooks.ts:250-290` | Medium | Realtime scoping — `useRealtimeTable` builds `combinedFilter` as `and(clinic_id=eq.X,doctor_name=eq.Y)` (line 277-282). Supabase Realtime `filter` expects `column=eq.value` syntax; **multi-filter `and(...)` support is version-dependent and not documented**. If unsupported, subscription silently receives **all clinics’ events**, leaking cross-tenant queue activity via cache invalidation. Verify against `supabase-js` version; safer to open one channel per clinic and filter in `on postgres_changes` callback before invalidating. |

### 5.2 `localStorage` / `cookie` — Shape, Expiry, XSS

| # | File | Severity | Finding |
|---|------|----------|---------|
| X-05 | `booking/index.tsx:111`, `getting-started-checklist.tsx:78` | High | Keys `mediq_has_booked`, `mediq_has_booked_email` are **per-origin global** (no clinic suffix) with **no expiry** and **no integrity check**. Shadowing across clinics; permanent stickiness after booking then cancel. Should be `sessionStorage` or server-tracked flag. |
| X-06 | `lib/cookies.ts:13-20` | Medium | `getCookie` splits on `; ${name}=` — substring-safe in normal cases but `decodeURIComponent` on `parts.pop()?.split(';').shift()` can throw `URIError` on malformed encoding (e.g., user tampered `%` value), crashing any component that reads cookies (appearance, auth). Wrap decode in `try/catch`. |
| X-07 | `lib/cookies.ts:26-33` | Low | `setCookie` sets `SameSite=Lax` correctly and conditionally `Secure` on https — good. Missing `Partitioned` / `__Host-` prefix for stricter cross-site defense; okay at current risk. |
| X-08 | `stores/facility-store.ts:21` | Medium | `persist.name='mediq_facility'` — no clinic scoping, no TTL; see FA-02 cross-tenant contamination. |
| X-09 | `stores/auth-store.ts:20-23` | Medium | `ACCESS_TOKEN` cookie name is `thisisjustarandomstring` — obscurity, no semantics, risks collision. OK but should be `mediq_token`. |
| X-10 | `features/patient/index.tsx:78` (IDOR) | High | Cancel endpoint `cancelAppointment.mutate(id)` forwards raw `id` to `appointmentsRepository.updateStatus`. No confirmation that `id` belongs to the signed-in patient’s `clinicId`. Even with correct RLS, TOCTOU: user could enumerate UUIDs and attempt cancel; server must enforce `patient_email` ownership check and return 404, not 403 (to prevent oracle). |

### 5.3 `useEffect` Dependency Arrays & Stale Closures

| # | File:Line | Finding |
|---|-----------|---------|
| X-11 | `patient/index.tsx:32` — `useEffect(()=>{...}, [user, navigate])` — correct; `navigate` stable (TanStack). No missing deps. |
| X-12 | `landing/index.tsx:51` — Hero interval, `useEffect(timer, [activeIndex])` reset-on-change intentional — correct. |
| X-13 | `settings/profile/profile-form.tsx:106` — reset effect omits `form`, `user?.email`. Stale closure if `user.email` changes while profile open (edge). |
| X-14 | `settings/components/sidebar-nav.tsx:16` — `useState(pathname)` without effect syncing → stale `val` (see S-02). Classic missing-dep bug. |
| X-15 | `appearance-form.tsx:38,44` — Effects depend only on `accent`/`fontSize` — correct; intentionally write-through to cookie + DOM. |
| X-16 | `clinic-context.tsx:140-194` | Effect `useEffect(user fetch logic, [user, fetchMemberships])` — `fetchMemberships` stable via `useCallback([setUser])`. `setUser` is Zustand stable, so memo holds. `lastFetchedEmail` ref prevents dupe fetches but can retain stale email across re-mount → clinic context stale after second auth user change without slug. |

### 5.4 Accessibility & Empty States

| # | File:Line | Severity | Finding |
|---|-----------|----------|---------|
| X-17 | `booking/index.tsx:168-250` | Low | `SearchableSelect` (imported, not inspected) — verify it exposes `aria-expanded`, `aria-controls`, `role="listbox"` for searchable combobox. Booking form’s doctor helper text is visible but not linked via `aria-describedby`. |
| X-18 | `patient/index.tsx:170-174` | Medium | Empty state for upcoming is present & helpful; **past empty has no message** (section omitted). Consistent empty states aid a11y. |
| X-19 | `settings/display` / `account` / `notifications` | Medium | All settings pages show no error/loading states because they are fake-local. When wired to backend, ensure `isError` slots exist to avoid same silent “No appointments” class bug. |
| X-20 | `landing/index.tsx:114-134` / `booking/index.tsx:280-285` | Low | Buttons with icons (`CalendarCheck`, `Loader2`) have visible text sibling, so `aria-hidden` on icon not strictly required, but Lucide icons default hidden? Ensure `aria-hidden="true"` on decorative icons. `FloatIcon` does set `aria-hidden='true'` correctly. |
| X-21 | `patient/index.tsx:49-62` | Low | Upcoming list has no `aria-live="polite"` region. New approvals arriving via realtime invalidations will be announced only visually; screen reader users get no cue. Consider `aria-live` on list container. |

---

## 6. Summary Checklist by Lens (for regression)

- **Buttons:** `NavBar` Book sheet not auto-closing (N-03), Cancel global disable (PA-09), booking double-submit race (B-15), facility submit never disabled (FA-03).
- **Forms / zod:** phone non-numeric (B-01), doctorId forged (B-02), time tamper silent return (B-06), display/facility conditional validation (D-01/FA-01), notifications time regex (NO-02).
- **`clinic_id` / RLS:** repos fail-open when no clinic (X-01), booking never sends clinic (B-08), patient portal client-side filter only (PA-02), profile update no scoping (PR-06), cancel IDOR (X-10), facility local-only (FA-02), checklist local flag cross-clinic (X-05).
- **`useEffect`:** Hero & Unified correct, profile reset stale (PR-05), sidebar Select stale (S-02), checklist fetch race (C-01).
- **`localStorage`/`cookie`:** forever flags (C-04/X-05), no clinic key (FA-02/X-08), cookie XSS hijack (X-03), decode URIError (X-06).
- **A11y:** active-link `aria-current` missing (N-01/S-04), Switch label associations (A-05/FA-04/AP-05), pricing Switch labeling (P-02), nested interactive inside checklist row (C-08), `title` vs `aria-label` on accent dots (AP-06).
- **Empty states:** patient pending-in-upcoming ambiguity (PA-03), queue called invisible (PA-05), booking doctors error hidden (B-11), profile infinite skeleton (PR-07).

---

## 7. What Was *Not* Re-checked (previous reports, out of scope)

No re-verification of `src/features/appointments`, `doctors`, `queue`, `rooms`, `staff`, `dashboard`, `auth/*`, `check-in`, `change-password`, `create-clinic`, `errors` — assumed covered by prior bounty. This report is additive only.

---

## 8. Suggested Fix Priority (no code changes made in this pass)

1. **Immediate (Critical):** Wire `account-form` password & delete handlers to Supabase (`A-01`, `A-03`); fix `clinic_id` fail-open in `supabase/repos.ts` (X-01) + `Booking` clinic scoping (B-08); fix queue name-only matching (PA-04).
2. **Next:** Harden `auth-store` cookie trust (X-03), add `clinicId` to facility persistence (FA-02), move checklist off `localStorage` (C-04/X-05), surface booking/doctors/patient fetch errors (B-11/PA-11/PR-07).
3. **Polish:** `useEffect` stales (S-02/PR-05), pricing copy (P-01), nested interactive a11y (C-08), Switch label wiring, duplicate `id` (PA-12).

---

*Report written to `docs/reports/bug-bounty-landing-patient.md`. Raw tool output contains file:line citations for each issue. No code was modified.*
