-- Migration: Assign Super Admin Role to shyguldigital@gmail.com

-- 1. Ensure user_role enum contains 'super_admin'
DO $$ 
BEGIN 
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Update handle_auth_user_sync trigger to automatically assign super_admin to shyguldigital@gmail.com
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    CASE 
      WHEN LOWER(NEW.email) = 'shyguldigital@gmail.com' THEN 'super_admin'
      ELSE COALESCE((NEW.raw_user_meta_data->>'role')::text, 'staff')
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN LOWER(EXCLUDED.email) = 'shyguldigital@gmail.com' THEN 'super_admin'
      ELSE COALESCE(profiles.role, EXCLUDED.role)
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Explicitly update existing profile for shyguldigital@gmail.com to super_admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE LOWER(email) = 'shyguldigital@gmail.com';

-- 4. Backfill from auth.users if shyguldigital@gmail.com exists in auth.users
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE LOWER(email) = 'shyguldigital@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'super_admin', email = EXCLUDED.email;

-- 5. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
