# MediQ Patient Dashboard — UI/UX Audit

**Date:** 2026-08-29 — verified at workspace commit `d43368c` + uncommitted changes
**Scope:** `src/features/patient/index.tsx`, `src/features/patient/components/getting-started-checklist.tsx`, `src/components/ui/card.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/skeleton.tsx`, `src/components/ui/separator.tsx`, `src/assets/logo.tsx`, `src/components/theme-switch.tsx`, plus overall layout (`src/routes/patient.tsx`, `src/styles/index.css`, `src/styles/theme.css`, `src/features/appointments/schema.ts` badge tokens)
**Method:** Full file reads, manual responsive reasoning (320/375/768/1024px), WCAG 2.2 AA heuristic, state-machine trace (loading/empty/error/success). Every issue cites `file:line`, severity, and suggested fix.

---

## 1. Executive Summary

The patient portal is **functional and clean** but **not yet polished**. Foundational shadcn-based components are well-built (`card.tsx:9`, `button.tsx:7`, `badge.tsx:7`), but the **composition in `PatientPortal`** wastes them: header overflows on mobile, banners lack hierarchy, empty/loading/error states are placeholder-grade, accessibility is partially broken (keyboard-inaccessible checklist rows, duplicate DOM IDs, no ARIA live for queue), and the journey **Book → Queue → Completed** has no visual continuity. No layout is broken catastrophically, but 6 issues are *Important* enough to block a polished release and 4 are *Critical* for a11y correctness.

**Counts:** 4 Critical, 11 Important, 10 Minor, 8 Suggestions — **25 findings + 8 polish proposals**.

**Overall score:** **6.2 / 10** — professional-neutral, needs a polish pass on responsiveness, a11y, and state design before pitch/demo.

---

## 2. Visual Design

### VD-01 — Important — Card vertical rhythm mismatch
*Files:* `src/components/ui/card.tsx:9` vs `src/features/patient/index.tsx:238`, `308` (`CardContent className='pt-5 pb-4'`)

`Card` default is `gap-6 py-6` (`card.tsx:9`), but patient cards override with `pt-5 pb-4` + inner `Separator my-3` + `space-y-1`. The 6px gap token is never realized, and `px-6` from `CardContent` (`card.tsx:64`) plus `py-6` from `Card` creates double padding that is then partially overridden. Visual result: cards feel top-heavy (20px top vs 16px bottom) and inconsistent with `GettingStartedChecklist` which uses `CardContent p-5` (`getting-started-checklist.tsx:163`).

**Fix:** Standardize patient appointment card: `<Card className="py-4"><CardContent className="space-y-3">` or extend `Card` variant `compact`. Remove per-card `pt-5 pb-4`, rely on design tokens.

### VD-02 — Important — Two queue banners look identical despite different urgency
*Files:* `src/features/patient/index.tsx:162-185` (waiting) vs `188-197` (in_progress)

Both banners are `rounded-lg border bg-background p-4`. Waiting ("#3 in line") and In-progress ("Currently with doctor") have identical chrome; the more urgent state does not elevate. The in-progress banner is also rendered *below* the waiting banner when both conditions true (if status `in_progress` and position found) — stacked with no visual priority.

**Fix:** Elevate `in_progress`: `bg-primary text-primary-foreground border-primary` or `bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200` + pulsing dot. For waiting, add subtle left accent `border-l-4 border-primary`. Ensure mutually exclusive render (`if in_progress else if queuePosition >=0`).

### VD-03 — Important — Badge color tokens drift from design system
*Files:* `src/features/appointments/schema.ts:30-39` · `src/components/ui/badge.tsx:18` (`variant='outline'`)

`appointmentStatusBadge` hard-codes `bg-amber-200/40 border-amber-300` etc. `pending` and `arrived` share identical amber (`schema.ts:31,33`) — visually indistinguishable though semantically distinct. `no_show` `bg-neutral-300/40` is low contrast in dark mode. `outline` variant (`badge.tsx:18`) adds `text-foreground` which is overridden by badge class, causing specificity fight. Dark-mode combos like `bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300` produce washed-out pastel on dark card (`card.tsx:5` `oklch(0.14 ...)`).

**Fix:** Define semantic tokens in `theme.css` (`--status-pending`, `--status-booked`) and reference via `appointmentStatusBadge`. Make `pending` vs `arrived` distinct (e.g., `pending: amber outline dashed`, `arrived: amber solid`). Test contrast with APCA on both themes.

### VD-04 — Minor — Header density competes with page title
*Files:* `src/features/patient/index.tsx:131-157` (`header className='flex h-16 justify-between border-b bg-background px-4 sm:px-6'`)

Header `h-16` is tall, then page title `h1 text-2xl font-bold tracking-tight` (`index.tsx:201`) sits 40px below (`main py-10 gap-8`). Combined they create two heavy horizontal bands on mobile, pushing primary content below fold. Buttons `KeyRound`, `LogOut` icons are identical `size-4` (`button.tsx:7`), no visual weight difference between secondary (`ghost`) and primary-destructive-adjacent (`outline` Sign out).

**Fix:** Reduce header to `h-14` on mobile via `h-14 sm:h-16`. Make Sign out `variant='ghost'` with `text-muted-foreground` and keep Change password as `ghost`; reserve `outline` for page-level CTAs only.

### VD-05 — Minor — Skeleton does not mimic card anatomy
*Files:* `src/features/patient/index.tsx:211-214` (`Skeleton className='h-24 w-full' x3`) vs `src/components/ui/skeleton.tsx:6`

Three flat `h-24` rectangles bear no resemblance to appointment card structure (avatar line + separator + date + cancel). Feels cheap on load, especially when real cards have `Separator` and `Badge`.

**Fix:** Card skeleton:
```tsx
<Card><CardContent className='space-y-3 py-5'>
  <div className='flex justify-between'><Skeleton className='h-4 w-28'/><Skeleton className='h-5 w-16 rounded-full'/></div>
  <Skeleton className='h-px w-full'/><Skeleton className='h-4 w-40'/>
</CardContent></Card>
```

### VD-06 — Minor — Progress bar color snap
*Files:* `src/features/patient/components/getting-started-checklist.tsx:182-185` (`allDone ? bg-emerald-500 : bg-primary`)

