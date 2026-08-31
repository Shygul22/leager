-- Add last_login column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Update the user sync trigger function to copy last_sign_in_at to last_login
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, last_login)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::text, 
      'staff'
    ),
    NEW.last_sign_in_at
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = COALESCE(profiles.role, EXCLUDED.role),
    last_login = EXCLUDED.last_login;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing profiles with their last sign-in timestamp from auth.users
UPDATE public.profiles p
SET last_login = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id AND p.last_login IS NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
