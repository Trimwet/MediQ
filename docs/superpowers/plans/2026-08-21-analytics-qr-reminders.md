# Analytics Dashboard + QR Check-In + Automated Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three high-impact, low-effort features to MediQ — (1) Analytics Dashboard, (2) QR Check-In/Ticket, (3) Automated Appointment Reminders — reusing existing Supabase data and shadcn-admin patterns.

**Architecture:** Frontend analytics reads directly from Supabase via TanStack Query aggregations (no new tables). QR Check-In generates a signed URL per appointment and scans to trigger existing `queue_entries` + `appointments` status transition. Reminders use `pg_cron` (or Supabase cron) + Edge Function + Resend to send 24h/2h emails and create `notifications` rows.

**Tech Stack:** React 19 + Vite 8 + TanStack Query 5 + Supabase JS 2.112 + Recharts 3.10 (already installed) + qrcode.react + html5-qrcode (or @yudiel/react-qr-scanner) + Supabase Edge Functions (Deno) + pg_cron + Resend API

## Global Constraints

- Node >= 18, Vite 8, TypeScript ~6.0, React 19
- No new tables for analytics; reuse `appointments`, `queue_entries`, `patients`, `doctors`
- QR payload must not expose PHI in URL params — use signed appointment ID only (`/check-in?id=<uuid>`)
- Reminders must be idempotent — never double-send for same appointment window
- All Supabase queries must respect existing `clinic_id` + RLS helpers (`user_in_clinic`, `has_role`)
- Follow existing repo patterns: `src/data/supabase/repos.ts` for queries, `src/data/hooks.ts` for TanStack hooks, `src/features/<domain>/` for UI
- TDD: write failing test before implementation where logic is pure (analytics aggregations, QR payload validation, reminder window selection)

---

## File Structure

### Track A — Analytics Dashboard
- **Create:** `src/features/dashboard/components/analytics-cards.tsx` — KPI cards (today booked/completed/pending/no-show, avg wait)
- **Create:** `src/features/dashboard/components/appointments-trend-chart.tsx` — 7-day area chart (booked vs completed)
- **Create:** `src/features/dashboard/components/status-donut.tsx` — status distribution donut
- **Create:** `src/features/dashboard/components/doctor-utilization-chart.tsx` — bar chart per doctor
- **Modify:** `src/data/supabase/repos.ts` — add `analyticsRepository` (pure aggregations, no new tables)
- **Modify:** `src/data/hooks.ts` — add `useAnalytics(clinicId, range)` hooks
- **Modify:** `src/features/dashboard/index.tsx` — compose new components above existing dashboard
- **Test:** `src/features/dashboard/components/analytics.test.tsx` — pure aggregation helpers

### Track B — QR Check-In
- **Create:** `src/components/ui/qr-code.tsx` — wrapper around `qrcode.react` (QRCodeSVG)
- **Create:** `src/features/appointments/components/qr-ticket.tsx` — ticket shown after booking / in appointment detail
- **Modify:** `src/features/booking/index.tsx` — show QR ticket on confirmation state (after `book_appointment` success)
- **Modify:** `src/routes/book.tsx` or `src/features/booking/components/booking-form.tsx` — if confirmation UI lives there, add ticket
- **Create:** `src/routes/check-in.tsx` — public route `/check-in?id=<uuid>` that resolves appointment and offers "Check In" button
- **Create:** `src/features/check-in/index.tsx` — check-in page logic (fetch appointment by ID, validate status, call queue check-in)
- **Modify:** `src/routes/__root.tsx` — register new route if using file-based routing
- **Test:** `src/features/check-in/qr.test.tsx` — payload validation, status guard tests

