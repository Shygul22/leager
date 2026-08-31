-- Fix RLS Policies on public.transactions
-- Description: Ensures Admins, Accounts Managers, Staff, and authenticated users can view, insert, edit, and delete all transactions.

-- 1. Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop all previous restrictive policies
DROP POLICY IF EXISTS "Allow all access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff can see all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff can manage transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;

-- 3. Create permissive SELECT policy for authenticated users & staff
CREATE POLICY "Allow authenticated SELECT on transactions" ON public.transactions 
FOR SELECT USING (
    auth.role() = 'authenticated'
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support')
    )
    OR user_id IS NULL
    OR auth.uid() = user_id
);

-- 4. Create permissive INSERT policy for authenticated users & staff
CREATE POLICY "Allow authenticated INSERT on transactions" ON public.transactions 
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'staff')
    )
    OR user_id IS NULL
    OR auth.uid() = user_id
);

-- 5. Create permissive UPDATE policy for authenticated users & staff
CREATE POLICY "Allow authenticated UPDATE on transactions" ON public.transactions 
FOR UPDATE USING (
    auth.role() = 'authenticated'
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'staff')
    )
    OR user_id IS NULL
    OR auth.uid() = user_id
)
WITH CHECK (
    auth.role() = 'authenticated'
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'staff')
    )
    OR user_id IS NULL
    OR auth.uid() = user_id
);

-- 6. Create permissive DELETE policy for authenticated users & staff
CREATE POLICY "Allow authenticated DELETE on transactions" ON public.transactions 
FOR DELETE USING (
    auth.role() = 'authenticated'
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'staff')
    )
    OR user_id IS NULL
    OR auth.uid() = user_id
);

-- 7. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
