/**
 * Multi-tenancy migration — adds clinic isolation to MediQ.
 *
 * 1. Create `clinics` table (the business entity)
 * 2. Create `clinic_members` join table (user ↔ clinic, with per-clinic role)
 * 3. Add `clinic_id` FK to every data table
 * 4. Rewrite ALL RLS policies for clinic-scoped access
 *
 * Apply via Supabase Dashboard → SQL Editor → paste and run.
 */
begin;

-- ============================================================
-- 1. CLINICS — the top-level business entity
-- ============================================================

create table if not exists public.clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  -- plan & billing
  plan       text not null default 'free'
               check (plan in ('free', 'starter', 'professional', 'enterprise')),
  status     text not null default 'active'
               check (status in ('active', 'suspended', 'trial', 'cancelled')),
  -- plan limits
  max_staff  integer not null default 5,
  -- branding (public-facing)
  logo_url   text,
  tagline    text,
  phone      text,
  email      text,
  address    text,
  -- timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinics is 'Top-level business entity. Each clinic is an isolated tenant.';

alter table public.clinics enable row level security;

-- Anyone can read active clinics (for the public booking page /c/:slug)
create policy "Public can read active clinics"
  on public.clinics for select
  using (status = 'active');

-- Clinic admins can update their own clinic
create policy "Clinic admins can update their clinic"
  on public.clinics for update
  using (
    id in (
      select clinic_id from public.clinic_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- 2. CLINIC_MEMBERS — user ↔ clinic join table
-- ============================================================

create table if not exists public.clinic_members (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'front_desk'
               check (role in ('admin', 'front_desk', 'doctor')),
  created_at timestamptz not null default now(),
  unique(clinic_id, user_id)
);

comment on table public.clinic_members is 'Maps users to clinics with a per-clinic role. A user can belong to multiple clinics.';

alter table public.clinic_members enable row level security;

-- Users can see their own memberships
create policy "Users can read own memberships"
  on public.clinic_members for select
  using (user_id = auth.uid());

-- Clinic admins can manage members in their clinic
create policy "Clinic admins can insert members"
  on public.clinic_members for insert
  with check (
    clinic_id in (
      select clinic_id from public.clinic_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Clinic admins can update members"
  on public.clinic_members for update
  using (
    clinic_id in (
      select clinic_id from public.clinic_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Clinic admins can delete members"
  on public.clinic_members for delete
  using (
    clinic_id in (
      select clinic_id from public.clinic_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- 3. ADD clinic_id TO EVERY DATA TABLE
-- ============================================================

-- Helper: get the current user's clinic_id from clinic_members
-- We use a SECURITY DEFINER function so RLS can call it without recursion.

create or replace function public.current_user_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from public.clinic_members
  where user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_user_clinic_id() is
  'Returns the first clinic_id the current user belongs to. Used by RLS policies for clinic isolation.';

-- Appointments
alter table public.appointments
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- Patients
alter table public.patients
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- Doctors
alter table public.doctors
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- Staff
alter table public.staff
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- Rooms
alter table public.rooms
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- Queue entries
alter table public.queue_entries
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- Notifications
alter table public.notifications
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- Notification recipients (add clinic_id for filtering)
alter table public.notification_recipients
  add column if not exists clinic_id uuid
  references public.clinics(id) on delete cascade;

-- ============================================================
-- 4. BACKFILL — assign existing data to a default clinic
-- ============================================================
-- Run this ONCE after the migration. Creates a default clinic and
-- assigns all existing clinicless data to it.

do $$
declare
  default_clinic_id uuid;
begin
  -- Create the default clinic if it doesn't exist
  insert into public.clinics (name, slug, plan, status)
  values ('Default Clinic', 'default', 'professional', 'active')
  on conflict (slug) do nothing
  returning id into default_clinic_id;

  -- If the ON CONFLICT fired (clinic already exists), fetch it
  if default_clinic_id is null then
    select id into default_clinic_id from public.clinics where slug = 'default';
  end if;

  -- Backfill all data tables that don't have a clinic_id yet
  update public.appointments set clinic_id = default_clinic_id where clinic_id is null;
  update public.patients    set clinic_id = default_clinic_id where clinic_id is null;
  update public.doctors     set clinic_id = default_clinic_id where clinic_id is null;
  update public.staff       set clinic_id = default_clinic_id where clinic_id is null;
  update public.rooms       set clinic_id = default_clinic_id where clinic_id is null;
  update public.queue_entries    set clinic_id = default_clinic_id where clinic_id is null;
  update public.notifications    set clinic_id = default_clinic_id where clinic_id is null;
  update public.notification_recipients set clinic_id = default_clinic_id where clinic_id is null;

  -- Link all existing staff/admin users to the default clinic
  insert into public.clinic_members (clinic_id, user_id, role)
  select
    default_clinic_id,
    p.id,
    case
      when p.role = 'admin' then 'admin'
      when p.role = 'doctor' then 'doctor'
      else 'front_desk'
    end
  from public.profiles p
  where p.role in ('admin', 'doctor', 'front_desk')
  on conflict (clinic_id, user_id) do nothing;
end $$;

-- ============================================================
-- 5. REWRITE RLS POLICIES — clinic-scoped access
-- ============================================================

-- Helper: is the user a member of this clinic (any role)?
create or replace function public.user_in_clinic(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_members
    where user_id = auth.uid()
      and clinic_id = target_clinic_id
  );
$$;

-- Helper: is the user an admin of this clinic?
create or replace function public.user_is_clinic_admin(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_members
    where user_id = auth.uid()
      and clinic_id = target_clinic_id
      and role = 'admin'
  )
  -- Also allow global admins (for bootstrap / platform management)
  or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: is the user a doctor in this clinic, and is this their row?
create or replace function public.user_is_this_doctor(target_clinic_id uuid, target_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clinic_members cm
    join public.doctors d on d.id = target_doctor_id
    where cm.user_id = auth.uid()
      and cm.clinic_id = target_clinic_id
      and cm.role = 'doctor'
      and d.email = (select email from auth.users where id = auth.uid())
  )
  -- Global admins can see everything
  or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: is the user a patient viewing their own appointment?
create or replace function public.user_is_this_patient(patient_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and lower(email) = lower(patient_email)
  )
  -- Global admins can see everything
  or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------
-- DROP ALL OLD POLICIES first, then recreate with clinic scoping
-- ----------------------------------------------------------------

-- Appointments
drop policy if exists "Staff can read all appointments" on public.appointments;
drop policy if exists "Staff can insert appointments" on public.appointments;
drop policy if exists "Staff can update appointments" on public.appointments;
drop policy if exists "Doctors see own appointments" on public.appointments;
drop policy if exists "Patients see own appointments" on public.appointments;
drop policy if exists "Anon can insert via book_appointment" on public.appointments;

-- Patients
drop policy if exists "Staff can read all patients" on public.patients;
drop policy if exists "Staff can insert patients" on public.patients;
drop policy if exists "Staff can update patients" on public.patients;

-- Doctors
drop policy if exists "Staff can read all doctors" on public.doctors;
drop policy if exists "Staff can insert doctors" on public.doctors;
drop policy if exists "Staff can update doctors" on public.doctors;
drop policy if exists "Staff can delete doctors" on public.doctors;

-- Staff
drop policy if exists "Staff can read all staff" on public.staff;
drop policy if exists "Staff can insert staff" on public.staff;
drop policy if exists "Staff can delete staff" on public.staff;

-- Rooms
drop policy if exists "Staff can read all rooms" on public.rooms;
drop policy if exists "Staff can insert rooms" on public.rooms;
drop policy if exists "Staff can update rooms" on public.rooms;

-- Queue
drop policy if exists "Staff can read all queue entries" on public.queue_entries;
drop policy if exists "Staff can insert queue entries" on public.queue_entries;
drop policy if exists "Staff can update queue entries" on public.queue_entries;

-- Notifications
drop policy if exists "Staff can read all notifications" on public.notifications;
drop policy if exists "Staff can insert notifications" on public.notifications;
drop policy if exists "Staff can update notifications" on public.notifications;

-- Notification recipients
drop policy if exists "Users can read own notification recipients" on public.notification_recipients;
drop policy if exists "Staff can insert notification recipients" on public.notification_recipients;
drop policy if exists "Users can update own notification recipients" on public.notification_recipients;
drop policy if exists "Clinic admins can update all recipients" on public.notification_recipients;

-- Profiles
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;

-- ----------------------------------------------------------------
-- NEW POLICIES — clinic-scoped
-- ----------------------------------------------------------------

-- === APPOINTMENTS ===
create policy "Clinic members can read their clinic's appointments"
  on public.appointments for select
  using (
    public.user_in_clinic(clinic_id)
    -- Doctors only see their own
    and (
      not exists (
        select 1 from public.clinic_members
        where user_id = auth.uid() and clinic_id = appointments.clinic_id and role = 'doctor'
      )
      or public.user_is_this_doctor(clinic_id, doctor_id)
      or public.user_is_this_patient(patient_email)
    )
  );

create policy "Clinic staff can insert appointments"
  on public.appointments for insert
  with check (
    public.user_in_clinic(clinic_id)
  );

create policy "Clinic members can update their clinic's appointments"
  on public.appointments for update
  using (
    public.user_in_clinic(clinic_id)
    and not exists (
      select 1 from public.clinic_members
      where user_id = auth.uid() and clinic_id = appointments.clinic_id and role = 'doctor'
    )
  );

create policy "Patients can cancel their own appointments"
  on public.appointments for update
  using (
    public.user_is_this_patient(patient_email)
    and status in ('pending', 'booked')
  );

-- === PATIENTS ===
create policy "Clinic members can read their clinic's patients"
  on public.patients for select
  using (public.user_in_clinic(clinic_id));

create policy "Clinic staff can insert patients"
  on public.patients for insert
  with check (public.user_in_clinic(clinic_id));

create policy "Clinic staff can update their clinic's patients"
  on public.patients for update
  using (public.user_in_clinic(clinic_id));

-- === DOCTORS ===
create policy "Clinic members can read their clinic's doctors"
  on public.doctors for select
  using (public.user_in_clinic(clinic_id));

create policy "Clinic admins can insert doctors"
  on public.doctors for insert
  with check (public.user_is_clinic_admin(clinic_id));

create policy "Clinic admins can update their clinic's doctors"
  on public.doctors for update
  using (public.user_is_clinic_admin(clinic_id));

create policy "Clinic admins can delete their clinic's doctors"
  on public.doctors for delete
  using (public.user_is_clinic_admin(clinic_id));

-- === STAFF ===
create policy "Clinic members can read their clinic's staff"
  on public.staff for select
  using (public.user_in_clinic(clinic_id));

create policy "Clinic admins can insert staff"
  on public.staff for insert
  with check (public.user_is_clinic_admin(clinic_id));

create policy "Clinic admins can delete their clinic's staff"
  on public.staff for delete
  using (public.user_is_clinic_admin(clinic_id));

-- === ROOMS ===
create policy "Clinic members can read their clinic's rooms"
  on public.rooms for select
  using (public.user_in_clinic(clinic_id));

create policy "Clinic staff can insert rooms"
  on public.rooms for insert
  with check (public.user_in_clinic(clinic_id));

create policy "Clinic staff can update their clinic's rooms"
  on public.rooms for update
  using (public.user_in_clinic(clinic_id));

-- === QUEUE ENTRIES ===
create policy "Clinic members can read their clinic's queue"
  on public.queue_entries for select
  using (
    public.user_in_clinic(clinic_id)
    and (
      not exists (
        select 1 from public.clinic_members
        where user_id = auth.uid() and clinic_id = queue_entries.clinic_id and role = 'doctor'
      )
      or doctor_name = (
        select d.name from public.doctors d
        join public.clinic_members cm on cm.user_id = auth.uid()
        where d.email = (select email from auth.users where id = auth.uid())
          and d.clinic_id = queue_entries.clinic_id
        limit 1
      )
    )
  );

create policy "Clinic staff can insert queue entries"
  on public.queue_entries for insert
  with check (public.user_in_clinic(clinic_id));

create policy "Clinic staff can update their clinic's queue"
  on public.queue_entries for update
  using (public.user_in_clinic(clinic_id));

-- === NOTIFICATIONS ===
create policy "Clinic members can read their clinic's notifications"
  on public.notifications for select
  using (public.user_in_clinic(clinic_id));

create policy "Clinic staff can insert notifications"
  on public.notifications for insert
  with check (public.user_in_clinic(clinic_id));

create policy "Clinic staff can update their clinic's notifications"
  on public.notifications for update
  using (public.user_in_clinic(clinic_id));

-- === NOTIFICATION RECIPIENTS ===
create policy "Users can read their own notification recipients"
  on public.notification_recipients for select
  using (
    user_id = auth.uid()
    and public.user_in_clinic(clinic_id)
  );

create policy "Clinic staff can insert notification recipients"
  on public.notification_recipients for insert
  with check (public.user_in_clinic(clinic_id));

create policy "Users can update own notification recipients"
  on public.notification_recipients for update
  using (user_id = auth.uid());

create policy "Clinic admins can update all recipients in their clinic"
  on public.notification_recipients for update
  using (public.user_is_clinic_admin(clinic_id));

-- === PROFILES ===
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Platform admins can read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Platform admins can manage all profiles"
  on public.profiles for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- 6. INDEXES for performance
-- ============================================================

create index if not exists idx_appointments_clinic   on public.appointments(clinic_id);
create index if not exists idx_patients_clinic       on public.patients(clinic_id);
create index if not exists idx_doctors_clinic        on public.doctors(clinic_id);
create index if not exists idx_staff_clinic          on public.staff(clinic_id);
create index if not exists idx_rooms_clinic          on public.rooms(clinic_id);
create index if not exists idx_queue_entries_clinic  on public.queue_entries(clinic_id);
create index if not exists idx_notifications_clinic  on public.notifications(clinic_id);
create index if not exists idx_clinic_members_user   on public.clinic_members(user_id);
create index if not exists idx_clinic_members_clinic on public.clinic_members(clinic_id);

-- ============================================================
-- 7. GRANTS — anon can still call book_appointment RPC
-- ============================================================
-- The book_appointment RPC needs to resolve clinic_id from a slug parameter.
-- Update the existing RPC to accept p_clinic_id and write it to the appointment.

-- If book_appointment exists, drop and recreate with clinic support
create or replace function public.book_appointment(
  p_name text,
  p_email text,
  p_phone text,
  p_scheduled_for timestamptz,
  p_doctor_id uuid default null,
  p_reason text default null,
  p_clinic_id uuid default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor_name text;
  v_clinic_id uuid;
  v_appointment public.appointments;
begin
  -- Resolve clinic_id: use the parameter, or fall back to the default clinic
  v_clinic_id := p_clinic_id;
  if v_clinic_id is null then
    select id into v_clinic_id from public.clinics where slug = 'default' limit 1;
  end if;

  -- Resolve doctor name if doctor_id is provided
  if p_doctor_id is not null then
    select name into v_doctor_name from public.doctors
    where id = p_doctor_id and clinic_id = v_clinic_id;
  end if;

  -- Insert the appointment (status locked to 'pending')
  insert into public.appointments (
    patient_name, patient_email, doctor_id, doctor_name,
    scheduled_for, status, reason, clinic_id
  ) values (
    p_name, lower(p_email), p_doctor_id, coalesce(v_doctor_name, 'Unassigned'),
    p_scheduled_for, 'pending', p_reason, v_clinic_id
  )
  returning * into v_appointment;

  -- Upsert the patient record
  insert into public.patients (name, phone, email, visits, clinic_id)
  values (p_name, p_phone, lower(p_email), 0, v_clinic_id)
  on conflict (email) do update
    set last_visit = now(),
        clinic_id = excluded.clinic_id;

  return v_appointment;
end;
$$;

-- Ensure anon can call it
grant execute on function public.book_appointment to anon;

commit;
