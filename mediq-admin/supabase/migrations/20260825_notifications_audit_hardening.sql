/**
 * Notifications, audit logs, and security hardening. (v3 — fully deterministic)
 *
 * This script makes NO assumptions about the remote database's current
 * state. It drops and recreates every helper function and every RLS policy
 * it depends on, so it applies cleanly to any diverged database and is safe
 * to re-run.
 *
 * 1. HELPERS      — drop (cascade) + recreate the five RLS helper functions.
 * 2. AUDIT LOGS   — `audit_logs` table + generic trigger on sensitive tables.
 * 3. NOTIFICATIONS— DB triggers that create notifications from real events:
 *                   booking, approval, rejection, cancellation, queue
 *                   check-in, queue called.
 * 4. REALTIME     — publish tables to `supabase_realtime` so the frontend's
 *                   postgres_changes subscriptions actually receive events.
 * 5. RLS POLICIES — wipe ALL policies on the core tables and recreate the
 *                   complete canonical clinic-scoped set (including the
 *                   patient-cancel WITH CHECK fix, suspended-clinic read
 *                   fix, and sign-up self-record fix).
 * 6. RPC HARDENING— book_appointment validation/spam guards, atomic
 *                   call_next_in_queue, admin-gated link_clinic_member.
 * 7. INDEXES      — composite indexes for the dashboard's hot queries.
 *
 * Apply via Supabase Dashboard → SQL Editor → paste and run.
 */

begin;

-- ============================================================
-- 0. CATALOG HELPER — resolve a column's actual type
-- ============================================================
-- This database was built from a different migration version than the
-- repo's: some columns are enums (e.g. clinic_members.role is user_role),
-- others plain text. String LITERALS coerce to enums automatically, but
-- text expressions/parameters do not — they need an explicit cast to the
-- column's real type. This helper looks that type up from the catalog so
-- every insert below works regardless of which shape this database has.