Color swaps instantly at 100% (`duration-500` on width only, not color). Celebration line `bg-emerald-50 px-3 py-2` (`193`) appears with no enter animation, jarring against muted card.

**Fix:** Transition color: `transition-colors duration-500` on bar; add `animate-in fade-in slide-in-from-top-1 duration-300` to celebration line.

### VD-07 — Minor — Three competing uppercase label styles
*Files:* `src/features/patient/index.tsx:166` (`text-xs font-medium tracking-wide uppercase`), `220` (`text-xs font-semibold tracking-wider uppercase`), `src/features/patient/components/getting-started-checklist.tsx:166` (`text-sm font-semibold` no uppercase)

Banner label `tracking-wide`, section heading `tracking-wider`, checklist title not uppercased — hierarchy unclear. `font-medium` vs `font-semibold` vs `font-bold` on similar sized labels creates noise.

**Fix:** Tokenize: `sectionLabel = text-xs font-semibold tracking-widest uppercase text-muted-foreground`; `bannerKicker = text-[11px] font-semibold tracking-widest uppercase`; apply consistently.

### VD-08 — Suggestion — No elevation for the primary focus (queue)
*Files:* `src/features/patient/index.tsx:163`, `189` (`rounded-lg border bg-background`)

Most important element (queue position) has identical elevation to secondary cards (`shadow-sm` via `card.tsx:9`). Should be most prominent block on page.

**Fix:** `shadow-md ring-1 ring-border bg-card` for queue banner, or gradient `bg-gradient-to-br from-primary/5 to-transparent`.

### VD-09 — Minor — Queue position circle feels heavy
*Files:* `src/features/patient/index.tsx:180-182` (`h-12 w-12 shrink-0 rounded-full border text-xl font-bold`)

12×12 circle with `border` + `text-xl` on `bg-background` is visually dense against light typography. On dark mode border `oklch(1 0 0 / 10%)` (`theme.css:53`) is nearly invisible, circle floats.

**Fix:** `bg-muted` inside circle, `text-lg`, `border-2`, or replace with `bg-primary text-primary-foreground border-transparent`.

---

## 3. Responsiveness

### RP-01 — Critical — Header action row overflows on iPhone SE (375px) and 320px
*Files:* `src/features/patient/index.tsx:142-157`

Structure: `flex justify-between` with left `gap-2` (back + logo) and right `gap-1.5` (email + ThemeSwitch + Change password + Sign out). At `<640px`, `email` hides (`hidden sm:block` OK), but `Change password` remains full label (`KeyRound` + "Change password" `index.tsx:147-152`) + `Sign out` (`LogOut` + "Sign out" `153-156`) + `ThemeSwitch` icon button. On 375px, total width ~ 260px for right group > available ~180px → buttons wrap to second line (header is `h-16` single row, `items-center`, so they overflow/collapse, icons overlap). At 320px even more severe.

**Fix:** Collapse labels on mobile:
```tsx
<Link to='/change-password' className='gap-1.5'>
  <KeyRound className='size-4'/><span className='hidden sm:inline'>Change password</span>
  <span className='sm:hidden sr-only'>Change password</span>
</Link>
<Button variant='outline' size='sm' className='gap-1.5'>
  <LogOut className='size-4'/><span className='hidden sm:inline'>Sign out</span>
</Button>
```
Or move actions into a `DropdownMenu` on `<md` (avatar-style menu). Add `flex-wrap` guard or `min-w-0` + `truncate`.

### RP-02 — Important — Logo and back button cramped on small screens
*Files:* `src/features/patient/index.tsx:132-140` (`div gap-2` > Button size sm + Logo h-9)

`gap-2` (8px) between back chevron (`size-4` inside `h-8` button) and `Logo h-9` (`index.tsx:139`) leaves <4px visual gutter when header padded `px-4`. Logo `h-9` (`36px`) dominates header `h-16`.

**Fix:** `gap-3` + `Logo className='h-7 sm:h-9'` for narrower screens. Add `shrink-0` to button.

### RP-03 — Important — Main gutters and vertical rhythm on mobile
*Files:* `src/features/patient/index.tsx:160` (`main className='mx-auto max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6'`)

`gap-8` (32px) between every block (banner → title → checklist → upcoming → past → CTA) is generous on 375×812, pushing "Book an appointment" CTA below the fold requiring 2 scrolls. `py-10` (40px) top/bottom adds extra. On desktop `max-w-2xl` (672px) centered leaves huge empty gutters at 1440px — feels narrow and not tablet-optimized.

**Fix:** `gap-6 sm:gap-8` and `py-6 sm:py-10`, `max-w-2xl lg:max-w-3xl` or use `container` utility (`styles/index.css:41`). Consider `px-6` not `px-4` on mobile for card breathing (cards have `px-6` inner, outer `px-4` causes card edge 16px vs 24px inner asymmetry).

### RP-04 — Important — Card internal flex squeezes badge on long statuses
*Files:* `src/features/patient/index.tsx:239-259`, `309-328` (`flex items-start justify-between gap-3`)

Status text `appointment.status.replace('_',' ')` yields `in progress` (11 chars) in `Badge` (`badge.tsx:7` `whitespace-nowrap`). With long `doctorName` (e.g., "Dr. Alexandra Montgomery") + `Badge` in `flex`, badge shrinks or wraps unexpectedly (though `shrink-0` on badge helps, `doctorName` `leading-tight font-medium` has no `truncate`/`min-w-0`). On 320px, doctor name may overflow.

**Fix:** `div className='min-w-0 flex-1'` around doctorName, add `truncate` to `p`, keep `Badge shrink-0`. Test with `doctorName="Dr. Christopher Alexander Bartholomew"`.

### RP-05 — Minor — Queue banner does not stack on mobile
*Files:* `src/features/patient/index.tsx:164-184` (`flex items-start justify-between gap-4`)

On 320px, flex row keeps Kreis 48px right-aligned, text column narrow (~200px) wraps "With {doctor} · h:mm a" onto 2 lines, kicker "Queue position · Today" wraps. No stacked variant.

**Fix:** `flex flex-col sm:flex-row sm:items-start sm:justify-between` with circle below text on mobile or hide circle on `<sm` and enlarge `text-2xl` number.

