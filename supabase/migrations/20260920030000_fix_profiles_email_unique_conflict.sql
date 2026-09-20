-- ============================================================================
-- FIX PROFILES EMAIL UNIQUE CONSTRAINT CONFLICT & USER SYNC TRIGGER
-- Prevents "duplicate key value violates unique constraint 'profiles_email_key'"
-- ============================================================================

-- 1. Create or replace handle_auth_user_sync with graceful conflict resolution
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
BEGIN
  -- Check if profile already exists with this ID
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    UPDATE public.profiles
    SET 
      email = NEW.email,
      role = COALESCE((NEW.raw_user_meta_data->>'role')::text, role, 'staff'),
      company_name = COALESCE((NEW.raw_user_meta_data->>'company_name')::text, company_name),
      account_id = COALESCE((NEW.raw_user_meta_data->>'account_id')::uuid, account_id),
      full_name = COALESCE((NEW.raw_user_meta_data->>'full_name')::text, full_name),
      updated_at = NOW()
    WHERE id = NEW.id;

  -- Check if profile already exists with this EMAIL (under a previous or seed ID)
  ELSIF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(NEW.email)) THEN
    BEGIN
      UPDATE public.profiles
      SET 
        id = NEW.id,
        role = COALESCE((NEW.raw_user_meta_data->>'role')::text, role, 'staff'),
        company_name = COALESCE((NEW.raw_user_meta_data->>'company_name')::text, company_name),
        account_id = COALESCE((NEW.raw_user_meta_data->>'account_id')::uuid, account_id),
        full_name = COALESCE((NEW.raw_user_meta_data->>'full_name')::text, full_name),
        updated_at = NOW()
      WHERE LOWER(email) = LOWER(NEW.email);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.profiles
      SET 
        role = COALESCE((NEW.raw_user_meta_data->>'role')::text, role, 'staff'),
        company_name = COALESCE((NEW.raw_user_meta_data->>'company_name')::text, company_name),
        account_id = COALESCE((NEW.raw_user_meta_data->>'account_id')::uuid, account_id),
        full_name = COALESCE((NEW.raw_user_meta_data->>'full_name')::text, full_name),
        updated_at = NOW()
      WHERE LOWER(email) = LOWER(NEW.email);
    END;

  -- Otherwise, insert clean new profile
  ELSE
    INSERT INTO public.profiles (id, email, role, company_name, account_id, full_name)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE((NEW.raw_user_meta_data->>'role')::text, 'staff'),
      COALESCE((NEW.raw_user_meta_data->>'company_name')::text, 'ZENJOURNEY PRIVATE LIMITED'),
      (NEW.raw_user_meta_data->>'account_id')::uuid,
      COALESCE((NEW.raw_user_meta_data->>'full_name')::text, split_part(NEW.email, '@', 1))
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail user creation transaction due to profile sync edge case
  RAISE WARNING 'handle_auth_user_sync error suppressed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-attach triggers to auth.users safely
DROP TRIGGER IF EXISTS on_auth_user_created_sync ON auth.users;
CREATE TRIGGER on_auth_user_created_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();

DROP TRIGGER IF EXISTS on_auth_user_updated_sync ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_sync();

-- 3. Synchronize any existing users in auth.users
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'staff'
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email
WHERE profiles.email IS NULL;

NOTIFY pgrst, 'reload schema';
