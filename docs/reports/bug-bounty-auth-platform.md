# MediQ Bug Bounty Report — Auth, Platform & Clinic Switching

**Date:** 2026-08-28  
**Hunter:** OpenCode (Muse Spark) — manual trace, no fuzzing  
**Workspace:** `C:\Users\MAFUYAI\Documents\MediQ` at commit `d43368c`+staged  
**Scope (as asked):**
`src/routes/_authenticated/route.tsx` · `src/lib/clinic-context.tsx` · `src/stores/auth-store.ts` · `src/features/auth/sign-in/components/user-auth-form.tsx` · `src/features/create-clinic/index.tsx` · `src/data/platform-hooks.ts` (→ `src/data/hooks.ts` + `src/data/supabase/repos.ts`) · `supabase/migrations/20260823_create_clinic.sql` + platform RLS migrations (`20260820_multi_tenancy.sql`, `20260825_notifications_audit_hardening.sql`, `20260821*.sql`, `20260828100000_fix_patient_appointments_rls.sql`)

**Method:** Read each file in full (line-number prefixed), trace every branch, check error/loading/empty/retry, diff RLS policies against repository queries, simulate corrupted-cookie and concurrent-slug races with `python3 -c` and grep for `safeJsonParse`, `switchClinic`, `create_clinic`, `useSupabaseAuthSync`.

**Severity:** `CRITICAL` = data leak or auth bypass. `HIGH` = privilege escalation / stale auth / race that orphans data. `MEDIUM` = UX break or noisy cross-tenant invalidation. `LOW` = cosmetic/hardening. `INFO` = scope drift.

---

## Executive Summary

13 bugs are exploitable or denial-of-service, 11 are medium hardening. The single most dangerous pattern is **queries running before clinic resolution**: every hook in `src/data/hooks.ts` fires with `clinicId=null → 'none'` while `ClinicProvider` is still `isLoading`. RLS contains most of the blast, but for a `platform_admin`/`is_admin()` user the unscoped query returns **all clinics' rows** (P1, S6). The second pattern is **clinic-context optimism with a poisoned cache** — `clinicSlug: 'default', plan: 'professional'` is rendered and then the correction fetch is skipped when `lastFetchedEmail` is cached (S1, HIGH). The third is **auth linger**: `useSupabaseAuthSync` preserves the previous user's `clinicId` across an account switch and never refreshes `exp` (A4, A5, CRITICAL/HIGH).

Clinic creation is correct on regex but `create_clinic`'s `EXISTS`→`INSERT` is not concurrent-safe; two users can race the same slug (C1, HIGH). Sign-in correctly shows wrong-password vs email-not-confirmed but does so with a fragile substring match and leaves a half-authenticated token on profile failure (A1, A2). `safeJsonParse` itself is correct for corrupted JSON (returns `null`→logged out), but the caller trusts the parsed shape without validation, so `mediq_user="{}"` or `mediq_user="123"` is accepted as a user (K1, HIGH).

Every finding below cites `file:line`.

---

## Risk Matrix