create or replace function public.column_type_of(p_table text, p_column text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select format('%I.%I', n.nspname, t.typname)
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname = p_table
    and a.attname = p_column
$$;

-- ============================================================
-- 0a. doctors.user_id (needed before user_is_this_doctor below)
-- ============================================================

alter table public.doctors
  add column if not exists user_id uuid
  references public.profiles(id) on delete set null;

update public.doctors d
set user_id = u.id
from auth.users u
where lower(d.email) = lower(u.email)
  and d.user_id is null;

create index if not exists idx_doctors_user on public.doctors(user_id);

-- ============================================================
-- 0b. CLINIC_ID COLUMNS on every data table (idempotent)
-- ============================================================
-- The remote's earlier multi-tenancy migration only partially applied — at
-- least one table is missing its clinic_id. Add them all before any policy
-- references them (policy expressions are validated at creation time).

alter table public.appointments          add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.patients              add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.doctors               add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.staff                 add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.rooms                 add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.queue_entries         add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.notifications         add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;
alter table public.notification_recipients add column if not exists clinic_id uuid references public.clinics(id) on delete cascade;

-- The ON CONFLICT clauses below (and link_clinic_member's upsert) require
-- unique indexes. Create them if missing, deduplicating first in case the
-- constraints never existed on this database.
create unique index if not exists clinics_slug_uidx
  on public.clinics(slug);

delete from public.clinic_members a
using public.clinic_members b
where a.ctid > b.ctid
  and a.clinic_id = b.clinic_id
  and a.user_id = b.user_id;

create unique index if not exists clinic_members_clinic_user_uidx
  on public.clinic_members(clinic_id, user_id);

-- Backfill: any row that predates multi-tenancy (or whose column was just
-- added) belongs to the default clinic. Also ensure every staff profile is
-- linked as a clinic member. All idempotent.
do $$
declare
  default_clinic_id uuid;
begin
  insert into public.clinics (name, slug, plan, status)
  values ('Default Clinic', 'default', 'professional', 'active')
  on conflict (slug) do nothing
  returning id into default_clinic_id;

  if default_clinic_id is null then
    select id into default_clinic_id from public.clinics where slug = 'default';
  end if;

  update public.appointments          set clinic_id = default_clinic_id where clinic_id is null;
  update public.patients              set clinic_id = default_clinic_id where clinic_id is null;
  update public.doctors               set clinic_id = default_clinic_id where clinic_id is null;
  update public.staff                 set clinic_id = default_clinic_id where clinic_id is null;
  update public.rooms                 set clinic_id = default_clinic_id where clinic_id is null;
  update public.queue_entries         set clinic_id = default_clinic_id where clinic_id is null;
  update public.notifications         set clinic_id = default_clinic_id where clinic_id is null;
  update public.notification_recipients set clinic_id = default_clinic_id where clinic_id is null;

  -- role may be enum or text on this database; cast through its real type.
  -- For the filtered set the mapping is identity (admin→admin, doctor→doctor,
  -- front_desk→front_desk), so profiles.role carries the value directly.
  execute format(
    'insert into public.clinic_members (clinic_id, user_id, role)
     select $1, p.id, p.role::text::%s
     from public.profiles p
     where p.role::text in (''admin'', ''doctor'', ''front_desk'')
     on conflict (clinic_id, user_id) do nothing',
    public.column_type_of('clinic_members', 'role')
  ) using default_clinic_id;
end $$;

-- ============================================================
-- 0c. DROP old helper functions
-- ============================================================
-- The remote versions may have different parameter names (CREATE OR REPLACE
-- cannot rename parameters). CASCADE also removes any policies referencing
-- them — every policy is recreated in section 4 below.

drop function if exists public.current_user_clinic_id() cascade;
drop function if exists public.user_in_clinic(uuid) cascade;
drop function if exists public.user_is_clinic_admin(uuid) cascade;
drop function if exists public.user_is_this_doctor(uuid, uuid) cascade;
drop function if exists public.user_is_this_patient(text) cascade;

-- ============================================================
-- 0d. RECREATE helper functions (canonical versions)
-- ============================================================

create function public.current_user_clinic_id()
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

create function public.user_in_clinic(target_clinic_id uuid)
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

create function public.user_is_clinic_admin(target_clinic_id uuid)
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

create function public.user_is_this_doctor(
  target_clinic_id uuid,
  target_doctor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.doctors d
    where d.id = target_doctor_id
      and d.clinic_id = target_clinic_id
      and (
        d.user_id = auth.uid()
        or (
          d.user_id is null
          and d.email = (select email from auth.users where id = auth.uid())
        )
      )
  )
  or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function public.user_is_this_patient(patient_email text)
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
  or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- 1. AUDIT LOGS
-- ============================================================

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid references public.clinics(id) on delete cascade,
  actor_id    uuid,
  actor_email text,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity      text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.audit_logs is
  'Immutable audit trail written only by the audit_row_change trigger. Clinic admins can read their clinic''s entries; nobody writes directly.';

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon;

-- Only clinic admins (incl. platform admins) may read audit entries.
-- No INSERT/UPDATE/DELETE policies: writes happen exclusively inside the
-- SECURITY DEFINER trigger function.
drop policy if exists "Clinic admins can read their clinic's audit logs"
  on public.audit_logs;
create policy "Clinic admins can read their clinic's audit logs"
  on public.audit_logs for select
  using (public.user_is_clinic_admin(clinic_id));

grant select on public.audit_logs to authenticated;

create index if not exists idx_audit_logs_clinic_created
  on public.audit_logs(clinic_id, created_at desc);
create index if not exists idx_audit_logs_entity
  on public.audit_logs(entity, entity_id);

-- Generic audit trigger function. Attached to every sensitive table below.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row         jsonb;
  v_clinic_id   uuid;
  v_actor       uuid := auth.uid();
  v_actor_email text;
begin
  -- Maintenance escape hatch: select set_config('app.audit_disabled', 'on', true);
  if current_setting('app.audit_disabled', true) = 'on' then
    if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
  end if;

  if TG_OP = 'DELETE' then
    v_row := to_jsonb(OLD);
  else
    v_row := to_jsonb(NEW);
  end if;

  v_clinic_id := nullif(v_row ->> 'clinic_id', '')::uuid;
  v_actor_email := (
    select u.email from auth.users u where u.id = v_actor
  );

  insert into public.audit_logs (
    clinic_id, actor_id, actor_email, action, entity, entity_id, before, after
  ) values (
    v_clinic_id,
    v_actor,
    v_actor_email,
    TG_OP,
    TG_TABLE_NAME,
    nullif(v_row ->> 'id', '')::uuid,
    case when TG_OP <> 'INSERT' then to_jsonb(OLD) end,
    case when TG_OP <> 'DELETE' then to_jsonb(NEW) end
  );

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

-- Attach the audit trigger to every sensitive table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments', 'patients', 'doctors', 'staff',
    'rooms', 'queue_entries', 'clinic_members', 'profiles'
  ]
  loop
    execute format('drop trigger if exists audit_row_change on public.%I', t);
    execute format(
      'create trigger audit_row_change
         after insert or update or delete on public.%I
         for each row execute function public.audit_row_change()', t
    );
  end loop;
end $$;

-- ============================================================
-- 2. NOTIFICATION EVENT TRIGGERS
-- ============================================================
-- These fire no matter WHICH client performs the write (staff UI, patient
-- portal, or the anonymous book_appointment RPC), so the notification
-- pipeline can never be forgotten by a code path.

-- Helper: create one notification + recipient rows for every staff member of
-- a clinic (optionally excluding the acting user).
create or replace function public.notify_staff(
  p_clinic_id   uuid,
  p_type        text,
  p_title       text,
  p_message     text,
  p_exclude_user uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  -- `type` may be an enum on this database — cast through its real type.
  execute format(
    'insert into public.notifications (type, channel, title, message, clinic_id)
     values ($1::text::%s, ''in_app'', $2, $3, $4)
     returning id',
    public.column_type_of('notifications', 'type')
  ) using p_type, p_title, p_message, p_clinic_id
  into v_notification_id;

  insert into public.notification_recipients (notification_id, user_id, read, clinic_id)
  select v_notification_id, cm.user_id, false, p_clinic_id
  from public.clinic_members cm
  where cm.clinic_id = p_clinic_id
    and cm.user_id is distinct from p_exclude_user;

  return v_notification_id;
end;
$$;

-- Helper: create one notification + a recipient row for the patient's auth
-- account (matched by email). No-ops when the patient has no account yet.
create or replace function public.notify_patient_by_email(
  p_clinic_id uuid,
  p_email     text,
  p_type      text,
  p_title     text,
  p_message   text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_notification_id uuid;
begin
  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;

  if v_user_id is null then
    return null;  -- patient hasn't signed up yet; nothing to deliver in-app
  end if;

  -- `type` may be an enum on this database — cast through its real type.
  execute format(
    'insert into public.notifications (type, channel, title, message, clinic_id)
     values ($1::text::%s, ''in_app'', $2, $3, $4)
     returning id',
    public.column_type_of('notifications', 'type')
  ) using p_type, p_title, p_message, p_clinic_id
  into v_notification_id;

  insert into public.notification_recipients (notification_id, user_id, read, clinic_id)
  values (v_notification_id, v_user_id, false, p_clinic_id);

  return v_notification_id;
end;
$$;

-- --- Appointments: booking, approval, rejection, patient cancellation -----

create or replace function public.notify_appointment_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_when text := to_char(NEW.scheduled_for, 'Dy DD Mon, HH12:MI AM');
  v_rejection_reason text;
begin
  if current_setting('app.events_disabled', true) = 'on' then
    return coalesce(NEW, OLD);
  end if;

  -- New booking request → every staff member except the actor.
  if TG_OP = 'INSERT' then
    perform public.notify_staff(
      NEW.clinic_id,
      'appointment',
      'New appointment request',
      NEW.patient_name || ' requested ' || v_when,
      auth.uid()
    );
    return NEW;
  end if;

  -- Status transitions on UPDATE.
  if NEW.status is not distinct from OLD.status then
    return NEW;  -- status didn't change; nothing to announce
  end if;

  v_rejection_reason := coalesce(
    nullif(to_jsonb(NEW) ->> 'rejection_reason', ''),
    'No reason provided'
  );

  if NEW.status = 'booked' and OLD.status = 'pending' then
    -- Approved → tell the patient.
    perform public.notify_patient_by_email(
      NEW.clinic_id,
      NEW.patient_email,
      'appointment',
      'Appointment confirmed',
      'Your appointment on ' || v_when || ' has been confirmed.'
    );

  elsif NEW.status = 'rejected' then
    -- Rejected → tell the patient why.
    perform public.notify_patient_by_email(
      NEW.clinic_id,
      NEW.patient_email,
      'appointment',
      'Appointment declined',
      'Your appointment on ' || v_when || ' was declined. Reason: '
        || v_rejection_reason
    );

  elsif NEW.status = 'cancelled'
        and OLD.status in ('pending', 'booked')
        and auth.uid() is not null then
    -- Cancelled → tell the remaining staff.
    perform public.notify_staff(
      NEW.clinic_id,
      'appointment',
      'Appointment cancelled',
      NEW.patient_name || '''s appointment on ' || v_when || ' was cancelled.',
      auth.uid()
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists notify_appointment_events on public.appointments;
create trigger notify_appointment_events
  after insert or update of status on public.appointments
  for each row execute function public.notify_appointment_events();

-- --- Queue: check-in and called -------------------------------------------

create or replace function public.notify_queue_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_email text;
begin
  if current_setting('app.events_disabled', true) = 'on' then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'INSERT' then
    perform public.notify_staff(
      NEW.clinic_id,
      'queue',
      'Patient checked in',
      NEW.patient_name || ' joined the queue'
        || coalesce(' for ' || NEW.appointment_time, '') || '.',
      auth.uid()
    );
    return NEW;
  end if;

  -- A patient was called into a room → let them know (if they have an
  -- account and the entry is linked to an appointment).
  if NEW.status = 'called' and OLD.status is distinct from 'called'
     and NEW.appointment_id is not null then
    select a.patient_email into v_patient_email
    from public.appointments a
    where a.id = NEW.appointment_id;

    if v_patient_email is not null then
      perform public.notify_patient_by_email(
        NEW.clinic_id,
        v_patient_email,
        'queue',
        'It''s your turn',
        coalesce(NEW.doctor_name || ' is', 'The doctor is') || ' ready for you'
          || coalesce(' in ' || NEW.room, '') || '.'
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists notify_queue_events on public.queue_entries;
create trigger notify_queue_events
  after insert or update of status on public.queue_entries
  for each row execute function public.notify_queue_events();

-- ============================================================
-- 3. REALTIME — publish tables for postgres_changes
-- ============================================================
-- Without this, the frontend's postgres_changes subscriptions receive
-- NOTHING and the UI only updates on manual refetch.

do $$
declare
  t text;
begin
  foreach t in array array[
    'appointments', 'queue_entries', 'patients', 'doctors',
    'staff', 'rooms', 'notifications'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- already in the publication
      when undefined_object then null;  -- publication missing (managed setups)
    end;
  end loop;
end $$;

-- ============================================================
-- 4. RLS — enable, wipe, and recreate ALL policies
-- ============================================================
-- Deterministic: every policy on the core tables is dropped (whatever its
-- name or state) and the canonical clinic-scoped set is recreated.

alter table public.clinics               enable row level security;
alter table public.clinic_members        enable row level security;
alter table public.appointments          enable row level security;
alter table public.patients              enable row level security;
alter table public.doctors               enable row level security;
alter table public.staff                 enable row level security;
alter table public.rooms                 enable row level security;
alter table public.queue_entries         enable row level security;
alter table public.notifications         enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.profiles              enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'clinics', 'clinic_members', 'appointments', 'patients',
        'doctors', 'staff', 'rooms', 'queue_entries',
        'notifications', 'notification_recipients', 'profiles'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- === CLINICS ===
-- Public sees active clinics (for /c/:slug booking); members also see their
-- own clinic even when suspended (otherwise their whole app crashes).
create policy "Public can read active clinics"
  on public.clinics for select
  using (status = 'active' or public.user_in_clinic(id));

create policy "Clinic admins can update their clinic"
  on public.clinics for update
  using (
    id in (
      select clinic_id from public.clinic_members
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- === CLINIC_MEMBERS ===
create policy "Users can read own memberships"
  on public.clinic_members for select
  using (user_id = auth.uid());

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

-- Patients may ONLY cancel: USING constrains the old row, WITH CHECK
-- constrains the new row to status = 'cancelled', and the
-- protect_appointment_patient_updates trigger (section 5) locks every other
-- column. Previously a patient could rewrite any field and set any status.
create policy "Patients can cancel their own appointments"
  on public.appointments for update
  using (
    public.user_is_this_patient(patient_email)
    and status in ('pending', 'booked')
  )
  with check (
    public.user_is_this_patient(patient_email)
    and status = 'cancelled'
  );

-- === PATIENTS ===
create policy "Clinic members can read their clinic's patients"
  on public.patients for select
  using (public.user_in_clinic(clinic_id));

create policy "Clinic staff can insert patients"
  on public.patients for insert
  with check (public.user_in_clinic(clinic_id));

-- Sign-up inserts the patient's own directory record WITHOUT a clinic
-- (they have no membership yet). Previously this failed RLS silently and
-- the patient never appeared in the clinic's directory. The booking RPC
-- claims the record (sets clinic_id) on first appointment.
create policy "Users can create their own patient record"
  on public.patients for insert
  with check (
    auth.uid() is not null
    and lower(email) = lower(
      (select email from auth.users where id = auth.uid())
    )
    and clinic_id is null
  );

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
      or doctor_name in (
        select d.name from public.doctors d
        where d.clinic_id = queue_entries.clinic_id
          and (
            d.user_id = auth.uid()
            or (
              d.user_id is null
              and d.email = (select email from auth.users where id = auth.uid())
            )
          )
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

-- Platform-admin policies MUST NOT query public.profiles from inside a
-- policy ON profiles — Postgres detects that as infinite recursion (42P17)
-- and every profiles read fails. Route the check through the SECURITY
-- DEFINER is_admin() helper instead (defined defensively below so this
-- script stays self-contained on databases built from older migrations).
create or replace function public.is_admin()
returns boolean
stable
security definer
set search_path = public, pg_temp
language sql
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create policy "Platform admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Platform admins can manage all profiles"
  on public.profiles for all
  using (public.is_admin());

-- Audit the handle_new_user trigger. The staff invite passes `role` in
-- signup metadata; if the trigger copies raw_user_meta_data.role into
-- profiles.role, ANYONE can self-register as admin via a direct API call.
-- This block only WARNS — the trigger body lives outside this repo, so we
-- don't blind-overwrite it.
do $$
declare
  v_src text;
begin
  select p.prosrc into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc ilike '%handle_new_user%'
    and p.prosrc ilike '%raw_user_meta_data%'
  limit 1;

  if v_src is not null and v_src ~* 'raw_user_meta_data[^;]*role' then
    raise warning 'handle_new_user appears to derive role from client metadata. Anyone can self-register as admin via the signup API. Rewrite it to hardcode role = ''patient''. Staff roles must come only from clinic_members.';
  else
    raise notice 'handle_new_user check: no role-from-metadata pattern found.';
  end if;
end $$;

-- ============================================================
-- 5. APPOINTMENT PROTECTION + BOOKING RPC
-- ============================================================

-- Lock every non-status column when a non-staff user updates an appointment:
-- RLS can't do per-column checks, this trigger can.
create or replace function public.protect_appointment_patient_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Staff of this clinic, platform admins, and system (security definer)
  -- contexts may edit freely.
  if auth.uid() is null
     or exists (
       select 1 from public.clinic_members cm
       where cm.user_id = auth.uid() and cm.clinic_id = NEW.clinic_id
     )
     or exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
     ) then
    return NEW;
  end if;

  -- Patient path: keep every column at its OLD value except `status`.
  return jsonb_populate_record(
    NEW,
    to_jsonb(OLD) || jsonb_build_object('status', NEW.status)
  );
end;
$$;

drop trigger if exists protect_appointment_patient_updates on public.appointments;
create trigger protect_appointment_patient_updates
  before update on public.appointments
  for each row execute function public.protect_appointment_patient_updates();

-- Hardened booking RPC. Drop first: the remote version may have different
-- parameter names, which CREATE OR REPLACE cannot change.
drop function if exists public.book_appointment(text, text, text, timestamptz, uuid, text, uuid) cascade;
drop function if exists public.book_appointment(text, text, text, timestamptz, uuid, text) cascade;

create function public.book_appointment(
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
  v_doctor_id   uuid := p_doctor_id;
  v_doctor_name text := 'Unassigned';
  v_clinic_id   uuid;
  v_appointment public.appointments;
begin
  -- --- Validation -------------------------------------------------------
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Please provide your full name.';
  end if;

  if p_email is null or p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Please provide a valid email address.';
  end if;

  if p_phone is null or p_phone !~ '^\+?[0-9][0-9 ()-]{6,}$' then
    raise exception 'Please provide a valid phone number.';
  end if;

  if p_scheduled_for is null or p_scheduled_for < now() - interval '10 minutes' then
    raise exception 'Please choose a future date and time.';
  end if;

  -- --- Clinic resolution (must exist AND be active) ---------------------
  if p_clinic_id is null then
    select id into v_clinic_id
    from public.clinics
    where slug = 'default' and status = 'active'
    limit 1;
    if v_clinic_id is null then
      raise exception 'Online booking is temporarily unavailable.';
    end if;
  else
    select id into v_clinic_id
    from public.clinics
    where id = p_clinic_id and status = 'active';
    if v_clinic_id is null then
      raise exception 'This clinic is not accepting online bookings.';
    end if;
  end if;

  -- --- Spam guard --------------------------------------------------------
  if (
    select count(*) from public.appointments
    where patient_email = lower(p_email) and status = 'pending'
  ) >= 8 then
    raise exception 'Too many pending requests from this email. Please contact the clinic directly.';
  end if;

  -- --- Doctor resolution (never point at another clinic's doctor) -------
  if v_doctor_id is not null then
    select name into v_doctor_name
    from public.doctors
    where id = v_doctor_id and clinic_id = v_clinic_id;

    if not found then
      v_doctor_id := null;
      v_doctor_name := 'Unassigned';
    end if;
  end if;

  -- --- Insert the appointment (status locked to 'pending') --------------
  -- The notify_appointment_events trigger announces it to clinic staff.
  insert into public.appointments (
    patient_name, patient_email, doctor_id, doctor_name,
    scheduled_for, status, reason, clinic_id
  ) values (
    trim(p_name), lower(p_email), v_doctor_id, v_doctor_name,
    p_scheduled_for, 'pending', nullif(trim(p_reason), ''), v_clinic_id
  )
  returning * into v_appointment;

  -- --- Upsert the patient record (last_visit is NOT touched — it means
  --     the last actual visit, not the last booking) ---------------------
  update public.patients
  set name = trim(p_name),
      phone = p_phone,
      clinic_id = v_clinic_id
  where lower(email) = lower(p_email);

  if not found then
    begin
      insert into public.patients (name, phone, email, visits, clinic_id)
      values (trim(p_name), p_phone, lower(p_email), 0, v_clinic_id);
    exception when unique_violation then
      -- Raced with a concurrent booking for the same email.
      update public.patients
      set name = trim(p_name), phone = p_phone, clinic_id = v_clinic_id
      where lower(email) = lower(p_email);
    end;
  end if;

  return v_appointment;
end;
$$;

grant execute on function public.book_appointment to anon;

-- Public doctor list for the anonymous /book page. RLS blocks anon from
-- reading the doctors table directly, so this SECURITY DEFINER RPC exposes
-- only the three fields a patient needs to pick a doctor (id, name,
-- specialization), scoped to one active clinic. NULL clinic falls back to
-- the default clinic — same resolution rules as book_appointment above.
-- Drop both possible signatures first: the remote may hold an ad-hoc
-- version with different parameters.
drop function if exists public.list_public_doctors(uuid);
drop function if exists public.list_public_doctors();

create function public.list_public_doctors(p_clinic_id uuid default null)
returns table (id uuid, name text, specialization text)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id from public.clinics
    where status = 'active'
      and (
        id = p_clinic_id
        or (p_clinic_id is null and slug = 'default')
      )
    limit 1
  )
  select d.id, d.name, d.specialization
  from public.doctors d
  where d.status = 'active'
    and (
      d.clinic_id = (select id from target)
      -- Legacy rows created before clinic scoping: visible on the default
      -- clinic's booking page until the backfill assigns them.
      or (p_clinic_id is null and d.clinic_id is null)
    )
  order by d.name;
$$;

grant execute on function public.list_public_doctors to anon, authenticated;

-- ============================================================
-- 6. QUEUE + INVITE RPCs
-- ============================================================

-- Atomic call-next. The old find-then-update let two front desks call the
-- same patient simultaneously. FOR UPDATE SKIP LOCKED makes it safe.
create or replace function public.call_next_in_queue(
  p_clinic_id uuid default null,
  p_doctor_name text default null
)
returns public.queue_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry     public.queue_entries;
  v_clinic_id uuid := p_clinic_id;
begin
  if v_clinic_id is null then
    v_clinic_id := public.current_user_clinic_id();
  end if;

  if v_clinic_id is null or not public.user_in_clinic(v_clinic_id) then
    raise exception 'You are not a member of any clinic.';
  end if;

  update public.queue_entries q
  set status = 'called',
      called_at = now()
  where q.id = (
    select c.id from public.queue_entries c
    where c.clinic_id = v_clinic_id
      and c.status = 'waiting'
      and (p_doctor_name is null or c.doctor_name = p_doctor_name)
    order by c.checked_in_at asc
    for update skip locked
    limit 1
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

grant execute on function public.call_next_in_queue to authenticated;

-- Link an existing auth account to a clinic. The invite dialog could only
-- link brand-new accounts (it had no way to resolve an existing user's id
-- from the client) — inviting anyone who already had an account left them
-- without clinic membership, bricked at sign-in.
create or replace function public.link_clinic_member(
  p_clinic_id uuid,
  p_email text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.user_is_clinic_admin(p_clinic_id) then
    raise exception 'Only clinic admins can add members.';
  end if;

  if p_role not in ('admin', 'front_desk', 'doctor') then
    raise exception 'Invalid role.';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No account found for that email yet.';
  end if;

  -- role may be enum or text; cast the parameter through the real type.
  execute format(
    'insert into public.clinic_members (clinic_id, user_id, role)
     values ($1, $2, $3::text::%s)
     on conflict (clinic_id, user_id) do update set role = excluded.role',
    public.column_type_of('clinic_members', 'role')
  ) using p_clinic_id, v_user_id, p_role;

  return v_user_id;
end;
$$;

grant execute on function public.link_clinic_member to authenticated;

-- ============================================================
-- 7. COMPOSITE INDEXES for the dashboard's hot queries
-- ============================================================

create index if not exists idx_appointments_clinic_status
  on public.appointments(clinic_id, status);
create index if not exists idx_appointments_clinic_scheduled
  on public.appointments(clinic_id, scheduled_for desc);
create index if not exists idx_appointments_clinic_doctor
  on public.appointments(clinic_id, doctor_id);
create index if not exists idx_queue_clinic_status
  on public.queue_entries(clinic_id, status);
create index if not exists idx_notifications_clinic_created
  on public.notifications(clinic_id, created_at desc);
create index if not exists idx_recipients_user_unread
  on public.notification_recipients(user_id, read);
create index if not exists idx_appointments_patient_email
  on public.appointments(lower(patient_email));

commit;