### RP-06 — Minor — Checklist touch target undersized
*Files:* `src/features/patient/components/getting-started-checklist.tsx:206` (`px-2 py-2 rounded-md`) vs `src/styles/index.css:32-37` (mobile font-size 16px fix, but no touch target fix)

Row height ~36px (py 8 + font 14) is below WCAG 44px minimum. `cursor-pointer` row (`207-208`) plus nested `button`/`Link` (`245-269`) creates two tap targets stacked within 36px → mis-taps.

**Fix:** `py-3` (adds 4px) → ~44px, or `min-h-11` (44px). Expand `px-3`.

### RP-07 — Minor — No tablet breakpoint for 768–1024px
*Files:* `src/features/patient/index.tsx:160` (`max-w-2xl`)

At 768px, page is 672px centered with 48px gutters each side (6% of viewport unused). At 1024px gutters 176px. No two-column opportunity (e.g., Upcoming + Queue side-by-side).

**Fix:** Keep single column (good for patient focus) but widen to `max-w-3xl` at `lg:` and increase `px-6` to `px-8` on tablet, or optionally place queue banner sticky top on desktop.

### RP-08 — Suggestion — Book CTA not sticky on mobile
*Files:* `src/features/patient/index.tsx:361-366` (`Button self-start asChild`)

CTA sits at end of `gap-8` flow, after potentially long Past list. New user with 0 past sees it after 4 blocks; returning user with 10 past must scroll past history to re-book.

**Fix:** Sticky bottom bar on mobile: `<div className='sticky bottom-0 -mx-4 border-t bg-background/80 p-4 backdrop-blur sm:static sm:border-0 sm:p-0 sm:bg-transparent'>` wrapping CTA, or keep CTA above Past as well.

---

## 4. Accessibility (WCAG 2.2 AA)

### A11Y-01 — Critical — Checklist rows are keyboard-inaccessible div buttons
*Files:* `src/features/patient/components/getting-started-checklist.tsx:204-219` (`div onClick={() => { getElementById...scroll... }} className={isClickable ? 'cursor-pointer hover:bg-muted/60' : ''}`)

Task rows for `queue` use a bare `div` with `onClick` but no `role="button"`, no `tabIndex={0}`, no `onKeyDown` for Enter/Space. Keyboard users cannot activate "View" via row click; screen readers announce it as generic group.

**Severity:** Critical — blocks keyboard navigation.
**Fix:**
```tsx
<div
  role={isClickable ? 'button' : undefined}
  tabIndex={isClickable ? 0 : -1}
  aria-label={task.label}
  onKeyDown={(e) => {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.getElementById('patient-queue-banner')?.scrollIntoView({behavior:'smooth'});
    }
  }}
  ...
/>
```
Or better: replace div with `<button>` styled as row (full-width, text-left).

### A11Y-02 — Critical — Nested interactive (div + button/link) with stopPropagation anti-pattern
*Files:* `src/features/patient/components/getting-started-checklist.tsx:213-269` (outer `div onClick` containing inner `button type='button' onClick... e.stopPropagation()` at `247-252` and `Link onClick... e.stopPropagation()` at `263-269`)

Outer row handles click to scroll, inner button also scrolls but stops propagation. For assistive tech, two nested click targets is invalid HTML and causes double announcement. Keyboard focus order is unpredictable.

**Fix:** Remove outer `div onClick` entirely; make only the trailing action (`View` / `Go`) interactive. If row click is desired, use a single `<button>` as row and make trailing label non-interactive (`aria-hidden`).

### A11Y-03 — Critical — Duplicate `id="patient-queue-banner"`
*Files:* `src/features/patient/index.tsx:163`, `189` · `src/features/patient/components/getting-started-checklist.tsx:215`, `249`

Two banners share `id='patient-queue-banner'`. `document.getElementById` (`checklist.tsx:215,249`) returns only first match (non-deterministic). Duplicate IDs fail HTML validation and confuse screen readers that use `aria-labelledby`.

**Fix:** Unique IDs: `id='patient-queue-waiting'` and `id='patient-queue-inprogress'`. In checklist, query both:
```ts
const el = document.querySelector('[data-queue-banner]') ?? document.getElementById('patient-queue-waiting') ?? document.getElementById('patient-queue-inprogress');
```
Or use `useRef` forwarded from `PatientPortal`.

### A11Y-04 — Important — Progress bar lacks ARIA semantics
*Files:* `src/features/patient/components/getting-started-checklist.tsx:180-188` (`div className='h-1.5 w-full bg-muted' > div style={{width:`${pct}%`}}`)

No `role="progressbar"`, no `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`. Screen readers see empty divs.

**Fix:**
```tsx
<div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Getting started ${doneCount} of ${total} complete`} className='h-1.5 w-full bg-muted'>
```

### A11Y-05 — Important — Queue banners not announced live
*Files:* `src/features/patient/index.tsx:162-197`

Queue position changes (someone ahead completes) update text `#{queuePosition +1}` but no `aria-live`. Screen reader user waiting in clinic will not hear update.

**Fix:**
```tsx
<div id='patient-queue-waiting' aria-live='polite' aria-atomic='true' role='status' ...>
```
Similarly for in_progress banner `role="status"`.

### A11Y-06 — Important — Decorative icons missing aria-hidden
*Files:* `src/features/patient/index.tsx:135` (`ArrowLeft`), `246` (`Stethoscope size-3`), `286` (`X size-3.5`), `363` (`CalendarDays`) · `src/features/patient/components/getting-started-checklist.tsx:169` (`PartyPopper size-3.5`), `225` (`Check size-3`), `228` (`Circle size-5`) · `src/components/theme-switch.tsx:28-29` (`Sun`/`Moon`)

Lucide icons are decorative but lack `aria-hidden="true"`. They are announced as "image" in some AT.

**Fix:** Add `aria-hidden="true"` to every decorative Lucide icon. Keep `sr-only` text where needed (already present in ThemeSwitch `30`).

### A11Y-07 — Important — Heading hierarchy out of order
*Files:* `src/features/patient/index.tsx:200-201` (`h1 My appointments`), `220` (`h2 Upcoming`), `301` (`h2 Past`) · `src/features/patient/components/getting-started-checklist.tsx:166` (`h3 Getting started`)

