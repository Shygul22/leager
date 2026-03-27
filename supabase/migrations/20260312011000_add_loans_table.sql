-- Create loans table for tracking borrowed money
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lender_name TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    interest_rate NUMERIC DEFAULT 0,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    notes TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own loans" ON public.loans;
CREATE POLICY "Users can manage their own loans" ON public.loans
    FOR ALL USING (user_id = auth.uid());

-- Force refresh schema cache
NOTIFY pgrst, 'reload schema';
