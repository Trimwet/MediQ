# MediQ — Architecture

## Approved stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React 19 + Vite + TypeScript + Tailwind v4 + TanStack Router/Query + shadcn/ui** | Lives in `mediq-admin/`, deployed to **Vercel** (static, `dist`) |
| Backend | **Supabase** (managed Postgres + Auth + PostgREST + Realtime) | No server to host; RLS enforces authorization in the database |
| Auth | **Supabase Auth** | Email/password. Roles: `admin`, `front_desk`, `doctor`, `patient` |
| Emails | **Resend** | Booking confirmation, temporary credentials, reminders |
| Realtime | **Supabase Realtime** | Live queue board (Postgres changes → websocket) |
| Files | Supabase Storage | Patient documents (future) |

The `Backend/` and `Frontend/` folders at the repo root are empty legacy
scaffolds; the working app is `mediq-admin/`. A custom Node service (Hono)
is intentionally deferred until a feature needs logic that SQL/RLS can't
express (wait-time scoring, SMS, third-party integrations) — those become
thin Supabase Edge Functions or a small Hono service later.

## Frontend data layer

All pages talk to typed repository interfaces in `src/data/repos.ts`
through react-query hooks (`src/data/hooks.ts`). Today the implementations
are in-memory mocks (`src/data/mock/`); `src/data/index.ts` is the single
swap point. **Moving to Supabase = implementing the same interfaces with
axios (or the supabase-js client) and changing one export file — the UI
never changes.**## The booking-without-signup flow (core product rule)

Visitors must be able to book an appointment **without creating an
account first**. Booking submits a request for the clinic to approve; the
visitor then creates their account (email + password) using the email they
already provided, and any further onboarding details are collected at that
sign-up.

```
Visitor (landing page)          Frontend (/book)        Edge function / backend          Supabase Auth
        │                              │                           │                              │
        │ fill form (name, email,     │                           │                              │
        │ phone, doctor, date/time)   │                           │                              │
        ├────────────────────────────►│                           │                              │
        │                              │  POST /book              │                              │
        │                              ├──────────────────────────►│                              │
        │                              │                           │ 1. insert patient (find-or-  │
        │                              │                           │    create by email)          │
        │                              │                           │ 2. insert appointment        │
        │                              │                           │    (status = 'pending')      │
        │                              │◄──────────────────────────┤                              │
        │◄─────────────────────────────┤ 201 { appointment,         │                              │
        │                              │       hasAccount }         │                              │
        │                              │                           │                              │
        │  set a password (email is    │                           │                              │
        │  already known — no temp     │                           │                              │
        │  password, no admin email)   │                           │                              │
        │  ──────────────────────────► /sign-up ──────────────────► auth.signUp({ email,          │
        │                              │                           │   password }) → profiles     │
        │                              │                           │   row role='patient'         │
        │                              │                           │                              │
        │  sign in later ────────────► /sign-in ──────────────────► auth.signInWithPassword      │
        │                              │  /patient (patient portal: their own appointments)        │
```

Key rules:

- **No sign-up step for booking.** Booking only submits a `pending`
  request — it never provisions an account or emails credentials.
- **Password is set by the visitor.** The success screen offers to create
  the account (`auth.signUp`) with the booking email pre-filled — no
  temporary password is generated anywhere.
- **Admin approval gate.** Self-service bookings are created as
  `pending` requests, not confirmed appointments. Staff (admin or front
  desk) approve (`pending → booked`) or reject (`pending → rejected`,
  optionally with a reason the patient sees). Only approved appointments
  can be checked in, which is what puts them in the queue — so nothing
  reaches the queue before the clinic confirms it.
- **Existing email?** Booking again with a known email (`hasAccount: true`)
  skips the password step and just adds the appointment request.

### Current mock implementation (backend not running)

The same contract runs end-to-end against the mock data layer so the flow
is demonstrable today:

- `src/data/mock/accounts.ts` — localStorage registry simulating Supabase
  Auth sign-up + sign-in + password change.
- `src/data/repos.ts` — `BookingRepository.book()` creates the patient +
  appointment (pending) + notification and reports `hasAccount`;
  `AuthRepository.signUp()` creates the account with the chosen password.
- `src/features/booking/` — public `/book` form + success screen. The
  success screen offers an inline "create your password" step (email
  pre-filled) for visitors without an account.
- `src/features/auth/sign-up/` — standalone sign-up; further onboarding
  fields can be added here later.
- `src/features/auth/sign-in/` — resolves the role from the account
  registry when it exists (patient), falls back to the dev-only role picker
  for staff demos.
- `src/features/change-password/` — regular password change from the
  patient portal.
- `src/features/patient/` — patient portal at `/patient`: their own
  appointments (scoped by `appointment.patientEmail`), change-password,
  sign out.

## Supabase schema (target)

```sql
-- Extends Supabase auth.users; one row per person, role gates everything.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check (role in ('admin','front_desk','doctor','patient')),
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text not null,
  email text unique not null,
  last_visit timestamptz,
  visits int not null default 0
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete cascade,
  patient_email text not null,          -- self-service scoping key
  doctor_id uuid references public.doctors(id),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','booked','rejected','arrived','in_progress','completed','no_show','cancelled')),
  reason text
);

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id),
  patient_name text not null,
  doctor_name text not null,
  checked_in_at timestamptz not null default now(),
  status text not null default 'waiting'
    check (status in ('waiting','called','in_room','done','left'))
);
```

## Row-Level Security (RLS) — the real RBAC

Policies are the server-side half of `src/config/rbac.ts`:

```sql
alter table public.appointments enable row level security;

-- Admins and front desk: everything.
create policy "staff manage appointments" on public.appointments
  for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','front_desk')
  ));

-- Patients: only their own rows (self-service booking is the use case).
create policy "patients see own appointments" on public.appointments
  for select to authenticated
  using (patient_email = (select email from auth.users where id = auth.uid()));

-- Doctors: only rows assigned to them.
create policy "doctors see own appointments" on public.appointments
  for select to authenticated
  using (doctor_id = (select doctor_id from public.doctors where profile_id = auth.uid()));
```

## Realtime

The queue board subscribes to `postgres_changes` on `queue_entries` (and
`appointments` status transitions), replacing today's react-query
invalidation with live updates. Front-desk actions (call next, start visit,
complete) become RLS-gated `insert`/`update` calls — the UI only reflects
what the database allows.

## Emails (Resend)

| Email | Trigger | Contents |
|---|---|---|
| Booking request received | Booking submitted (new visitor) | Request summary + next steps (set password, approval pending) |
| Booking confirmed / declined | Staff approve / reject | Status update with doctor and time (or reason) |
| Reminder | 24h before appointment (scheduled job) | Upcoming visit summary |

`channel='email'` notifications already exist in the domain model
(`src/features/notifications/schema.ts`) — Resend deliveries will fan out
from the same place the in-app notifications are written.