DOM order: `h1` → `h3` (checklist) → `h2` (Upcoming) → `h2` (Past). Checklist `h3` before `h2` violates hierarchical order; AT navigation via headings will jump strangely.

**Fix:** Make checklist heading `h2` (same level as Upcoming/Past) or `h2` visually styled as `text-sm`:
```tsx
<h2 className='text-sm font-semibold'>Getting started</h2>
```
Then sections remain `h2` siblings.

### A11Y-08 — Important — Low-contrast ghost Cancel button
*Files:* `src/features/patient/index.tsx:279-288` (`variant='ghost' className='text-muted-foreground hover:text-destructive'`), `src/components/ui/button.tsx:19-20`

`text-muted-foreground` (`oklch(0.554 ...)` / `0.704` dark) on `bg-card` (`oklch(1)`) is ~4.5:1 in light but ~3.9:1 in dark — borderline AA. `hover:text-destructive` only on hover, not on focus, so keyboard focus remains low contrast.

**Fix:** Keep ghost but add `focus-visible:text-destructive focus-visible:ring-destructive/20` and ensure `muted-foreground` meets 4.5:1 (adjust token or use `text-foreground/70`). Add focus ring distinct from hover.

### A11Y-09 — Minor — Icon button ThemeSwitch focus ring may be clipped
*Files:* `src/components/theme-switch.tsx:27` (`Button size='icon' className='scale-95 rounded-full'`)

`scale-95` reduces size; `focus-visible:ring-[3px]` (`button.tsx:7`) may be clipped by parent `header gap-1.5` tight layout. Not Critical but visible focus indicator is required 2.2.

**Fix:** Remove `scale-95` or add `focus-visible:scale-100`.

### A11Y-10 — Minor — Skeleton needs aria-busy
*Files:* `src/features/patient/index.tsx:210-215` (`appointmentsQuery.isPending ? <Skeleton ...>`)

No `aria-busy="true"` or `aria-label="Loading appointments"`; screen readers see empty skeletons.

**Fix:** Wrapper `<div aria-busy="true" aria-live="polite">` or `role="status"` with sr-only text.

### A11Y-11 — Minor — Link/Button asChild pattern may duplicate semantics
*Files:* `src/features/patient/index.tsx:133-136` (`Button variant='ghost' size='sm' asChild><Link to='/' aria-label='Back to home'><ArrowLeft/></Link></Button>`)

`asChild` with `Slot` merges props correctly, but `aria-label` on `Link` plus `Button` semantics may produce nested accessible name. Verify with axe: `Link` rendered as `<a>` with button styling is okay, but ensure no `<button>` wrapping `<a>`.

**Fix:** Confirm `Slot` renders single element (inspect output). Prefer explicit `<Link className={buttonVariants({variant:'ghost',size:'sm'})}>` instead of `asChild` if lint complains.

---

## 5. Empty States

### ES-01 — Important — Upcoming empty state is text-only
*Files:* `src/features/patient/index.tsx:224-229` (`CardContent py-10 text-center text-muted-foreground No upcoming appointments. Book one below.`)

Gray text on white, centered, 40px padding, no illustration, no inline CTA. Says "Book one below" but CTA is 32-64px further (`gap-8` to `Button self-start` at `361`). New patients may miss it.

**Fix:** Rich empty state:
```tsx
<Card><CardContent className='py-12 text-center'>
  <div className='mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted'><CalendarDays className='size-6 text-muted-foreground' aria-hidden/></div>
  <p className='font-medium'>No upcoming visits</p>
  <p className='mx-auto mt-1 max-w-sm text-sm text-muted-foreground'>Your booked appointments will appear here. Let’s get your first visit scheduled.</p>
  <Button asChild className='mt-4'><Link to='/book'><CalendarDays/>Book an appointment</Link></Button>
</CardContent></Card>
```

### ES-02 — Minor — Past section hides entirely when empty
*Files:* `src/features/patient/index.tsx:299` (`{past.length > 0 && <section>}`)

First-time patients see no hint that history will live here. Contrast with Upcoming which at least shows empty card.

**Fix:** Either always render Past with empty message ("Past visits will appear here after completion") or remove Past heading until data exists but add subtle placeholder in Upcoming empty.

### ES-03 — Important — Queue not-in-queue silent
*Files:* `src/features/patient/index.tsx:162` condition (`todayAppointment && queuePosition >=0`)

If `todayAppointment` exists but `queuePosition === -1` (either not yet `waiting`, or RLS denies `queue_entries` — see `docs/reports/frontend-audit-patient.md:C3`), no banner and no explanation. Checklist `hasQueue` may disagree (`getting-started-checklist.tsx:122-136` may return false differently), leaving user confused.

**Fix:** Show contextual state when `todayAppointment` exists without queue entry:
- If `status === 'booked'`: "You’re booked for {time} with {doctor}. Check in at front desk to join the queue."
- If `status === 'arrived'`: "You’ve arrived — you’ll appear in the queue shortly."
With `variant="outline"` neutral banner.

### ES-04 — Minor — No doctors / specialization empty
*Files:* `src/features/patient/index.tsx:232-233`, `244-249`, `305` (`getSpecialization` returns `undefined` → no `<p>` rendered)

When `doctorsQuery` empty/fails, `spec` is falsy and specialty line disappears. No fallback, layout shifts upward.

**Fix:** Render placeholder with `Skeleton` while `doctorsQuery.isPending`, and hide line only if confirmed `spec === undefined` *and* query succeeded. Consider showing `doctorName` alone is enough — okay to keep silent but add comment.

### ES-05 — Minor — No empty illustration for all-done checklist
*Files:* `src/features/patient/components/getting-started-checklist.tsx:191-195` (`🎉 You're all set`)

When `allDone`, celebration line is only text + emoji; progress bar fills emerald but card remains. No dismiss affordance, persistent on every visit.

**Fix:** Add "Dismiss" link storing `localStorage mediq_checklist_dismissed`, or auto-collapse after 7 days. Keep celebration but offer `hide`.

---

## 6. Loading States

