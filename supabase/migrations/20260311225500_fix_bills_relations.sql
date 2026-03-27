-- Fix bills table to support relationships with suppliers and employees
DO $$ 
BEGIN 
    -- Add supplier_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='supplier_id') THEN
        ALTER TABLE public.bills ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
    END IF;

    -- Add employee_id if it doesn't exist (double-check from previous migrations)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='employee_id') THEN
        ALTER TABLE public.bills ADD COLUMN employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable RLS for bill_items if not already done (fixing previous oversight)
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own bill items" ON public.bill_items;
CREATE POLICY "Users can manage their own bill items" ON public.bill_items FOR ALL USING (
    bill_id IN (SELECT id FROM bills WHERE user_id = auth.uid())
);
