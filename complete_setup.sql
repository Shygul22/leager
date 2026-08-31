-- ============================================================================
-- ZENJOURNEY ERP & ACCOUNTS MANAGER - MASTER CONSOLIDATED DATABASE SCRIPT
-- Company: ZENJOURNEY PRIVATE LIMITED (CIN: U62013TN2026PTC191867)
-- Description: Complete one-click database setup file for Supabase PostgreSQL.
-- Includes: All Tables, Enums, Foreign Keys, Triggers, Indexes, & Permissive RLS Policies.
-- Instructions: Copy and run this entire file in Supabase SQL Editor.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. PROFILES TABLE (User Accounts & Roles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    role user_role DEFAULT 'staff'::user_role NOT NULL,
    company_name TEXT DEFAULT 'ZENJOURNEY PRIVATE LIMITED',
    gstin TEXT DEFAULT 'NIL',
    pan_number TEXT,
    cin_number TEXT DEFAULT 'U62013TN2026PTC191867',
    website TEXT,
    phone TEXT,
    address TEXT,
    auth_person_name TEXT DEFAULT 'Shygul Akbar',
    auth_designation TEXT DEFAULT 'Founder & Executive Director',
    default_currency TEXT DEFAULT 'INR',
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    branch_name TEXT,
    upi_id TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_number TEXT,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'active',
    payment_terms TEXT DEFAULT 'Net 30',
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    swift_code TEXT,
    upi_id TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. PRODUCTS & SERVICE CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    hsn_sac_code TEXT,
    unit_price NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    unit_type TEXT DEFAULT 'unit',
    gst_rate NUMERIC(5, 2) DEFAULT 18.00 NOT NULL,
    category TEXT DEFAULT 'Services',
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TRANSACTIONS TABLE (Income & Expenses Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    description TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    payment_method TEXT DEFAULT 'Bank Transfer',
    reference_number TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    employee_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_address TEXT,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'partially_paid', 'cancelled')),
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INVOICE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    mrp NUMERIC(15, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    gst NUMERIC(5, 2) DEFAULT 18 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. BILLS TABLE (Supplier Purchase Invoices)
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bill_number TEXT NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'unpaid' NOT NULL CHECK (status IN ('unpaid', 'paid', 'partially_paid', 'cancelled')),
    paid_amount NUMERIC(15, 2) DEFAULT 0.00,
    category TEXT DEFAULT 'General Expense',
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- BILL ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    mrp NUMERIC(15, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    gst NUMERIC(5, 2) DEFAULT 18 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. VENDOR PAYOUTS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.vendor_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    payout_number TEXT NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    bill_ids JSONB DEFAULT '[]'::jsonb,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT DEFAULT 'Bank Transfer' NOT NULL,
    reference_number TEXT,
    payment_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status TEXT DEFAULT 'paid' NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
    notes TEXT,
    proof_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vendor_payout_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID REFERENCES public.vendor_payouts(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    quotation_number TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_phone TEXT,
    client_address TEXT,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    valid_until DATE,
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'converted')),
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    mrp NUMERIC(15, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    gst NUMERIC(5, 2) DEFAULT 18 NOT NULL
);

-- 12. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    designation TEXT NOT NULL,
    department TEXT DEFAULT 'Operations',
    salary NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    joining_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    pan_number TEXT,
    bank_account TEXT,
    ifsc_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled')),
    budget NUMERIC(15, 2) DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. SUPPORT TICKETS & MESSAGES
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. BUGS TRACKER TABLE
CREATE TABLE IF NOT EXISTS public.bugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bug_number TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. DOCUMENTS LIBRARY & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.document_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    mime_type TEXT,
    folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
    category TEXT DEFAULT 'General',
    status TEXT DEFAULT 'active',
    tags TEXT[] DEFAULT '{}',
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. SHAREHOLDERS TABLE (Equity & Dividend Management)
CREATE TABLE IF NOT EXISTS public.shareholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    designation TEXT DEFAULT 'Shareholder',
    category TEXT DEFAULT 'Promoter' CHECK (category IN ('Promoter', 'Angel Investor', 'Institutional', 'Key Executive', 'Retail')),
    pan_number TEXT,
    folio_number TEXT NOT NULL,
    shares_held INTEGER DEFAULT 0 NOT NULL,
    face_value NUMERIC(10, 2) DEFAULT 10.00 NOT NULL,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- 18. AUTOMATIC PROFILE CREATION TRIGGER ON USER SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'admin'::public.user_role,
    'ZENJOURNEY PRIVATE LIMITED'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 19. PERMISSIVE ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures database access works seamlessly without RLS blocking.
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payout_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;

-- 19. CLIENT TRACKING & LEAD TRACKING TABLES
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

ALTER TABLE public.client_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tracking ENABLE ROW LEVEL SECURITY;

-- Helper macro to grant open policy
DO $$ 
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public CRUD on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Public CRUD on %I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;

-- ============================================================================
-- 20. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON public.invoices(user_id, date);
CREATE INDEX IF NOT EXISTS idx_bills_user_date ON public.bills(user_id, date);
CREATE INDEX IF NOT EXISTS idx_clients_user ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON public.vendor_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_shareholders_user ON public.shareholders(user_id);
CREATE INDEX IF NOT EXISTS idx_client_tracking_user ON public.client_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_tracking_user ON public.lead_tracking(user_id);

-- 21. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