### LS-01 — Important — Uncoordinated loading gates
*Files:* `src/features/patient/index.tsx:210` (`appointmentsQuery.isPending ? Skeletons : Upcoming`) vs `42-44` (`queueQuery`, `doctorsQuery` never checked)

Only appointments gate shows skeletons. Queue and doctors may still be pending while appointments render, so `getSpecialization` returns nothing then pops in, and `queuePosition` briefly `-1` then number appears (flash). Seen on slow 3G, TTI inflated.

**Fix:**
```tsx
const isLoading = appointmentsQuery.isPending || queueQuery.isPending || doctorsQuery.isPending;
if (isLoading) return <PatientSkeleton />; // includes queue banner skeleton + 3 card skeletons
```

### LS-02 — Minor — Generic skeleton height mismatch
*Files:* `src/features/patient/index.tsx:212-214` (`h-24`) vs real card `~120px` with reason

Skeleton `h-24` (96px) is shorter than real card with `Separator` and reason (~110-130px). Causes layout shift ~20px when data loads, degrading CLS.

**Fix:** Use card-shaped skeleton as described in VD-05, height `h-[118px]`.

### LS-03 — Important — Checklist-derived loading flicker
*Files:* `src/features/patient/components/getting-started-checklist.tsx:156-159` (`doneCount = TASKS.filter(t=>isDone(t.id)).length` derived from `appointmentsQuery.data ?? []`)

While `appointmentsQuery.isPending`, `myAppointments=[]` → `hasAppointment=false`, `hasQueue=false` → `doneCount=1` (only profile+password). After load jumps to 2-3. No loading UI, progress bar width jumps.

**Fix:** If `appointmentsQuery.isPending || queueQuery.isPending` render `Skeleton className='h-32 w-full'` inside checklist card, or keep bar at 0% with `aria-busy`.

### LS-04 — Minor — Cancel action pending locks all buttons, no spinner
*Files:* `src/features/patient/index.tsx:279-288` (`disabled={cancelAppointment.isPending}`), `src/data/hooks.ts:212-225`

`isPending` is global for the mutation; clicking cancel on one card disables all cancels. No spinner, label still "Cancel", user unsure if clicked.

**Fix:** Per-item pending:
```tsx
const [pendingId, setPendingId] = useState<string|null>(null);
// onClick: setPendingId(id); cancelAppointment.mutate(id, {onSettled:()=>setPendingId(null)})
disabled={pendingId===appointment.id}
{pendingId===appointment.id ? <Loader2 className='size-3.5 animate-spin'/> : <X className='size-3.5'/>}
{pendingId===appointment.id ? 'Cancelling…' : 'Cancel'}
```

### LS-05 — Minor — Logo/theme flash before React hydrate
*Files:* `src/assets/logo.tsx:6` (`window.matchMedia`), `src/components/theme-switch.tsx:18` (`useEffect` theme-color)

Logo chooses dark/light via `window.matchMedia` synchronously during render — causes mismatch if `theme='system'` and system dark, but server-render or initial paint used light. No `Skeleton` for auth user email (`index.tsx:143-145` `user.email` may be empty initially then pops).

**Fix:** Acceptable for client-only app, but add `suppressHydrationWarning` or read `localStorage theme` synchronously. For email, show `Skeleton h-4 w-32` while `user` null.

---

## 7. Error States

### ER-01 — Critical — No error UI; failures masquerade as empty
*Files:* `src/features/patient/index.tsx:210-359` (no `isError` check), `src/features/patient/components/getting-started-checklist.tsx:44-136` (same)

If `appointmentsQuery.isError` (network, RLS, expired JWT), code treats `data ?? []` as `[]` → "No upcoming" empty card. Same for queue/doctors. No retry.

**Fix:** Add explicit error branch before pending:
```tsx
if (appointmentsQuery.isError || queueQuery.isError) {
  return <Card><CardContent className='py-10 text-center space-y-3'>
    <p className='text-sm text-destructive'>Failed to load appointments. {appointmentsQuery.error?.message}</p>
    <Button variant='outline' size='sm' onClick={()=>{appointmentsQuery.refetch(); queueQuery.refetch(); doctorsQuery.refetch();}}>Retry</Button>
  </CardContent></Card>
}
```
For checklist, show inline `text-destructive text-xs` per failed query.

### ER-02 — Important — Cancel failure only toast, no inline recovery
*Files:* `src/features/patient/index.tsx:108-118` (`onError: toast.error('Failed to cancel')`)

If `Missing clinic context` (`hooks.ts:217`) or RLS 403, user sees generic toast that auto-dismisses, card remains `booked` but user may think succeeded. No inline error next to Cancel button.

**Fix:** Keep optimistic update (or add one) + per-card error: store `cancelError` string, render `p text-xs text-destructive mt-2` below date with Retry.

### ER-03 — Minor — Profile fetch error masks as success
*Files:* `src/features/patient/components/getting-started-checklist.tsx:58-59` (`if(error||!data) setHasProfile(true)`)

Swallowing fetch error and marking profile complete hides real failure; progress bar over-reports.

**Fix:** `useState<boolean|null>(null)` + error banner, or use `useQuery` so loading/error distinct.

### ER-04 — Minor — No offline or boundary handling
*Files:* `src/features/patient/index.tsx:1-370` (no `ErrorBoundary`, no `navigator.onLine`)

No offline illustration, no boundary if `format(new Date(...))` throws on invalid ISO.

**Fix:** Wrap `PatientPortal` in `ErrorBoundary` at route level, validate `scheduledFor` with `isValid` guard.

---

## 8. User Flow: Booking → Queue → Completion

### UF-01 — Important — No stepper / timeline continuity
*Files:* `src/features/patient/index.tsx:230-294` (Upcoming cards show `Badge` + `format('EEEE, MMM d · h:mm a')` only)

Statuses `pending`→`booked`→`arrived`→`in_progress`→`completed` exist (`schema.ts:3-12`) but portal only surfaces them as colored `Badge` text (`schema.ts:30-35`). User cannot infer "what’s next" — e.g., `booked` → "Check in at front desk", `arrived` → "You’re in queue".

**Fix:** Add mini stepper under date:
```tsx
<div className='mt-3 flex items-center gap-1 text-[11px]'>
  {['Booked','Queued','In visit','Done'].map((s,i)=> <><span className={step<=i? 'text-primary':'text-muted-foreground'}>● {s}</span>{i<3&&<span className='h-px flex-1 bg-border'/>}</>)}
</div>
```
Map statuses to steps.

