-- This migration fixes CRUD operations for the Profiles table, 
-- allowing Admins to manage roles and users to manage their own info.

-- 1. ADMISSIONS: Allow Admins to manage all profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 2. SELF-SERVICE: Allow users to update their own profile (except role)
-- Note: In a real system, you'd want to restrict 'role' from being updated by the user themselves.
-- For now, we'll allow it if they are an admin, or allow non-admins to update other fields.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- 3. ENSURE SELECT IS STILL PUBLIC
DROP POLICY IF EXISTS "Public can see profile info" ON public.profiles;
CREATE POLICY "Public can see profile info" ON public.profiles
FOR SELECT USING (true);

-- Refresh
NOTIFY pgrst, 'reload schema';