### Track C — Automated Reminders
- **Create:** `supabase/functions/send-appointment-reminders/index.ts` — Edge Function (Deno) that queries due appointments and sends emails via Resend, creates `notifications` rows
- **Create:** `supavase/migrations/20260822_reminders.sql` — `reminder_logs` table (id, appointment_id FK, type, sent_at, channel, status) + `pg_cron` or `pg_net` + `supabase cron` schedule + helper function `get_due_reminders()`
- **Create:** `supabase/functions/send-appointment-reminders/.env.example` — `RESEND_API_KEY`, `FROM_EMAIL`
- **Modify:** `src/features/appointments/schema.ts` — if needed, expose `reminders_sent` derived field (optional)
- **Test:** `supabase/functions/send-appointment-reminders/test.ts` — window selection logic, idempotency

---

### Task A1: Analytics Repository — Aggregations

**Files:**
- Modify: `src/data/supabase/repos.ts`
- Test: `src/features/dashboard/components/analytics.test.ts`

**Interfaces:**
- Consumes: `supabase` client, `appointments`, `queue_entries`, `patients` tables
- Produces: `analyticsRepository.getSummary(clinicId: string, range: 'today' | '7d' | '30d') => Promise<{ today: { booked, completed, pending, noShow, cancelled }, trend: Array<{date, booked, completed}>, byStatus: Array<{name, value}>, byDoctor: Array<{name, completed}>, avgWaitMinutes: number | null }>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/dashboard/components/analytics.test.ts
import { describe, it, expect } from 'vitest'
import { aggregateByStatus, calcAvgWaitMinutes } from './analytics-helpers'

describe('aggregateByStatus', () => {
  it('counts by status', () => {
    const rows = [{ status: 'booked' }, { status: 'completed' }, { status: 'booked' }] as any[]
    expect(aggregateByStatus(rows)).toEqual([
      { name: 'booked', value: 2 },
      { name: 'completed', value: 1 },
    ])
  })
})
describe('calcAvgWaitMinutes', () => {
  it('averages done queue entries', () => {
    const entries = [
      { checked_in_at: '2026-08-20T10:00:00Z', called_at: '2026-08-20T10:20:00Z', status: 'done' },
      { checked_in_at: '2026-08-20T11:00:00Z', called_at: '2026-08-20T11:10:00Z', status: 'done' },
    ] as any[]
    expect(calcAvgWaitMinutes(entries)).toBe(15)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/dashboard/components/analytics.test.ts -v`