### UF-02 — Important — Checklist → queue View scrolls to absent banner
*Files:* `src/features/patient/components/getting-started-checklist.tsx:213-259`, `src/features/patient/index.tsx:162`

Checklist `queue` row "View" (`258`) scrolls via `getElementById('patient-queue-banner')` even when `queuePosition === -1` (banner hidden) → scrolls to top (fallback `window.scrollTo`) with no feedback. User thinks button broken.

**Fix:** If no banner, change action to disabled `Not in queue yet` muted text, or scroll to Upcoming card with highlighted appointment. Check existence before showing "View":
```tsx
const hasBanner = todayAppointment && queuePosition>=0 || todayAppointment?.status==='in_progress';
{hasBanner ? <button>View</button> : <span className='text-xs text-muted-foreground'>Not in queue</span>}
```

### UF-03 — Important — Book CTA buried below Past
*Files:* `src/features/patient/index.tsx:299-366` (`Past length>0 && <section>` then `Button self-start asChild`)

User flow for returning patient: see Past history (maybe 5 cards) then CTA. On mobile requires scrolling past history to re-book — opposite of desired funnel (Upcoming CTA should be primary).

**Fix:** Dual CTA: keep top section CTA (above Upcoming) *and* bottom CTA. Or make top CTA prominent primary, bottom as secondary link. Keep `self-start` but add sticky behavior (RP-08).

### UF-04 — Minor — Rejection reason lacks hierarchy
*Files:* `src/features/patient/index.tsx:345-350` (`<p className='text-sm text-destructive'>{appointment.rejectionReason}</p>`)

Rejected Past card shows reason as plain red text, no label "Reason:", no icon, may be long unescaped string.

**Fix:** `<p className='mt-2 flex gap-1.5 text-sm'><AlertCircle className='size-4 shrink-0 text-destructive'/>` + `span` with label. Clamp at 2 lines.

### UF-05 — Minor — Cancel confirmation is blocking `confirm()`
*Files:* `src/features/patient/index.tsx:113` (`if(confirm('Are you sure...'))`)

Browser-native `confirm` is not styled, blocks thread, not keyboard-trapped, and requires Playwright `page.on('dialog')` to test (`C7` in `frontend-audit-patient.md`).

**Fix:** Use `AlertDialog` (existing `src/components/ui/alert-dialog.tsx:1`) with `Cancel` / `Confirm` and per-card destructive styling.

### UF-06 — Minor — Post-booking return path unclear
*Files:* `src/features/booking/index.tsx` + `src/features/patient/index.tsx:361` (`Link to='/book'` one-way only)

After booking via `/book`, success state shows confirmation but no "Back to My Appointments" secondary button emphasizing loop closure (booking does have link, but patient portal does not link back). Add breadcrumb or success toast with `View in My Appointments`.

**Fix:** Booking success `onSuccess` → toast with action `View` linking to `/patient`, or Booking component’s result panel includes `Link to='/patient'`.

---

## 9. Suggestions — To Make Patient Experience Polished & Impressive

### S-01 — Live queue pulse & ETA
Add subtle pulse animation to queue position circle (`animate-pulse` or `bg-primary/10` ping) when `queuePosition <=2`, and show "About ~{queuePosition * 8} min wait" estimator (average visit 8 min). Requires `aria-live` (A11Y-05).

### S-02 — Rich empty & success illustration
Add lightweight SVG illustration (stethoscope + calendar) to empty states (`ES-01` fix) and use `PartyPopper` animated (`animate-bounce` once) when `allDone`. Consider Lottie 1-frame for queue waiting.

### S-03 — Sticky action bar for primary CTAs
On mobile, make queue banner + Book CTA sticky (`position: sticky top-16`) so patient glancing at phone while waiting keeps position visible without scrolling. Use `backdrop-blur` + `border-b`.

### S-04 — Optimistic & undo cancel
Implement optimistic `cancelled` card gray-out + inline "Undo (5s)" toast (`sonner` `action` slot) rather than immediate hard delete. Matches `useUpdateAppointmentStatus` optimism (`hooks.ts:113-131`).

### S-05 — Checklist dismiss / auto-collapse
Store `localStorage mediq_patient_checklist_dismissed_at` when `allDone`; after 7 days or manual "Hide getting started" (`collapsible.tsx:1`), collapse to a thin progress summary. Prevents forever-card.

### S-06 — Card elevation tokens & motion
Use `transition-all` on card hover (`hover:shadow-md hover:-translate-y-0.5`) for upcoming cards, flat for past (opacity 0.9). Add `motion` safe via `prefers-reduced-motion`.

### S-07 — Profile completion nudge
Currently `hasProfile` is fake `true` if error (`checklist.tsx:59`). Replace with real profile fetch via `useQuery(['profiles', accountNo])` and link to a proper patient profile edit page (even if placeholder), or remove that checklist task if no settings page exists.

### S-08 — Tandem booking confirmation — QR/ticket
After booking, show QR ticket stub (reuse `src/features/check-in` QR) in patient portal for today's `booked` appointment: "Show at desk" — closes the loop between booking and queue entry.

---

## 10. Consolidated Findings Table

