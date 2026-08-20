CREATE OR REPLACE FUNCTION sync_staff_role_to_profile()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $body
DECLARE
  v_user_id uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = NEW.email LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET role = NEW.role::text::user_role
      WHERE id = v_user_id;

      IF NEW.role = 'doctor' THEN
        UPDATE public.doctors SET user_id = v_user_id WHERE email = NEW.email AND user_id IS NULL;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = OLD.email LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET role = 'patient'::user_role
      WHERE id = v_user_id;
      
      -- Unlink doctor
      IF OLD.role = 'doctor' THEN
        UPDATE public.doctors SET user_id = NULL WHERE user_id = v_user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$body;

-- Also, fix the existing doctor row for jonahmafuyai81@gmail.com
UPDATE public.doctors 
SET user_id = (SELECT id FROM auth.users WHERE email = public.doctors.email LIMIT 1)
WHERE user_id IS NULL;