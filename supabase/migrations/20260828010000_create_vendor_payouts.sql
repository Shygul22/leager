-- Migration: Create Vendor Payouts, Supplier Bank Info, and Audit Logs
-- Description: Adds bank info & status to suppliers, creates vendor_payouts table, and establishes payout audit logs.

-- 1. Enhance suppliers table
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS ifsc_code TEXT,
  ADD COLUMN IF NOT EXISTS swift_code TEXT,
  ADD COLUMN IF NOT EXISTS upi_id TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update status default for existing null values
UPDATE public.suppliers SET status = 'active' WHERE status IS NULL;

-- 2. Create vendor_payouts table
CREATE TABLE IF NOT EXISTS public.vendor_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    payout_number TEXT NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT NOT NULL,
    bill_ids JSONB DEFAULT '[]'::jsonb,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
    reference_number TEXT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    notes TEXT,
    proof_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_supplier ON public.vendor_payouts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_user ON public.vendor_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status ON public.vendor_payouts(status);

-- 3. Create vendor_payout_audit_logs table
CREATE TABLE IF NOT EXISTS public.vendor_payout_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID REFERENCES public.vendor_payouts(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payout_audit_payout ON public.vendor_payout_audit_logs(payout_id);

-- 4. Enable RLS
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payout_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for vendor_payouts
DROP POLICY IF EXISTS "Staff can view vendor payouts" ON public.vendor_payouts;
CREATE POLICY "Staff can view vendor payouts" ON public.vendor_payouts
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support')
    ) OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Staff can insert vendor payouts" ON public.vendor_payouts;
CREATE POLICY "Staff can insert vendor payouts" ON public.vendor_payouts
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'staff')
    ) OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Staff can update vendor payouts" ON public.vendor_payouts;
CREATE POLICY "Staff can update vendor payouts" ON public.vendor_payouts
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager')
    ) OR auth.uid() = user_id
);

-- 6. RLS Policies for vendor_payout_audit_logs
DROP POLICY IF EXISTS "Staff can view payout audit logs" ON public.vendor_payout_audit_logs;
CREATE POLICY "Staff can view payout audit logs" ON public.vendor_payout_audit_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'accounts_manager', 'project_manager', 'staff')
    )
);

DROP POLICY IF EXISTS "Staff can insert payout audit logs" ON public.vendor_payout_audit_logs;
CREATE POLICY "Staff can insert payout audit logs" ON public.vendor_payout_audit_logs
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
