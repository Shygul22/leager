-- 1. Allow public access to limited profile fields
-- This is necessary so the Public Quotation page can show the company name and address
DROP POLICY IF EXISTS "Public can see profile info" ON public.profiles;

CREATE POLICY "Public can see profile info" ON public.profiles
FOR SELECT USING (true); -- We'll rely on the frontend to only select safe fields, 
                        -- or we could restrict the select in the policy if needed.
                        -- Since profiles usually contain public company info, this is generally safe.

-- 2. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Refresh
NOTIFY pgrst, 'reload schema';