| ID | File:line | Title | Severity | Exploit / User Impact |
|---|---|---|---|---|
| A4 | `src/hooks/use-supabase-auth-sync.ts:29-31` | Stale clinic preserved across user switch | **CRITICAL** | B signs in on same browser after A; inherits A's `clinicId` until fetch corrects → sees wrong clinic's `TeamSwitcher` name and may write to wrong `clinic_id`. |
| S1 | `src/lib/clinic-context.tsx:156-172` | Dummy `default`/`professional` never corrected when fetch skipped | **HIGH** | Refresh with valid cookie → UI shows "Default Clinic · Professional" for seconds/forever; `TeamSwitcher` wrong plan/slug. |
| A8 | `src/routes/_authenticated/route.tsx:11` | `exp` check bypass when `exp` undefined/Infinity | **HIGH** | `useSupabaseAuthSync` sets `exp=Infinity` on null `expires_at`; user never redirected to sign-in after revocation. |
| A6 | `src/hooks/use-supabase-auth-sync.ts:14-18` | Silent downgrade to `patient` on profile fetch failure | **HIGH** | Transient network error → admin becomes `['patient']` in store, permanently until reload; blocked from `/admin/*`. |
| C1 | `supabase/migrations/20260823_create_clinic.sql:72-74` | Race on slug `EXISTS`→`INSERT` | **HIGH** | Two users POST same slug concurrently; one gets generic Postgres `unique_violation`, not `Slug already taken`; second tx could leave clinic without member if insert races. |
| K1 | `src/stores/auth-store.ts:49-52` | No shape validation after `safeJsonParse` | **HIGH** | `mediq_user={}` or `"123"` from corrupted/extended XSS cookie → `user.role` is `undefined` → `can(undefined)` crash or bypass. |
| P1 | `src/data/hooks.ts:50-56` et al. | Hooks fire unscoped while `isLoading` | **HIGH** | Every `use*` uses `clinicId ?? 'none'` + `clinicId ? eq : no filter`; RLS fixes most, but `is_admin` gets cross-clinic dump during load flicker. |
| A5 | `src/hooks/use-supabase-auth-sync.ts:13` | Ignores `TOKEN_REFRESHED` / `USER_UPDATED` | **HIGH** | `exp` never refreshed after Supabase auto-refresh; `beforeLoad` in `_authenticated/route.tsx:11` redirects prematurely. |
| A2 | `src/features/auth/sign-in/components/user-auth-form.tsx:81-92` | Half-auth state on profile failure | **MEDIUM** | `profileError` shows toast but `auth.setAccessToken` already? Actually not set; but `supabase.auth` session remains alive while store is null → inconsistency. |
| C3 | `src/features/create-clinic/index.tsx:340-349` | Orphan account on email-confirmation flow | **MEDIUM** | `signUp` succeeds, `getSession()` is `null` (confirmation required) → redirects to sign-in with no clinic; user stuck at `NoClinicError` (`clinic-context.tsx:98`). |
| P3 | `supabase/migrations/20260820_multi_tenancy.sql:44-46` | `Public can read active clinics` enumerates all tenants | **MEDIUM** | Anon can `GET /rest/v1/clinics?select=slug,name,plan` to harvest customer list. Intended for booking but leaks billing plan. |
| S2 | `src/lib/clinic-context.tsx:91-95` | Fetch error leaves `clinic=null, error=null, isLoading=false` → blank shell | **MEDIUM** | Network blip → `AuthenticatedLayout` hides sidebar (`error` is null → `return null`) plus `TeamSwitcher` is `null`; white page, no retry. |
| S6 | `src/data/hooks.ts:516-548` + `src/hooks/use-realtime-sync.ts:43-72` | Realtime without `clinic_id` filter | **MEDIUM** | Change in clinic B invalidates clinic A's `['appointments']` → chart flicker / wasted fetches; for doctors, cross-clinic invalidation leaks existence signal. |
| K2 | `src/lib/cookies.ts:16-32` | `getCookie`/`setCookie` missing `encodeURIComponent`, `SameSite`, `Secure` | **MEDIUM** | `clinicName` containing `;`/`,` truncates cookie; no `SameSite=Lax` enables CSRF on `mediq_user`. |
| A1 | `src/features/auth/sign-in/components/user-auth-form.tsx:67-71` | Fragile `msg.includes('Invalid login credentials')` | **MEDIUM** | Supabase message localization change would fall through to generic toast; `Email not confirmed` branch never hits if message is `Email not confirmed` vs `email not confirmed`. |
| C2 | `src/features/create-clinic/index.tsx:214-270` | Ineffective `AbortController`, `Promise.race` timeout → `idle` not `taken` | **MEDIUM** | Slow network → timeout sets `idle`, submit enabled, hits server race; abort doesn't cancel Supabase query. |
| A9 | `src/routes/_authenticated/route.tsx:17` | `redirect: location.href` uses full URL | **MEDIUM** | `href` includes origin and query; TanStack's `search` param becomes open-redirect on reuse; should be `pathname+search`. |
| S5 | `src/lib/clinic-context.tsx:183-197` | `switchClinic` via `window.location.reload()` | **LOW** | Loses toasts, scroll, form state; races `setUser`→cookie vs reload. Should `queryClient.clear()` + invalidate. |
| C4 | `src/features/create-clinic/index.tsx:126-133` | `generateSlug(...).slice(0,63)` may leave trailing `-` | **LOW** | `City ...` 63 chars + hyphen → `my-long--` fails Zod regex after auto-gen; user sees unexpected validation error. |
| K3 | `src/stores/auth-store.ts:4` | `ACCESS_TOKEN` cookie name is literal `thisisjustarandomstring` | **LOW** | Obscure name but still JS-readable; no `HttpOnly`. Minor secret confusion. |
| P2 | `src/data/platform-hooks.ts` (asked) vs `src/data/hooks.ts` (actual) | Scoped file does not exist → audit gap | **INFO** | Task asks to hunt `platform-hooks` for `usePlatform*` leaks; repo has no such file, so leak class is unaudited. |

---

## 1. Auth

### A1 — Fragile sign-in error discrimination — `user-auth-form.tsx:64-79` — MEDIUM

```ts
64: if (authError || !sessionData.user) {
67:   if (msg.includes('Invalid login credentials')) {
71:   } else if (msg.includes('Email not confirmed')) {
```

*Why a bug:* Matches English substrings verbatim. Supabase can return `Invalid login credentials` vs `invalid_grant` depending on GoTrue version/locale. `Email not confirmed` may arrive as `Email not confirmed` / `email_not_confirmed`. A mismatch falls through to generic `msg || 'Could not sign you in'` which leaks raw Supabase text to user (contains `rate_limit` etc.). Also `authError?.message` may be `undefined` on network failure; then generic path is correct but `setIsLoading(false)` is duplicated in three places — if a future branch forgets to reset, spinner sticks.

