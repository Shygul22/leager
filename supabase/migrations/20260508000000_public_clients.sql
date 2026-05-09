-- Allow public access to clients so they can log into the portal
-- This is necessary for the anonymous Client Portal login to work
DROP POLICY IF EXISTS "Public can see client info" ON public.clients;

CREATE POLICY "Public can see client info" ON public.clients
FOR SELECT USING (true);

-- Ensure RLS is enabled
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Refresh
NOTIFY pgrst, 'reload schema';
