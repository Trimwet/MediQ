-- Enable Supabase Realtime for all core tables.
-- Supabase Realtime only broadcasts changes for tables that have been added
-- to the "supabase_realtime" publication. Without this, the frontend
-- WebSocket channel gets zero events even though it subscribes successfully.

BEGIN;

-- Drop first to avoid "already member" error on re-runs
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS
  public.appointments,
  public.queue_entries,
  public.patients,
  public.doctors,
  public.staff,
  public.rooms,
  public.notifications;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.appointments,
  public.queue_entries,
  public.patients,
  public.doctors,
  public.staff,
  public.rooms,
  public.notifications;

COMMIT;