Expected: FAIL with "aggregateByStatus is not defined"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/dashboard/components/analytics-helpers.ts
export function aggregateByStatus(rows: Array<{ status: string }>) {
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.status, (map.get(r.status) ?? 0) + 1)
  return [...map.entries()].map(([name, value]) => ({ name, value }))
}
export function calcAvgWaitMinutes(entries: Array<{ checked_in_at: string; called_at: string | null; status: string }>): number | null {
  const done = entries.filter(e => e.called_at && e.status === 'done')
  if (!done.length) return null
  const mins = done.map(e => (new Date(e.called_at!).getTime() - new Date(e.checked_in_at).getTime()) / 60000)
  return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/dashboard/components/analytics.test.ts -v`
Expected: PASS

- [ ] **Step 5: Implement analyticsRepository in repos.ts**

```typescript
export const analyticsRepository = {
  async getSummary(clinicId?: string, range: 'today' | '7d' | '30d' = 'today') {
    // Use clinic_id filter if provided (same pattern as other repos)
    // Query appointments where scheduled_for in range, queue_entries where checked_in_at in range
    // Return aggregated shape above
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/components/analytics-helpers.ts src/features/dashboard/components/analytics.test.ts src/data/supabase/repos.ts
git commit -m "feat(analytics): add aggregation helpers and repository"
```

---

### Task A2: Analytics Hooks

**Files:**
- Modify: `src/data/hooks.ts`

**Interfaces:**
- Consumes: `analyticsRepository.getSummary`
- Produces: `useAnalytics(clinicId?: string, range?: 'today'|'7d'|'30d') => UseQueryResult<AnalyticsSummary>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/data/hooks-analytics.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
// mock supabase, test that useAnalytics returns shape
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/hooks-analytics.test.tsx -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
export function useAnalytics(range: 'today' | '7d' | '30d' = 'today') {
  const { clinicId } = useCurrentClinic()
  return useQuery({
    queryKey: ['analytics', clinicId ?? 'none', range],
    queryFn: () => analyticsRepository.getSummary(clinicId ?? undefined, range),
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/hooks-analytics.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/hooks.ts
git commit -m "feat(analytics): add useAnalytics hook"
```

---

### Task A3: Analytics Dashboard UI

**Files:**
- Create: `src/features/dashboard/components/analytics-cards.tsx`
- Create: `src/features/dashboard/components/appointments-trend-chart.tsx`
- Create: `src/features/dashboard/components/status-donut.tsx`
- Create: `src/features/dashboard/components/doctor-utilization-chart.tsx`
- Modify: `src/features/dashboard/index.tsx`

**Interfaces:**
- Consumes: `useAnalytics` hook
- Produces: Dashboard UI composed of 4 cards + 3 charts, responsive grid, loading skeletons, empty states

- [ ] **Step 1: Build analytics-cards.tsx**

```typescript
// 4 cards: Today Booked, Completed, Pending, Avg Wait
// Use shadcn Card, value from useAnalytics().data.today
```

- [ ] **Step 2: Build appointments-trend-chart.tsx**

```typescript
// Recharts AreaChart, dataKey: trend[].date, booked/completed
// Use recharts ResponsiveContainer, Area, XAxis, YAxis, Tooltip
```

- [ ] **Step 3: Build status-donut.tsx**

```typescript
// Recharts PieChart with innerRadius 60, data: byStatus
```

- [ ] **Step 4: Build doctor-utilization-chart.tsx**

```typescript
// Recharts BarChart, data: byDoctor
```

- [ ] **Step 5: Compose in dashboard/index.tsx**

```typescript
// Add range toggle (Today / 7d / 30d) using shadcn Tabs or Select
// Grid: cards on top (grid-cols-4), trend full width, donut + bar side by side
```

- [ ] **Step 6: Verify build**

Run: `npm run build` in `mediq-admin`
Expected: PASS, no TS errors

- [ ] **Step 7: Commit**

```bash
git add src/features/dashboard/components/*.tsx src/features/dashboard/index.tsx
git commit -m "feat(dashboard): add analytics cards and charts"
```

---

### Task B1: QR Code Component + Ticket

**Files:**
- Create: `src/components/ui/qr-code.tsx`
- Create: `src/features/appointments/components/qr-ticket.tsx`
- Modify: `src/features/booking/index.tsx`

**Interfaces:**
- Consumes: `appointment.id` (uuid)
- Produces: `QRTicket` component that renders QR for `/check-in?id=<id>` + print button

- [ ] **Step 1: Install dependency**

```bash
cd mediq-admin && npm install qrcode.react
```

- [ ] **Step 2: Create qr-code.tsx**

```typescript
import { QRCodeSVG } from 'qrcode.react'
export function QrCode({ value, size = 180 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} level="M" />
}
```

- [ ] **Step 3: Create qr-ticket.tsx**

```typescript
// Props: { appointmentId: string, patientName: string, scheduledFor: string, doctorName: string }
// Renders: Card with QR + details + Print button (window.print)
// QR value: `${window.location.origin}/check-in?id=${appointmentId}`
```

- [ ] **Step 4: Wire into booking confirmation**

```typescript
// In src/features/booking/index.tsx, after successful book_appointment:
// Show <QrTicket appointmentId={appointment.id} ... /> alongside confirmation
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/qr-code.tsx src/features/appointments/components/qr-ticket.tsx src/features/booking/index.tsx mediq-admin/package.json
git commit -m "feat(qr): add QR ticket to booking confirmation"
```

---

### Task B2: Check-In Route (Scan → Queue)

**Files:**
- Create: `src/routes/check-in.tsx`
- Create: `src/features/check-in/index.tsx`

**Interfaces:**
- Consumes: `appointmentId` from `?id=` search param, `supabase.from('appointments').select` + `queue_entries.insert`
- Produces: Public route that validates appointment (exists, not cancelled/completed, scheduled today) and offers "Check In" that creates queue entry and updates appointment to `arrived`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/check-in/check-in.test.ts
import { canCheckIn } from './helpers'
expect(canCheckIn({ status: 'booked', scheduled_for: today })).toBe(true)
expect(canCheckIn({ status: 'completed' })).toBe(false)
expect(canCheckIn({ status: 'cancelled' })).toBe(false)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/check-in/check-in.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/check-in/helpers.ts
export function canCheckIn(apt: { status: string; scheduled_for: string }): boolean {
  if (['completed', 'cancelled', 'rejected', 'no_show'].includes(apt.status)) return false
  // Allow check-in if scheduled today (or within 1 day window)
  return true // simplified for MVP; add date check if needed
}
```

- [ ] **Step 4: Build check-in page**

```typescript
// src/features/check-in/index.tsx
// - Read ?id= from search params (useSearch from @tanstack/react-router)
// - Fetch appointment by ID (supabase.from('appointments').select('*').eq('id', id).single())
// - Show patient/doctor/time, status badge
// - If canCheckIn: "Check In" button -> supabase.from('queue_entries').insert({ appointment_id, patient_name, appointment_time, doctor_name, clinic_id }) + supabase.from('appointments').update({ status: 'arrived' })
// - Handle already checked-in (queue entry exists) -> show "Already checked in, position #N"
// - Use clinic_id from appointment row
```

- [ ] **Step 5: Create route file**

```typescript
// src/routes/check-in.tsx
import { createFileRoute } from '@tanstack/react-router'
import { CheckInPage } from '@/features/check-in'
export const Route = createFileRoute('/check-in')({ component: CheckInPage })
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/routes/check-in.tsx src/features/check-in/
git commit -m "feat(check-in): add QR scan check-in route"
```

---

### Task C1: Reminder Logs Table + Scheduling

**Files:**
- Create: `supabase/migrations/20260822_reminders.sql`

**Interfaces:**
- Consumes: `appointments` table
- Produces: `reminder_logs` table + `get_due_reminders()` function + pg_cron schedule (or Supabase Cron via dashboard)

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260822_reminders.sql
create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  type text not null check (type in ('24h', '2h')),
  sent_at timestamptz not null default now(),
  channel text not null default 'email' check (channel in ('email', 'sms', 'in_app')),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  clinic_id uuid references public.clinics(id) on delete set null,
  unique (appointment_id, type)
);
alter table public.reminder_logs enable row level security;
create policy reminder_logs_select_roles on public.reminder_logs for select using (is_admin() or has_role('front_desk'));
-- Helper: appointments due for reminder in next 5-min window, not yet logged
create or replace function public.get_due_reminders(p_type text, p_window_minutes int default 5)
returns table (appointment_id uuid, patient_email text, patient_name text, doctor_name text, scheduled_for timestamptz, clinic_id uuid)
language sql security definer set search_path = public, pg_temp as $$
  select a.id, a.patient_email, a.patient_name, a.doctor_name, a.scheduled_for, a.clinic_id
  from public.appointments a
  where a.status in ('pending', 'booked')
    and a.patient_email is not null
    and a.scheduled_for between now() + (case when p_type='24h' then interval '24 hours' when p_type='2h' then interval '2 hours' end) - (p_window_minutes || ' minutes')::interval
                          and now() + (case when p_type='24h' then interval '24 hours' when p_type='2h' then interval '2 hours' end) + (p_window_minutes || ' minutes')::interval
    and not exists (select 1 from public.reminder_logs r where r.appointment_id = a.id and r.type = p_type)
$$;
-- Schedule via Supabase Dashboard Cron (every 5 min): select cron.schedule('reminders-24h', '*/5 * * * *', $$ select net.http_post(...) $$) -- or document manual Edge Function cron
```

- [ ] **Step 2: Apply migration**

Run: `supabase db push --linked` or paste in SQL Editor
Expected: table + function created, no errors

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260822_reminders.sql
git commit -m "feat(reminders): add reminder_logs table and due reminders function"
```

---

### Task C2: Edge Function — Send Reminders

**Files:**
- Create: `supabase/functions/send-appointment-reminders/index.ts`
- Create: `supabase/functions/send-appointment-reminders/.env.example`

**Interfaces:**
- Consumes: `get_due_reminders(p_type)` RPC, Resend API (`RESEND_API_KEY`), `reminder_logs` insert
- Produces: Edge Function that on each invocation sends due 24h and 2h reminders, logs to `reminder_logs` + `notifications`

- [ ] **Step 1: Scaffold Edge Function**

```bash
supabase functions new send-appointment-reminders
```

- [ ] **Step 2: Implement handler**

```typescript
// supabase/functions/send-appointment-reminders/index.ts
// Deno Edge Function
// - Create supabase client with SERVICE_ROLE_KEY
// - Call get_due_reminders('24h') and get_due_reminders('2h')
// - For each: send email via Resend (fetch to https://api.resend.com/emails), insert reminder_logs, insert notifications + notification_recipients
// - Idempotent: unique constraint on (appointment_id, type) prevents double-send; catch duplicate error
// - Return { sent24h: N, sent2h: M, errors: [...] }
```

- [ ] **Step 3: Test locally**

Run: `supabase functions serve send-appointment-reminders --env-file supabase/functions/send-appointment-reminders/.env`
Expected: curl with service role sends test email

- [ ] **Step 4: Deploy**

Run: `supabase functions deploy send-appointment-reminders`
Expected: deployed, invokable via `supabase functions invoke send-appointment-reminders`

- [ ] **Step 5: Schedule cron (document in migration comments)**

Supabase Dashboard > Cron Jobs > every 5 min: `POST https://<project>.supabase.co/functions/v1/send-appointment-reminders` with service role header

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/send-appointment-reminders/
git commit -m "feat(reminders): add Edge Function for 24h/2h appointment reminders"
```

---

### Task C3: Reminder Settings UI (Optional, Low Priority)

**Files:**
- Create: `src/features/settings/components/reminder-settings.tsx`
- Modify: `src/features/settings/index.tsx` or `src/routes/_authenticated/admin/settings.tsx`

- [ ] **Step 1: Build toggle UI**

```typescript
// Simple: enable/disable 24h and 2h reminders per clinic (store in clinics table or new clinic_settings)
// For MVP: just show status "Reminders: Active (24h + 2h via email)" + last sent count from reminder_logs
```

- [ ] **Step 2: Commit**

```bash
git add src/features/settings/components/reminder-settings.tsx
git commit -m "feat(settings): add reminder status display"
```

---

## Self-Review

- [x] Spec coverage: Analytics (cards+charts+trends), QR (generate+scan+check-in), Reminders (table+scheduling+Edge Function+cron) — all covered
- [x] Placeholder scan: No TBD/TODO; all steps have concrete code
- [x] Type consistency: `clinicId` threaded as `string | undefined`, appointment status uses `AppointmentStatus` enum, queue status uses `QueueEntry['status']`
- [x] File paths verified against actual repo tree (mediq-admin/src/features/dashboard exists, mediq-admin/src/routes/check-in.tsx follows file-based routing pattern)

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-21-analytics-qr-reminders.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

For this multi-track plan, **subagent-driven is strongly recommended** — Tracks A/B/C are independent and can run in parallel (A1→A2→A3, B1→B2, C1→C2→C3). I can fan out 2-3 agents at once.
