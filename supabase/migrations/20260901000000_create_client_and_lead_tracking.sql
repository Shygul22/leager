-- ============================================================================
-- ZENJOURNEY ERP - CLIENT TRACKING & LEAD TRACKING TABLES
-- ============================================================================

-- 1. CLIENT TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.client_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id_code TEXT UNIQUE NOT NULL DEFAULT ('CLI-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6))),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    project_code TEXT,
    service_type TEXT,
    project_start_date DATE DEFAULT CURRENT_DATE,
    project_end_date DATE,
    deadline DATE,
    project_status TEXT DEFAULT 'in_progress' CHECK (project_status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
    total_budget NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    amount_paid NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    balance NUMERIC(15, 2) GENERATED ALWAYS AS (total_budget - amount_paid) STORED,
    last_contact_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS & Policies for client_tracking
ALTER TABLE public.client_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own client tracking" ON public.client_tracking;
CREATE POLICY "Users can manage their own client tracking" 
    ON public.client_tracking FOR ALL 
    USING (auth.uid() = user_id OR user_id IS NULL);


-- 2. LEAD TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.lead_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id_code TEXT UNIQUE NOT NULL DEFAULT ('LEAD-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 6))),
    lead_name TEXT NOT NULL,
    phone TEXT,
    gmail TEXT,
    service_interested TEXT,
    notes TEXT,
    lead_status TEXT DEFAULT 'new' CHECK (lead_status IN ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost')),
    next_follow_up_date DATE,
    probability NUMERIC(5, 2) DEFAULT 0.00 CHECK (probability >= 0 AND probability <= 100),
    quotation_no TEXT,
    value NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    outstanding_value NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    first_contact_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS & Policies for lead_tracking
ALTER TABLE public.lead_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own lead tracking" ON public.lead_tracking;
CREATE POLICY "Users can manage their own lead tracking" 
    ON public.lead_tracking FOR ALL 
    USING (auth.uid() = user_id OR user_id IS NULL);


-- 3. AUTOMATIC UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_tracking_updated_at ON public.client_tracking;
CREATE TRIGGER trg_client_tracking_updated_at
    BEFORE UPDATE ON public.client_tracking
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_lead_tracking_updated_at ON public.lead_tracking;
CREATE TRIGGER trg_lead_tracking_updated_at
    BEFORE UPDATE ON public.lead_tracking
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_client_tracking_user_id ON public.client_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_client_tracking_status ON public.client_tracking(project_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_lead_tracking_user_id ON public.lead_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_tracking_status ON public.lead_tracking(lead_status);

-- 5. REFRESH SUPABASE SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
