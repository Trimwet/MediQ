-- Sync staff roles to auth profiles.
-- When a staff member is created/updated in the staff table, 
-- update their corresponding profile role if they have already signed up.

CREATE OR REPLACE FUNCTION sync_staff_role_to_profile()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $body
BEGIN
  -- If we're deleting staff, downgrade them back to patient? 
  -- We'll handle that on delete if necessary, but for now just sync UPSERT.
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET role = NEW.role::text::user_role
    WHERE id = (SELECT id FROM auth.users WHERE email = NEW.email);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET role = 'patient'::user_role
    WHERE id = (SELECT id FROM auth.users WHERE email = OLD.email);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$body;

DROP TRIGGER IF EXISTS on_staff_change ON public.staff;
CREATE TRIGGER on_staff_change
AFTER INSERT OR UPDATE OR DELETE ON public.staff
FOR EACH ROW EXECUTE FUNCTION sync_staff_role_to_profile();

-- We also need to fix the case where the user signs up AFTER being added to staff.
-- Modify handle_new_user to look up the staff table by email.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $body
DECLARE
  v_role user_role;
BEGIN
  v_role := COALESCE(
    (SELECT role::text::user_role FROM public.staff WHERE email = NEW.email LIMIT 1),
    'patient'::user_role
  );

  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone'
  );

  -- Link doctor user_id
  IF v_role = 'doctor'::user_role THEN
    UPDATE public.doctors SET user_id = NEW.id WHERE email = NEW.email AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$body;