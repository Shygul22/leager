-- IMPROVED PROFILE SYNC TRIGGER
-- This ensures that every time a user signs up OR updates their email, 
-- their profile is created/updated automatically with the correct role.

CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::text, 
      'staff'
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = COALESCE(profiles.role, EXCLUDED.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for both INSERT and UPDATE
DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();

DROP TRIGGER IF EXISTS on_auth_user_updated_sync ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();

-- BACKFILL: Ensure all existing users have profiles with emails
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'staff'
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email
WHERE profiles.email IS NULL;

-- Refresh
NOTIFY pgrst, 'reload schema';