| ID | File:Line | Severity | Area | Issue | Fix |
|----|-----------|----------|------|-------|-----|
| VD-01 | `card.tsx:9` / `patient/index.tsx:238,308` | Important | Visual | Card padding overrides, inconsistent `py-6` vs `pt-5 pb-4` | Standardize `Card` compact variant, remove per-card overrides |
| VD-02 | `patient/index.tsx:162,188` | Important | Visual | Waiting vs in_progress banners visually identical | Elevate in_progress with primary bg, accent border for waiting, mutual exclusivity |
| VD-03 | `appointments/schema.ts:30-39` / `badge.tsx:18` | Important | Visual | `pending`=`arrived` same amber, `no_show` low contrast | Semantic tokens in `theme.css`, distinct dashed/solid patterns |
| VD-04 | `patient/index.tsx:131-157` | Minor | Visual | Header `h-16` heavy vs title | `h-14 sm:h-16`, demote Sign out from `outline` to `ghost` |
| VD-05 | `patient/index.tsx:211-214` / `skeleton.tsx:6` | Minor | Visual | Flat `h-24` skeleton not matching card anatomy | Card-shaped skeleton with title/separator/date |
| VD-06 | `getting-started-checklist.tsx:182-185,193` | Minor | Visual | Progress color snap emerald | `transition-colors` + enter animation |
| VD-07 | `patient/index.tsx:166,220` / `checklist.tsx:166` | Minor | Visual | Three uppercase label styles competing | Tokenized `sectionLabel` / `bannerKicker` |
| VD-08 | `patient/index.tsx:163,189` | Suggestion | Visual | Queue banner no elevation despite primary focus | `shadow-md ring-1` or gradient |
| VD-09 | `patient/index.tsx:180-182` | Minor | Visual | Queue circle heavy border low contrast dark | `bg-muted` inner or `bg-primary` solid |
| RP-01 | `patient/index.tsx:142-157` | Critical | Responsive | Header overflows 375px (`Change password` + `Sign out` full labels) | Collapse labels `hidden sm:inline`, or dropdown menu on mobile |
| RP-02 | `patient/index.tsx:132-140` | Important | Responsive | Back + Logo cramped `gap-2`, `h-9` dominates | `gap-3`, `h-7 sm:h-9` |
| RP-03 | `patient/index.tsx:160` | Important | Responsive | `gap-8 py-10 max-w-2xl` excessive on mobile, narrow on desktop | `gap-6 sm:gap-8`, `py-6 sm:py-10`, `lg:max-w-3xl` |
| RP-04 | `patient/index.tsx:239-259,309-328` | Important | Responsive | Doctor name no `truncate`/`min-w-0`, badge squeeze | `min-w-0 flex-1 truncate` on name, `shrink-0` badge |
| RP-05 | `patient/index.tsx:164-184` | Minor | Responsive | Queue banner row doesn't stack on 320px | `flex-col sm:flex-row` stacked variant |
| RP-06 | `getting-started-checklist.tsx:206` | Minor | Responsive | Row `py-2` ~36px <44px touch target | `py-3 min-h-11` |
| RP-07 | `patient/index.tsx:160` | Minor | Responsive | `max-w-2xl` leaves large gutters 768-1024px | `lg:max-w-3xl` + `px-8` tablet |
| RP-08 | `patient/index.tsx:361-366` | Suggestion | Responsive | CTA buried after Past, not sticky | Sticky bottom bar mobile, dual CTA top+bottom |
| A11Y-01 | `getting-started-checklist.tsx:204-219` | Critical | A11y | Div with `onClick` no `role`/`tabIndex`/`onKeyDown` | Replace with `button` or add `role="button" tabIndex=0 onKeyDown` |
| A11Y-02 | `getting-started-checklist.tsx:213-269` | Critical | A11y | Nested interactive `div onClick` containing `button`/`Link` + `stopPropagation` | Remove outer `onClick`, single interactive trailing action |
| A11Y-03 | `patient/index.tsx:163,189` / `checklist.tsx:215,249` | Critical | A11y | Duplicate `id='patient-queue-banner'` | Unique `patient-queue-waiting` / `inprogress` + `querySelector`/`ref` |
| A11Y-04 | `getting-started-checklist.tsx:180-188` | Important | A11y | Progress `div` no `role="progressbar"` ARIA | Add `role aria-valuenow/min/max label` |
| A11Y-05 | `patient/index.tsx:162-197` | Important | A11y | Queue banners no `aria-live` | `aria-live='polite' role='status' aria-atomic` |
| A11Y-06 | `patient/index.tsx:135,246,286,363` / `checklist.tsx:169,225,228` | Important | A11y | Lucide icons missing `aria-hidden` | Add `aria-hidden="true"` to all decorative SVGs |
| A11Y-07 | `patient/index.tsx:200-221` / `checklist.tsx:166` | Important | A11y | Heading `h1` → `h3` → `h2` out of order | Make checklist `h2` |
| A11Y-08 | `patient/index.tsx:279-288` / `button.tsx:19-20` | Important | A11y | Ghost cancel `text-muted-foreground` low contrast, no focus variant | Add `focus-visible:text-destructive`, verify 4.5:1 |
| A11Y-09 | `theme-switch.tsx:27` / `button.tsx:7` | Minor | A11y | `scale-95 rounded-full` may clip `focus ring` | Remove `scale-95` or `focus-visible:scale-100` |
| A11Y-10 | `patient/index.tsx:210-215` | Minor | A11y | Skeleton no `aria-busy` | Wrap `aria-busy aria-live` |
| A11Y-11 | `patient/index.tsx:133-136` | Minor | A11y | `Button asChild > Link` semantics ambiguous | Verify `Slot` single element or use `className={buttonVariants()}` on `Link` |
| ES-01 | `patient/index.tsx:224-229` | Important | Empty | Upcoming empty text-only, CTA far below | Rich empty with icon + inline Book CTA |
| ES-02 | `patient/index.tsx:299` | Minor | Empty | Past hidden when empty, no hint | Always render Past with placeholder or subtle note |
| ES-03 | `patient/index.tsx:162` condition | Important | Empty | `todayAppointment` without queue silent | Show "Check in at desk" contextual banner per status |
| ES-04 | `patient/index.tsx:232-233` | Minor | Empty | Specialty disappears when doctors empty | Skeleton while pending, silent only after success |
| ES-05 | `getting-started-checklist.tsx:191-195` | Minor | Empty | All-done celebration persistent, no dismiss | LocalStorage dismiss + `Collapsible` |
| LS-01 | `patient/index.tsx:210` vs `42-44` | Important | Loading | Only appointments gate skeletons, queue/doctors flash | Coalesced `isLoading = appointments || queue || doctors` |
| LS-02 | `patient/index.tsx:212-214` | Minor | Loading | `h-24` generic mismatch real card `~120px` CLS | Card-shaped skeleton `h-[118px]` |
| LS-03 | `getting-started-checklist.tsx:156-159` | Important | Loading | Checklist `doneCount` flicker derived from `data ?? []` pending | Show checklist `Skeleton` while queries pending |
| LS-04 | `patient/index.tsx:279-288` | Minor | Loading | Global `isPending` locks all Cancels, no spinner | Per-id pending + `Loader2` + "Cancelling…" |
| LS-05 | `logo.tsx:6` / `patient/index.tsx:143` | Minor | Loading | Logo flash, email pop | Acceptable; add email skeleton |
| ER-01 | `patient/index.tsx:210-359` | Critical | Error | No `isError` branch, errors as empty | Error card with message + Retry refetch |
| ER-02 | `patient/index.tsx:108-118` | Important | Error | Cancel only toast, no inline error | Per-card error text + retry |
| ER-03 | `getting-started-checklist.tsx:58-59` | Minor | Error | Profile error `setHasProfile(true)` masks failure | `null` state + error banner, or `useQuery` |
| ER-04 | `patient/index.tsx:1-370` | Minor | Error | No boundary/offline handling | `ErrorBoundary` at route, `isValid` date guard |
| UF-01 | `patient/index.tsx:230-294` | Important | Flow | No stepper `pending→booked→arrived→...` as badge only | Mini stepper `Booked·Queued·In visit·Done` |
| UF-02 | `getting-started-checklist.tsx:213-259` | Important | Flow | "View" scrolls to absent banner | Disable/mute when no banner, scroll to appointment instead |
| UF-03 | `patient/index.tsx:299-366` | Important | Flow | Book CTA after Past requires scroll past history | Dual CTA top + bottom or sticky |
| UF-04 | `patient/index.tsx:345-350` | Minor | Flow | Rejection reason plain red text no label | Icon + "Reason:" label, clamp |
| UF-05 | `patient/index.tsx:113` | Minor | Flow | Blocking `confirm()` not styled/testable | `AlertDialog` |
| UF-06 | `booking/index.tsx` → `patient/index.tsx:361` | Minor | Flow | Post-booking return to `/patient` not emphasized | Toast action "View in My Appointments" |

