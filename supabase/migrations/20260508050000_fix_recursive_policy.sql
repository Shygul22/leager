-- This migration fixes the 'infinite recursion' error in the profiles policy
-- by using a SECURITY DEFINER function to check roles.

-- 1. Create a helper function that bypasses RLS to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Update Profiles Policies
-- Remove the recursive policy
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create a new one using the helper function
CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (is_admin());

-- Ensure other policies are still there
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public can see profile info" ON public.profiles;
CREATE POLICY "Public can see profile info" ON public.profiles
FOR SELECT USING (true);

-- Refresh
NOTIFY pgrst, 'reload schema';