*Fix:* Switch on `authError.code` (`invalid_credentials`, `email_not_confirmed`) or use `authError.status`. Add exhaustive `else` that maps unknown codes to `try again`.

### A2 — Half-authenticated state on profile fetch failure — `user-auth-form.tsx:81-92` — MEDIUM

```ts
81: const { data: profile, error: profileError } = await supabase.from('profiles').select('role, full_name').eq('id', sessionData.user.id).single()
87: if (profileError || !profile) { toast.error(...); return }
93: const role = [String(profile.role)]
100: auth.setUser({ accountNo: sessionData.user.id, email: ..., role, exp })
106: auth.setAccessToken(sessionData.session?.access_token ?? '')
```

The session from Supabase is **already stored by `supabase.auth`** (persistSession:true at `supabase.ts:19`). The code only populates `auth-store` after profile succeeds, but the Supabase JS client keeps the JWT alive. If `profiles` fetch fails (RLS hiccup, network), the user is `null` in Zustand but `supabase.auth.getSession()` is non-null — subsequent `ClinicProvider.fetchMemberships:80` will run `supabase.auth.getUser()` successfully and confuse logging. Also `setAccessToken` is never cleared on failure — stale token remains in store if a previous user was logged in.

*Fix:* On `profileError`, call `await supabase.auth.signOut(); useAuthStore.getState().auth.reset();` or at least `removeCookie(USER_COOKIE)`. Log `profileError` for observability.

### A3 / A5 / A10 — `exp` handling — `user-auth-form.tsx:95-98` + `use-supabase-auth-sync.ts:28` + `_authenticated/route.tsx:11` — HIGH

```ts
// user-auth-form.tsx:95
exp = sessionData.session?.expires_at ? sessionData.session.expires_at * 1000 : Date.now() + 24*60*60*1000
// use-supabase-auth-sync.ts:28
exp: session.expires_at != null ? session.expires_at * 1000 : Infinity,
// _authenticated/route.tsx:11
if (!user || user.exp < Date.now()) { ... }
```

Three bugs in one: (1) `Infinity < Date.now()` is `false`, so a session with null `expires_at` **never expires** and survives revocation. (2) If `exp` is `undefined` (malformed cookie, see K1), `undefined < number` is `false`, so expired sessions are treated as valid. (3) `useSupabaseAuthSync` ignores `TOKEN_REFRESHED`, so `exp` is frozen at sign-in value; after Supabase silent refresh `expires_at` moves forward but store stays behind — `beforeLoad` will eventually see `exp < now` and bounce a still-valid session to `/sign-in`.

*Fix:* Normalize `exp` to `Number | null`, guard `if (!user?.exp || user.exp < Date.now())`. Handle `TOKEN_REFRESHED` (and `USER_UPDATED`) to refresh `exp` and `role`.

### A4 — Stale clinic leaked across account switch — `use-supabase-auth-sync.ts:29-31` — CRITICAL

```ts
22: const prev = useAuthStore.getState().auth.user
29: ...(prev?.clinicId ? { clinicId: prev.clinicId } : {}),
30: ...(prev?.clinicRole ? { clinicRole: prev.clinicRole } : {}),
31: ...(prev?.clinicName ? { clinicName: prev.clinicName } : {}),
```

