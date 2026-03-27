-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    designation TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Drop policy if it already exists
DROP POLICY IF EXISTS "Users can manage their own employees" ON public.employees;

-- Create policy
CREATE POLICY "Users can manage their own employees"
    ON public.employees FOR ALL
    USING (auth.uid() = user_id);

-- Add employee_id to bills table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='employee_id') THEN
        ALTER TABLE public.bills ADD COLUMN employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
END $$;
-- Add employee_id to transactions table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='employee_id') THEN
        ALTER TABLE public.transactions ADD COLUMN employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
END $$;