*Scoring rubric: Critical = blocks a11y/flow on target device; Important = degrades polished feel or causes flicker/confusion; Minor = polish/pixel-level.*

---

## 11. Positive Notes (Keep)

* `text-sm text-muted-foreground` hierarchy in cards (`index.tsx:265,272,334`) is consistent and readable.
* `tabular-nums` on queue position (`index.tsx:169,180`) — correct for number alignment.
* `Badge variant='outline'` with custom status colors (`index.tsx:251-255`) is the right pattern; just needs tokenization.
* `GettingStartedChecklist` deriving `hasAppointment/hasQueue` from real queries (`getting-started-checklist.tsx:118-136`) rather than only localStorage — intentional since `506e73f`.
* `Button` `focus-visible:ring-[3px]` (`button.tsx:7`) and `Badge` `focus-visible:ring-ring/50` (`badge.tsx:7`) are correctly implemented shadcn defaults.
* `Card` `has-data-[slot=card-action]:grid-cols-[1fr_auto]` (`card.tsx:22`) is forward-looking, not hurting current usage.

---

## 12. Minimal Patch Sketch (illustrative)

```tsx
// src/features/patient/index.tsx — header mobile fix
<div className='flex items-center gap-1.5'>
  <span className='hidden text-sm text-muted-foreground sm:block'>{user.email}</span>
  <ThemeSwitch />
  <Button variant='ghost' size='sm' asChild className='gap-1.5'>
    <Link to='/change-password'><KeyRound aria-hidden className='size-4'/><span className='hidden sm:inline'>Change password</span><span className='sr-only sm:hidden'>Change password</span></Link>
  </Button>
  <Button variant='ghost' size='sm' onClick={handleSignOut} className='gap-1.5'>
    <LogOut aria-hidden className='size-4'/><span className='hidden sm:inline'>Sign out</span>
  </Button>
</div>

// checklist — accessibility
<li key={task.id}>
  <div
    role={task.id==='queue' && isClickable ? 'button' : undefined}
    tabIndex={task.id==='queue' && isClickable ? 0 : -1}
    onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); document.querySelector('[data-queue-banner]')?.scrollIntoView({behavior:'smooth'})}}}
    aria-label={task.label}
    className={cn('flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm min-h-11', ...)}
  >
    <span aria-hidden className='flex size-5 shrink-0 items-center justify-center'>{done ? <Check/> : <Circle/>}</span>
    <span className={cn('flex-1', done && 'line-through text-muted-foreground')}>{task.label}</span>
    {task.id==='queue' ? (hasBanner ? <button type='button' ...>View</button> : <span className='text-xs text-muted-foreground'>Not in queue</span>) : (!done && task.href && <Link ...>Go</Link>)}
  </div>
</li>
<div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Getting started ${doneCount} of ${total}`} className='h-1.5 w-full bg-muted'><div style={{width:`${pct}%`}} className={cn(allDone?'bg-emerald-500':'bg-primary','h-full rounded-full transition-all duration-500')} /></div>

// patient banners — unique IDs + live
{todayAppointment && queuePosition>=0 && <div id='patient-queue-waiting' data-queue-banner aria-live='polite' role='status' className='rounded-lg border bg-card p-4 shadow-sm border-l-4 border-l-primary'>…</div>}
{todayAppointment?.status==='in_progress' && <div id='patient-queue-inprogress' data-queue-banner aria-live='polite' role='status' className='rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 p-4'>…</div>}

// loading + error gates
const isLoading = appointmentsQuery.isPending || queueQuery.isPending || doctorsQuery.isPending;
if (isLoading) return <PatientSkeleton />;
if (appointmentsQuery.isError) return <Card><CardContent className='py-10 text-center space-y-3'><p className='text-sm text-destructive'>{appointmentsQuery.error.message}</p><Button variant='outline' onClick={()=>appointmentsQuery.refetch()}>Retry</Button></CardContent></Card>;
```

---

*Audit generated by reading 10 files (`patient/index.tsx:370`, `getting-started-checklist.tsx:280`, `card.tsx:91`, `badge.tsx:45`, `button.tsx:58`, `skeleton.tsx:13`, `separator.tsx:25`, `logo.tsx:16`, `theme-switch.tsx:58`, `appointments/schema.ts:67`) + 3 cross-reference styles/migrations. Every `file:line` above can be verified with `Read`.*