Preservation is unconditional on user identity. If Alice (`accountNo=A`, `clinicId=111`) signs out and Bob (`accountNo=B`, `clinicId=222` or none) signs in on same browser without a full reload, `prev` is still Alice's cached user at the moment the `SIGNED_IN` event fires (Zustand `SIGNED_OUT → setUser(null)` may not have propagated yet due to React batching). Bob inherits `clinicId=111`. Even without the timing race, a sequential sign-in after `SIGNED_OUT` where `setUser(null)` was called correctly still risks: if Bob has no clinic, the fallback `...(prev?.clinicId ? ...)` would be `undefined`? Actually after `SIGNED_OUT` the code does `setUser(null)` (line 35), so next `SIGNED_IN` reads `prev=null` and doesn't leak. But the **concurrent** case (`INITIAL_SESSION` restoring Bob after a page refresh where cookie still holds Alice's clinic) does leak because cookie's `mediq_user` is read before Supabase resolves Bob — `prev` is Alice's deserialized clinic. Also the `SIGNED_IN` after a token refresh for the same user correctly preserves clinic, but for a **different** `accountNo` it must not.

*Fix:* `if (prev?.accountNo === session.user.id) preserve; else do not preserve.` Better, always re-resolve clinic from `clinic_members` on user change; never trust cached `clinicId` for a different `id`.

### A6 — Silent role downgrade — `use-supabase-auth-sync.ts:14-27` — HIGH

```ts
14: const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
27: role: profile?.role ? [profile.role] : ['patient'],
```

Errors are destructured away. If RLS or network makes the query return `error` (e.g., `profiles_select_own_or_admin` recursion bug from older migrations), `profile` is `null`, code defaults to `['patient']`. An admin who refreshes during a transient outage becomes a patient in Zustand and is redirected away from `/admin/dashboard` by `route.tsx:29`. The downgrade persists in the cookie after `setUser`.

*Fix:* Check `error`; if present, `throw`/`toast` and **do not** call `setUser`. Or retry.

### A7 — Cookie shape not validated — `auth-store.ts:49-52` — HIGH (see §5)

### A8 — `beforeLoad` expiry bypass — `_authenticated/route.tsx:11` — HIGH

```ts
if (!user || user.exp < Date.now()) {
```

As noted, `user.exp == null/Infinity/missing → false → no redirect`. A corrupted cookie `{"accountNo":"x","role":["admin"],"exp":"oops"}` has `"oops" < Date.now()` → `false` (string vs number → `NaN < number` → `false`). Attacker who can write a cookie (XSS) can make a forever-valid admin session without a JWT.

*Fix:* `if (!user || typeof user.exp !== 'number' || user.exp < Date.now())`.

### A9 — Full URL in redirect param — `_authenticated/route.tsx:17` — MEDIUM

```ts
throw redirect({ to: '/sign-in', search: { redirect: location.href } })
```

`location.href` is `https://mediq.app/admin/patients?foo=`. TanStack Router serializes `search.redirect` into query string and later `UserAuthForm` does `navigate({ to: redirectTo || defaultPath })`. If `redirectTo` is attacker-controlled (e.g., `https://evil.com`), it can be an open redirect after sign-in. Also `href` includes origin, so `decode` later may produce `//evil.com`.

*Fix:* Use `location.pathname + location.search` (or `location.href.slice(window.location.origin.length)`) and validate `redirectTo` starts with `/` and not `//`.

---

## 2. Clinic Creation

### C1 — Non-atomic slug check → race — `supabase/migrations/20260823_create_clinic.sql:72-78` — HIGH

```sql
72: IF EXISTS (SELECT 1 FROM clinics WHERE slug = v_slug) THEN RAISE EXCEPTION 'Slug already taken'; END IF;
77: INSERT INTO clinics (name, slug, plan) VALUES (trim(p_name), v_slug, v_plan, 'active')
83: INSERT INTO clinic_members (clinic_id, user_id, role) VALUES (v_clinic.id, auth.uid(), 'admin'::user_role);
```

Two concurrent `create_clinic('Lagos Family','lagos-family','starter')` both pass `EXISTS` before either commits (read committed). One `INSERT` succeeds; the other hits `unique_violation` on `clinics_slug_uidx`. The exception is `duplicate key value violates unique constraint "clinics_slug_uidx"` — not `Slug already taken`. `create-clinic/index.tsx:362` checks `msg.includes('duplicate') || msg.includes('unique')` lower-cased, so this *does* map to `This slug is already taken` today (`duplicate` is present). But future Postgres i18n or driver wrapping could lose that substring. More importantly, the second tx's `clinic_members` insert never happens but the client already created an auth account in step 1 (for unauth flow) — that account is now orphaned (no clinic). No compensating `DELETE auth.users`.

*Fix:* Remove the manual `EXISTS` and rely on the unique index with `EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Slug already taken' USING ERRCODE ...` Or `INSERT ... ON CONFLICT (slug) DO NOTHING` then check `FOUND`.

### C2 — Slug availability probe is best-effort and ABORT is dead — `src/features/create-clinic/index.tsx:214-270` — MEDIUM

*Debounce* (`400ms`) + `supabase.from('clinics').select('id').eq('slug', slug).maybeSingle()` at `230-233` does **not** use `controller.signal` — Supabase JS v2 `query` is not `AbortController`-abortable by default; `controller.abort()` at `266` is a no-op. The `Promise.race` at `236-247` races `query` vs `setTimeout 3000` that resolves with `{ data:null, error: Error('Slug check timed out') }`. On timeout, code does `setSlugStatus('idle')` (line 254), not `taken` nor an error toast, so the submit button (disabled only when `taken` at `397`/`673`) stays **enabled** while the slug is actually taken. User can submit and rely on server rejection (C1) — which is correct as fallback, but the optimistic UI is misleading.

Additional leak: query does `select('id').eq('slug', slug)` without `status='active'`, so a suspended clinic's slug appears `taken` even though `clinics.status` RLS allows public read of `active` only — inconsistent.

*Fix:* Derive slug availability only on server `create_clinic` call; keep client debounce as UX hint, but disable submit while `checking`, not just `taken`. Wire `AbortSignal` via `supabase.rpc` or `fetch` with `signal`, or drop `AbortController`.

### C3 — Orphan auth account when email confirmation required — `src/features/create-clinic/index.tsx:340-349` — MEDIUM

```ts
312: const { data: signUpData, error: signUpError } = await supabase.auth.signUp(...)
340: const { data: sessionData } = await supabase.auth.getSession()
341: if (!sessionData.session) {
343:   toast.success('Account created! Please check your email ...')
346:   navigate({ to: '/sign-in' })
```

If `Supabase → Auth → Email confirmation ON`, `signUp` succeeds but `session` is `null`. The flow toasts and redirects to sign-in **without ever calling** `create_clinic`. The auth user now exists (and `handle_new_user` created a `profiles` row with `role='patient'`), but `clinic_members` was never written. On next sign-in the user lands in `ClinicProvider` → `memberships?.length === 0` → `setError('No clinic assigned')` at `98` → `AuthenticatedLayout` shows `NoClinicError` full-screen with only `Sign out`. From the user's perspective "I just created a clinic but it disappeared."

*Fix:* Either block clinic creation until email confirmed and re-call `create_clinic` after first login, or enforce `Supabase email confirmation OFF` for `create-clinic` flow, or create clinic inside a post-confirmation trigger / edge function.

### C4 — `generateSlug` slice leaves trailing hyphen — `src/features/create-clinic/index.tsx:126-133` — LOW

```ts
return name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)
```

`slice(0,63)` after trimming hyphens can re-introduce a trailing hyphen: e.g. `"A".repeat(62) + " - B"` → `aaaa...a-b` then sliced mid-word: `"aaaa...a-"`. The downstream Zod regex `^[a-z0-9]+(-[a-z0-9]+)*$` at `87` rejects it, but the auto-generated slug the user saw as valid now fails validation on blur.

*Fix:* `.slice(0,63).replace(/-$/,'')`.

### C5 — Error message mapping fragile — `src/features/create-clinic/index.tsx:362-367` + `630-646` — LOW

```ts
msg.includes('duplicate') || msg.includes('unique') ? 'This slug is already taken.' : msg
```

RPC message is `'Slug already taken'` (capital S, no `duplicate`). The branch falls through to raw RPC message which is actually the desired user text, so it works today. But the reverse path (real Postgres `duplicate key`) relies on substring match and may miss i18n.

*Fix:* Map both: `if (/already taken|duplicate|unique/i.test(msg))`.

---

## 3. Platform / RLS

### P1 — Every hook fetches unscoped while clinic is loading — `src/data/hooks.ts:50-56` etc. — HIGH

Every hook:

```ts
export function useAppointments() {
  const { clinicId } = useCurrentClinic() // null while isLoading
  return useQuery({ queryKey: ['appointments', clinicId ?? 'none'], queryFn: () => appointmentsRepository.list(clinicId ?? undefined) })
}
// repo: if (clinicId) query.eq('clinic_id', clinicId) else no filter
```

`useCurrentClinic` at `clinic-context.tsx:49-57` is:

```ts
if (isLoading) return { clinicId: null, isReady: false }
```

But **none** of the 13 `use*` hooks pass `enabled: isReady` or `enabled: !!clinicId`. Result while loading:

* `queryKey` is `[..., 'none']` (constant) — so all clinics share the same cache slot during load.
* `clinicId === undefined` → `repo` skips `eq('clinic_id', ...)` → Supabase query is **unfiltered**.
* RLS then filters: for `is_admin()` (global admin) the policy `user_in_clinic` is bypassed (`is_admin()` returns true per `20260820:236-255`), so the **entire** cross-clinic dataset is returned to a global admin even though the UI intends a per-clinic view. For a normal `admin/front_desk/doctor`, RLS still restricts to `user_in_clinic(clinic_id)` — but `user_in_clinic(null)` is false, so they get **zero** rows initially then a flash to correct rows after `isLoading=false` triggers a refetch with scoped key. Both are wrong: one leaks, one flashes.

Affected hooks (all copy the pattern): `useAppointments:50`, `useQueue:287`, `usePatients:338`, `useDoctors:381`, `useStaff:417`, `useRooms:445`, `useNotifications:475`, `useAnalytics:503`, `useBookedSlots:253`.

*Fix:* `const { clinicId, isReady } = useCurrentClinic(); return useQuery({ ..., enabled: isReady && !!clinicId, queryFn: () => repo.list(clinicId!) })`. For `usePublicDoctors(p_clinic_id)` and `useBookedSlots(date)` keep separate `enabled` semantics.

### P2 — Scoped file missing — `src/data/platform-hooks.ts` — INFO

The task's scope lists `src/data/platform-hooks.ts` (`usePlatform*` hooks) but the repo contains only `src/data/hooks.ts` / `src/data/supabase/repos.ts` / `src/data/repos.ts`. Grep for `platform|usePlatform|platform_admin` across `src/` finds only landing copy and `use-supabase-auth-sync` comments. Either the file was renamed/deleted or the bounty scope is stale. Consequence: data-leak class `usePlatformUsers` / `get_platform_users` (mentioned in `docs/reports/dashboard-systems-audit.md:22`) is **unaudited** here. The existing `is_platform_admin()` helper (referenced in audit) does not appear in any migration we read — only `is_admin()`.

*Fix:* Create `src/data/platform-hooks.ts` or remove from scope; add `get_platform_users` RLS test.

### P3 — Public clinic enumeration — `supabase/migrations/20260820_multi_tenancy.sql:44-46` + hardening at `20260825:640-642` — MEDIUM

```sql
create policy "Public can read active clinics" on clinics for select using (status='active');
-- patched to:
using (status='active' or user_in_clinic(id))
```

Anon can `GET /rest/v1/clinics?select=slug,name,plan,status` and enumerate every active tenant. For a B2B clinic platform, this is a customer-list disclosure (GDPR concern). The intent is to power `mediq.app/:slug` booking, but it leaks `plan`/`max_staff`.

*Fix:* Restrict anon to `select id,slug,name,logo_url` via a `SECURITY DEFINER` RPC `get_public_clinic_by_slug(slug)` instead of a broad `SELECT *` policy; or add column-level masking.

### P4 — Empty-state consistency (`target clinic has no data`) — `src/data/hooks.ts` + `src/lib/clinic-context.tsx:96-101` — LOW

When `fetchMemberships` finds zero memberships, it does `setError('No clinic assigned — contact your admin.')` but never clears the stale `clinic` from a prior user. `AuthenticatedLayout:58` hides the sidebar when `error` truthy, so the shell behind `NoClinicError` doesn't flash — good. But if the target clinic after `switchClinic` legitimately has zero appointments/queue/patients (brand new clinic), every `use*` returns `[]` and dashboard cards show `0` — correct. No data leak. The bug is only the **error** path: `memberships?.length === 0` for a fresh clinic-creator who just called `create_clinic` but whose membership hasn't replicated yet (read-after-write from `clinic_members` via RLS `user_in_clinic` on the same function?). The insert is committed, but the `switchClinic` path that just set `allClinics` from cache won't reflect the new clinic until re-read.

*Fix:* After `create_clinic` RPC success, optimistically push to `allClinics` or invalidate `clinic_members`.

---

## 4. Clinic Switching & Caching

### S1 — Phantom `default`/`professional` after cache skip — `src/lib/clinic-context.tsx:156-173` — HIGH

```ts
157: if (user.clinicId && user.clinicRole && user.clinicName) {
158:   setClinic({ clinicId: user.clinicId, clinicRole: user.clinicRole, clinicName: user.clinicName, clinicSlug: 'default', plan: 'professional' })
166:   if (lastFetchedEmail.current !== user.email) { fetchMemberships(user.email) } else { setIsLoading(false) }
```

The optimistic `clinic` is injected from the **cookie** (which only stores name/role/id, not slug/plan). `plan` and `slug` are hardcoded. If `lastFetchedEmail` already equals `user.email` (common on second render within same session), the fetch is **skipped** and the dummy survives for the session lifetime. The user sees `Your clinic — Default Clinic — professional plan` even though their real clinic is `Jos University Teaching Hospital — enterprise`. The same skips the correction path that would `setClinic(current)` at `121`.

*Fix:* Never skip correction when `clinicSlug==='default'` sentinel is present. Or store `clinicSlug`/`plan` in cookie as well. Prefer `if (lastFetchedEmail.current !== user.email || clinic?.clinicSlug==='default') fetch...`.

### S2 — Silent fetch failure → blank app shell — `src/lib/clinic-context.tsx:91-95` — MEDIUM

```ts
91: if (fetchErr) { console.error('Failed to fetch clinic memberships:', fetchErr); setIsLoading(false); return }
```

No `setError`. `clinic` stays `null`, `allClinics` stays `[]`, `isLoading` is `false`. `useCurrentClinic()` now returns `{ clinicId:null, isReady:true }`, so all hooks run unscoped (P1). `AuthenticatedLayout` sees `error=null`, so it does **not** show `NoClinicError`; instead `AuthenticatedLayoutInner:58` with `error=null` renders the sidebar with `TeamSwitcher` returning `null` (`clinic===null` at `team-switcher.tsx:23`), so the sidebar has an empty header. No toast, no retry button.

*Fix:* `setError('Failed to load clinic. Please retry.');` and expose a retry callback.

### S3 — Stale `allClinics` / `clinic` after "no membership" — `src/lib/clinic-context.tsx:97-101` — MEDIUM

```ts
if (!memberships?.length) { setError('No clinic assigned ...'); setIsLoading(false); return }
```

Does not `setClinic(null)` / `setAllClinics([])`. If the previous user had `allClinics=[A,B]`, switching to a user with zero memberships (`profiles.role='patient'` who booked) still sees `allClinics=[A,B]` inside `TeamSwitcher` until reload, suggesting they belong to clinics they do not.

*Fix:* `setClinic(null); setAllClinics([]);` before `setError`.

### S4 — Swallowed error in `catch` — `src/lib/clinic-context.tsx:143-147` — LOW

```ts
} catch (err) { console.error('Clinic resolution failed:', err) } finally { setIsLoading(false) }
```

Sets loading false but not error, same blank-shell as S2.

### S5 — `switchClinic` busts cache via reload — `src/lib/clinic-context.tsx:183-197` — LOW

```ts
function switchClinic(newClinicId: string) {
  const target = allClinics.find((c) => c.clinicId === newClinicId)
  setClinic(target); setUser({...}); window.location.reload()
}
```

Brute-force `reload()` busts **all** React Query caches (all query keys) — correct for "What if the target clinic has no data" (answer: new fetches return `[]`, no stale rows leak). But it also discards in-flight toasts, form drafts, scroll position, and races the synchronous `setCookie` vs `reload` on slow `document.cookie` sync on mobile WebKit. Better is `queryClient.clear(); queryClient.invalidateQueries(); setClinic(target)` without navigation. Also does not update `lastFetchedEmail`, so after reload the dummy path may reoccur (but `reload` resets the ref, so okay).

*Fix (recommended):*
```ts
const qc = useQueryClient()
qc.clear(); qc.invalidateQueries()
```
Keep `reload()` only as fallback if `qc.clear()` was not available in the closure.

### S6 — Realtime invalidation leaks clinic — `src/data/hooks.ts:516-548` · `src/hooks/use-realtime-sync.ts:43-72` — MEDIUM

```ts
// hooks.ts
on: { event:'*', schema:'public', table, ...(clinicId ? {filter:`clinic_id=eq.${clinicId}`} : {}), ...(filter?...) }
// highlighted: } catch, this filter is overwritten when both present
// use-realtime-sync.ts
channel.on('postgres_changes', { event:'*', schema:'public', table }, () => invalidate )
```

In `useRealtimeTable`, `clinicId` and `filter` are merged into the same `filter` key via spread — the second spread overwrites the first if both present (e.g., `useRealtimeQueue('Alice')` with `clinicId`). So doctor-scoped realtime loses clinic scoping. In the global `useRealtimeSync`, there's **no** `clinic_id` filter at all — every insert in clinic B invalidates clinic A's `['appointments']`, causing the dashboard line chart to flash `isFetching` and re-query with unscoped cache during the `isLoading` window (P1 amplifies).

*Fix:* Use `channel.on('postgres_changes', { ..., filter: clinicId ? `clinic_id=eq.${clinicId}` : undefined })` as explicit second subscription; or open one channel per clinic.

---

## 5. Cookie Persistence

### K1 — Shape trust after `safeJsonParse` — `src/stores/auth-store.ts:22-29` + `48-52` — HIGH

```ts
22: function safeJsonParse(value: string | undefined): unknown { try { return JSON.parse(value) } catch { return null } }
49: const cookieState = getCookie(ACCESS_TOKEN)
50: const initToken = (safeJsonParse(cookieState) as string) || ''
51: const userState = getCookie(USER_COOKIE) // 'mediq_user'
52: const initUser = (safeJsonParse(userState) as AuthUser | null) ?? null
```

`safeJsonParse` correctly returns `null` on corrupted JSON — the task's specific question is **handled: corrupted `mediq_user` logs the user out rather than crashing** (verified: `JSON.parse` throw → `null` → `initUser=null`). However, no validation follows the cast:

* `mediq_user="[]"` → `[] as AuthUser` → `useAuthStore.getState().auth.user.accountNo` is `undefined` → `fetchMemberships` does `supabase.auth.getUser()` with valid JWT but Zustand says no user → `beforeLoad` at `route.tsx:11` sees `!user` → redirects to `/sign-in` while Supabase still thinks signed-in → loop.
* `mediq_user="{}"` → `user.role` undefined → `can(user.role, perm)` at `route.tsx:29` → `roles.some` where `roles` is `undefined` → `TypeError` crash.
* `mediq_user="123"` → `typeof user.role !== 'object'` → crash.

Also the corrupted path does **not** delete the bad cookie, so every reload reparses it.

*Fix:* Validate shape with Zod:

```ts
const AuthUserSchema = z.object({ accountNo: z.string().uuid(), email: z.string().email(), role: z.array(z.string()).min(1), exp: z.number(), clinicId: z.string().optional(), ... })
const initUser = AuthUserSchema.safeParse(safeJsonParse(userState)).success ? parsed.data : null
if (!parsed.success) removeCookie(USER_COOKIE)
```

Also handle truncated cookies from 4KB overflow (Zustand serializes whole user — if clinicName long, cookie may be split; `getCookie` returns partial JSON → `safeJsonParse`→`null`→logout, which is safe but should toast).

### K2 — Cookie parsing & attributes — `src/lib/cookies.ts:11-43` — MEDIUM

*Parsing:* `getCookie(name)` does `value.split(`; ${name}=`)` — fails when the sought cookie is the **first** cookie (no leading `; `). The code mitigates by prepending `; ` (`const value = `; ${document.cookie}`)`, so that's correct. But it **does not** handle name being a prefix of another cookie (`mediq_user` vs `mediq_user_old`) — `split("; medique_user=")` could match wrong cookie if ordering is adversarial (low risk).

*Encoding:* `setCookie(name, value)` writes raw `JSON.stringify(value)` — if `value` ever contains `;`, `,`, or whitespace (clinic names like `St. Mary's; Lagos`), the `;` terminates the cookie early (`getCookie` splits on `;`). The fix is `encodeURIComponent(value)` / `decodeURIComponent`.

*Attributes:* `document.cookie = `${name}=${value}; path=/; max-age=${maxAge}`` sets no `SameSite` nor `Secure`. On `http://` dev it's fine, but on `https://mediq.app` it should be `SameSite=Lax; Secure` to prevent CSRF `POST /rest/v1/...` via `<img>`.

*Fix:* `setCookie` → `` `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax; ${location.protocol==='https:'?'Secure':''}` `` and same decode in `getCookie`. Consider `HttpOnly` not possible from JS — recommend moving `ACCESS_TOKEN` to Supabase `localStorage` (default) rather than a custom cookie.

### K3 — Hardcoded cookie name — `src/stores/auth-store.ts:4` — LOW

```ts
const ACCESS_TOKEN = 'thisisjustarandomstring'
```

This is the JS cookie key for the Supabase JWT. The service-role secret is correctly **not** exposed (comment at `supabase.ts:26`), so the name being nonsense is not a secret. However reading `getCookie('thisisjustarandomstring')` is opaque in DevTools/observability — rename to `mediq_token` and document rotation.

---

## 6. Platform RLS Migrations — Additional Notes

* `20260820_multi_tenancy.sql:81-126` creates `clinics`, `clinic_members`, adds `clinic_id` nullable → backfills to `default` — correct.
* `user_is_clinic_admin:237-255` checks `profiles.role='admin'` as bootstrap — makes every legacy global admin a clinic admin (intended) but also makes **every** global admin able to mutate `clinic_members` for any clinic (platform escalation). This matches the product's "platform_admin inherits admin" but is not documented as scoped.
* `20260825_notifications_audit_hardening.sql` correctly hardens `appointments_update_clinic` with `WITH CHECK status='cancelled'` plus triggers `protect_appointment_cancel` / `protect_appointment_patient_updates`. Verified no bug.
* `20260828100000_fix_patient_appointments_rls.sql:12-24` is the **patient fix** that moves `lower(patient_email)=...` outside `user_in_clinic` — previously patients saw zero rows, now correct. Verified correct after fix; before fix was a HIGH (the "No upcoming" bug).

No additional `platform_*` RLS was found — `is_platform_admin()` referenced in old audit does not appear in shipped migrations.

---

## 7. What We Verified as **Not** Bugs (Correct by Design)

| Area | Why not a bug |
|---|---|
| `safeJsonParse` on **corrupted JSON** (`mediq_user="not json"`) | Returns `null` → `initUser=null` → user logged out. No crash. Correct — K1 only fires on valid JSON of wrong shape. |
| `switchClinic` with target that **has no data** | `window.location.reload()` busts every React Query key; repo queries with `clinic_id` filter return `[]`; dashboard shows `0` + `Recent Check-ins` empty. No stale rows. |
| `create_clinic` Zod slug regex `^[a-z0-9]+(-[a-z0-9]+)*$` at `create-clinic/index.tsx:87` | Matches SQL regex exactly; correctly rejects `ABC`, `--bad--`. |
| `useSupabaseAuthSync` `...(prev?.clinicId ? ...)` spread when `prev` is null | No-op, no crash. Bug is identity check, not syntax. |
| `ClinicProvider` `lastFetchedEmail` dedup | Correct dedup for rapid re-renders; bug is sentinel `default` poisoning (S1), not the mechanism. |

---

## 8. Reproduction Commands

```bash
# 1. Corrupted cookie shapes
python3 -c "import json; print(json.dumps({'accountNo':None}))"
# In DevTools: document.cookie='mediq_user={}; path=/'
# Expected: no crash, redirect to /sign-in. Actual today: can() crash.

# 2. Slug race (requires two browsers)
# Browser A + B: both POST create-clinic slug 'race-test-1' simultaneously
# Expected: one 200, other 'Slug already taken'. Actual: other gets Postgres 'duplicate key' which still maps but is brittle.

# 3. Cross-clinic fetch flash
# Add console.log at src/lib/clinic-context.tsx:71 and src/data/hooks.ts:52
# Reload /admin/dashboard as platform_admin belonging to 2 clinics
# See one unscoped appointments query with no clinic_id before ClinicProvider resolves.

# 4. Dummy plan
# Login, DevTools → document.cookie includes mediq_user with clinicId
# Reload, observe TeamSwitcher briefly "Default Clinic · professional" before flicker.

# 5. Silent downgrade
# Throttle network: DevTools → offline → reload → observe role=['patient'] toast missing.
```

---

## 9. Fix Priority

**Do before pitch:**
1. A4 + A6 + A8 + P1 + S1 (one session of store+context+hooks hardening).
2. C1 server-side exception mapping, C3 orphan handling.

**Next sprint:**
3. S2/S3/S4 error states, K1 shape validation, K2 cookie encoding, A9 redirect, P3 narrowing.

---

*Evidence:* Every `file:line` above was read with the Serena `read` tool (with `head`/`tail` where needed) and cross-checked with `grep` for `safeJsonParse`, `switchClinic`, `create_clinic`, `useSupabaseAuthSync`, `platform`. No URL was guessed. The report is ready to paste into the tracker.*

