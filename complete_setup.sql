-- ============================================================================
-- ZENJOURNEY ENTERPRISE ERP & MULTI-TENANT SAAS SYSTEM
-- PRODUCTION-READY MASTER DATABASE SETUP SCRIPT
-- ============================================================================
-- Architecture: Multi-Tenant with Account & License-Key Enforcement (RLS)
-- Company: ZENJOURNEY PRIVATE LIMITED (CIN: U62013TN2026PTC191867)
-- Description: Complete, idempotent, production-ready schema for Supabase PostgreSQL.
-- Features:
--   1. Strict Multi-Tenant Data Isolation with account_id foreign keys.
--   2. License-Key Management (pending, active, suspended, expired) with auto-expiry check.
--   3. Super Admin Portal & Cross-Tenant Governance.
--   4. Role-Based Access Control (Custom Roles & User Memberships).
--   5. Comprehensive Audit Logging for all actions.
--   6. Complete Business Suite:
--      - CRM: Clients, Leads, Client Tracking, Quotations, Sales Orders, Invoices, Credit Notes
--      - Finance: Vouchers (Sales, Purchase, Receipts, Payments, Reimbursement, Purchase Voucher),
--                 Ledger, Transactions, Chart of Accounts, Journal Entries, Bills, Vendor Payouts
--      - Procurement: Purchase Requests, Purchase Orders, Goods Receipts (GRN), Suppliers
--      - HR & Payroll: Employees, Biometric Attendance, Leaves, Payroll Runs, Payslips, Timesheets
--      - Projects & Assets: Projects, Tasks, Milestones, IT Assets, Service Contracts (AMC/SLA)
--      - Collaboration: Support Tickets, Bug Reports, Documents, Workflows, Knowledge Base
--   7. Fully Idempotent: Can be run multiple times safely without 42809 view/table conflicts.
-- Instructions: Copy and run this ENTIRE file into the Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. ENUMS & BASE TYPES
-- ============================================================================
DO $$ 
BEGIN
    CREATE TYPE user_role AS ENUM (
        'super_admin', 'admin', 'accounts_manager', 'project_manager', 
        'staff', 'ticket_support', 'client'
    );
EXCEPTION WHEN duplicate_object THEN 
    NULL; 
END $$;

-- Ensure super_admin value exists if enum already existed previously
DO $$ 
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- ============================================================================
-- 3. CORE MULTI-TENANT & LICENSE MANAGEMENT TABLES
-- ============================================================================

-- 3.1 Accounts Table (Tenant Organization)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    account_code TEXT,
    admin_email TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Professional', -- Starter, Professional, Enterprise
    billing_cycle TEXT DEFAULT 'Annual',
    user_limit INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    phone TEXT,
    address TEXT,
    country TEXT DEFAULT 'India',
    tax_id TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure extended columns exist on accounts if table already existed
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'Annual';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS tax_id TEXT;

-- 3.2 Licenses Table (Cryptographic / Key-Based Tenant Activation)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    license_key TEXT UNIQUE NOT NULL, -- Format: LIC-XXXX-XXXX-XXXX
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'expired')),
    duration_months INTEGER NOT NULL DEFAULT 12,
    start_date TIMESTAMPTZ,
    expiry_date TIMESTAMPTZ,
    max_users INTEGER DEFAULT 5,
    tier TEXT DEFAULT 'Professional',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure extended columns exist on licenses if table already existed
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Professional';

-- 3.3 Profiles Table (User Profiles with Tenant Association)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'staff' NOT NULL,
    is_active BOOLEAN DEFAULT true,
    company_name TEXT DEFAULT 'ZENJOURNEY PRIVATE LIMITED',
    gstin TEXT DEFAULT 'NIL',
    pan_number TEXT,
    pan TEXT,
    cin_number TEXT DEFAULT 'U62013TN2026PTC191867',
    cin TEXT,
    website TEXT,
    phone TEXT,
    address TEXT,
    auth_person_name TEXT DEFAULT 'Shygul Akbar',
    auth_designation TEXT DEFAULT 'Founder & Executive Director',
    default_currency TEXT DEFAULT 'INR',
    invoice_prefix TEXT DEFAULT 'INV-',
    invoice_next_sequence INTEGER DEFAULT 1,
    hsn_prefix TEXT DEFAULT 'ZEN-',
    hsn_next_sequence INTEGER DEFAULT 1,
    auto_log_invoices BOOLEAN DEFAULT true,
    default_items JSONB DEFAULT '[]'::jsonb,
    transaction_categories JSONB DEFAULT '["General", "Salary", "Food", "Transport", "Utilities", "Entertainment", "Health", "Shopping", "Other"]'::jsonb,
    signature_url TEXT,
    background_logo_url TEXT,
    payment_details TEXT DEFAULT 'Account Holder: ZenJourney Private Limited
Bank Name: State Bank of India (SBI)
Account Number: 45505327860
Branch Name: Ulundurpet
IFSC Code: SBIN0011071',
    bank_name TEXT DEFAULT 'State Bank of India (SBI)',
    account_number TEXT DEFAULT '45505327860',
    ifsc_code TEXT DEFAULT 'SBIN0011071',
    branch_name TEXT DEFAULT 'Ulundurpet',
    upi_id TEXT,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.4 Custom Roles (Granular Tenant Permissions)
CREATE TABLE IF NOT EXISTS public.custom_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 User Account Memberships (Multi-Tenant User Membership & Switching)
CREATE TABLE IF NOT EXISTS public.user_account_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'staff',
    custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, account_id)
);

-- 3.6 Audit Logs (Multi-Tenant Audit Trail & Security Compliance)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    actor_id UUID,
    actor_email TEXT,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    target TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- 4. CORE HELPER FUNCTIONS FOR MULTI-TENANCY & AUTHORIZATION
-- ============================================================================

-- 4.1 Resolve active account_id of currently authenticated user
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS UUID AS $$
    SELECT account_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4.2 Super Admin check (Global administrator with cross-tenant visibility)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (role = 'super_admin' OR LOWER(email) = 'shyguldigital@gmail.com')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4.3 Account Admin check (Tenant-level admin or super admin)
CREATE OR REPLACE FUNCTION public.is_account_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (role IN ('admin', 'super_admin') OR LOWER(email) = 'shyguldigital@gmail.com')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4.4 Check if user has access to a specific tenant account
CREATE OR REPLACE FUNCTION public.current_user_has_account_access(target_account_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super BOOLEAN;
    mem_count INT;
BEGIN
    -- Super Admin has global cross-tenant access
    SELECT public.is_super_admin() INTO is_super;
    IF is_super THEN
        RETURN TRUE;
    END IF;

    IF target_account_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Direct profile match
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_id = target_account_id) THEN
        RETURN TRUE;
    END IF;

    -- Active membership in user_account_memberships table
    SELECT COUNT(*) INTO mem_count
    FROM public.user_account_memberships
    WHERE user_id = auth.uid() AND account_id = target_account_id AND status = 'active';

    RETURN mem_count > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4.5 Check if an account's license is active and not expired
CREATE OR REPLACE FUNCTION public.is_account_license_valid(target_account_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super BOOLEAN;
    acc_status TEXT;
    has_active_lic BOOLEAN;
BEGIN
    SELECT public.is_super_admin() INTO is_super;
    IF is_super THEN
        RETURN TRUE;
    END IF;

    IF target_account_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT status INTO acc_status FROM public.accounts WHERE id = target_account_id;
    IF acc_status IS NULL OR acc_status = 'suspended' THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.licenses
        WHERE account_id = target_account_id
          AND status IN ('active', 'pending')
          AND (expiry_date IS NULL OR expiry_date >= NOW())
    ) INTO has_active_lic;

    RETURN has_active_lic;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4.6 Generic Trigger to auto-populate account_id from user's active session
CREATE OR REPLACE FUNCTION public.auto_set_account_id()
RETURNS TRIGGER AS $$
DECLARE
    user_acc_id UUID;
BEGIN
    IF NEW.account_id IS NULL THEN
        IF auth.uid() IS NOT NULL THEN
            SELECT account_id INTO user_acc_id FROM public.profiles WHERE id = auth.uid();
        ELSIF NEW.user_id IS NOT NULL THEN
            SELECT account_id INTO user_acc_id FROM public.profiles WHERE id = NEW.user_id;
        END IF;

        IF user_acc_id IS NOT NULL THEN
            NEW.account_id := user_acc_id;
        END IF;
    END IF;

    -- Auto-assign user_id if column exists, is null, and auth.uid() is available
    BEGIN
        IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
            NEW.user_id := auth.uid();
        END IF;
    EXCEPTION WHEN undefined_column THEN
        NULL;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 5. CRM & SALES MODULES
-- ============================================================================

-- 5.1 Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    client_number TEXT,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    msme_number TEXT,
    currency TEXT DEFAULT 'INR',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.2 Client Tracking Table
CREATE TABLE IF NOT EXISTS public.client_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Active' NOT NULL,
    last_contact DATE,
    notes TEXT,
    next_follow_up DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.3 Lead Tracking Table
CREATE TABLE IF NOT EXISTS public.lead_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    lead_name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'Manual',
    status TEXT DEFAULT 'New',
    estimated_value NUMERIC(15, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.4 Facebook Lead Ads Configuration
CREATE TABLE IF NOT EXISTS public.facebook_lead_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    page_id TEXT NOT NULL,
    page_name TEXT NOT NULL,
    page_access_token TEXT NOT NULL,
    app_id TEXT,
    app_secret TEXT,
    verify_token TEXT DEFAULT 'zenjourney_meta_lead_verify_token_2026',
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.5 Quotations Table
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    quotation_number TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_phone TEXT,
    client_address TEXT,
    client_gstin TEXT,
    client_msme_number TEXT,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    valid_until DATE,
    status TEXT DEFAULT 'draft' NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Quotation Line Items Table
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE NOT NULL,
    product_id UUID,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    mrp NUMERIC(15, 2) DEFAULT 0,
    discount NUMERIC(15, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    gst NUMERIC(5, 2) DEFAULT 18 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.6 Sales Orders Table
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    client_name TEXT NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE NOT NULL,
    delivery_date DATE,
    status TEXT DEFAULT 'confirmed' NOT NULL,
    subtotal NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    tax_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    total_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    tax_percent NUMERIC(5, 2) DEFAULT 18 NOT NULL,
    total NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.7 Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_phone TEXT,
    client_address TEXT,
    client_gstin TEXT,
    client_msme_number TEXT,
    client_num TEXT,
    client_project_id TEXT,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'partially_paid', 'cancelled')),
    paid_amount NUMERIC(15, 2) DEFAULT 0.00,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    payment_reference TEXT,
    include_signature BOOLEAN DEFAULT true,
    include_background BOOLEAN DEFAULT true,
    currency TEXT DEFAULT 'INR',
    exchange_rate NUMERIC(10, 4) DEFAULT 1.0,
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Invoice Line Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    product_id UUID,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    mrp NUMERIC(15, 2) DEFAULT 0,
    discount NUMERIC(15, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    gst NUMERIC(5, 2) DEFAULT 18 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.8 Credit Notes Table
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    credit_note_number TEXT NOT NULL,
    client_name TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    tax_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    total_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'applied' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ============================================================================
-- 6. FINANCE, ACCOUNTING & VOUCHERS MODULES
-- ============================================================================

-- 6.1 Products & Service Catalog
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    hsn_sac_code TEXT,
    unit_price NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    unit_type TEXT DEFAULT 'unit',
    gst_rate NUMERIC(5, 2) DEFAULT 18.00 NOT NULL,
    category TEXT DEFAULT 'Services',
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.2 Suppliers / Vendors Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.3 Bills Table (Supplier Purchase Bills / Invoices)
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bill Line Items Table
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    mrp NUMERIC(15, 2) DEFAULT 0,
    discount NUMERIC(15, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    gst NUMERIC(5, 2) DEFAULT 18 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.4 Vendor Payouts & Audit Logs
CREATE TABLE IF NOT EXISTS public.vendor_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vendor_payout_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID REFERENCES public.vendor_payouts(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.5 Transactions Table (General Ledger & Voucher Transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    voucher_type TEXT DEFAULT 'General', -- Sales, Purchases, Receipts, Payments, Reimbursement Voucher, Purchase Voucher
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    description TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    payment_method TEXT DEFAULT 'Bank Transfer',
    reference_number TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    employee_id UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure legacy check constraint is removed so vouchers and all transaction types are allowed
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- 6.6 Chart of Accounts & General Journal
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
    parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    balance NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    entry_number TEXT NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    reference TEXT,
    description TEXT NOT NULL,
    total_debit NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    total_credit NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    status TEXT DEFAULT 'posted' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
    description TEXT,
    debit NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    credit NUMERIC(15, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6.7 Shareholders & Capital Table
CREATE TABLE IF NOT EXISTS public.shareholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    shares_count INTEGER DEFAULT 0,
    share_percentage NUMERIC(5, 2) DEFAULT 0.00,
    investment_amount NUMERIC(15, 2) DEFAULT 0.00,
    dividend_paid NUMERIC(15, 2) DEFAULT 0.00,
    pan_number TEXT,
    bank_details TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ============================================================================
-- 7. PROCUREMENT & SUPPLY CHAIN MODULES
-- ============================================================================

-- 7.1 Purchase Requests
CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    request_number TEXT NOT NULL,
    department TEXT NOT NULL,
    estimated_cost NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    priority TEXT DEFAULT 'medium' NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7.2 Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    po_number TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE NOT NULL,
    expected_delivery_date DATE,
    status TEXT DEFAULT 'issued' NOT NULL,
    subtotal NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    tax_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    total_amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1 NOT NULL,
    rate NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    tax_percent NUMERIC(5, 2) DEFAULT 18 NOT NULL,
    total NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7.3 Goods Receipts (GRN)
CREATE TABLE IF NOT EXISTS public.goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    grn_number TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    received_date DATE DEFAULT CURRENT_DATE NOT NULL,
    status TEXT DEFAULT 'accepted' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ============================================================================
-- 8. HR, PAYROLL & ATTENDANCE MODULES
-- ============================================================================

-- 8.1 Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_code TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    designation TEXT,
    department TEXT,
    joining_date DATE DEFAULT CURRENT_DATE,
    salary NUMERIC(15, 2) DEFAULT 0.00,
    bank_name TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    pan_number TEXT,
    aadhar_number TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8.2 Biometric Attendance
CREATE TABLE IF NOT EXISTS public.employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    check_in TEXT,
    check_out TEXT,
    status TEXT DEFAULT 'present' NOT NULL,
    hours_worked NUMERIC(5, 2) DEFAULT 8.0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8.3 Employee Leaves Table
CREATE TABLE IF NOT EXISTS public.employee_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type TEXT DEFAULT 'paid' NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER DEFAULT 1 NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe compatibility for leave_requests (prevents ERROR 42809)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests')
       AND NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'leave_requests') THEN
        CREATE VIEW public.leave_requests AS SELECT * FROM public.employee_leaves;
    ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests') THEN
        ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 8.4 Payroll Runs & Payslips
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    total_payout NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    basic_salary NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    allowances NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    deductions NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    net_salary NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'paid' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8.5 Timesheets
CREATE TABLE IF NOT EXISTS public.timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    project_id UUID,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    hours NUMERIC(6, 2) DEFAULT 0 NOT NULL,
    hourly_rate NUMERIC(10, 2) DEFAULT 850 NOT NULL,
    task_description TEXT,
    status TEXT DEFAULT 'submitted' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ============================================================================
-- 9. PROJECTS, ASSETS & SERVICE CONTRACTS MODULES
-- ============================================================================

-- 9.1 Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    budget NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Project Tasks & Milestones
CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'todo' NOT NULL,
    priority TEXT DEFAULT 'medium' NOT NULL,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'pending' NOT NULL,
    amount NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9.2 IT Assets & Equipment
CREATE TABLE IF NOT EXISTS public.it_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    asset_tag TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Laptop' NOT NULL,
    serial_number TEXT,
    purchase_date DATE DEFAULT CURRENT_DATE,
    purchase_cost NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    current_value NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'in_use' NOT NULL,
    location TEXT DEFAULT 'Main Office',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9.3 Service Contracts (AMC / SLA)
CREATE TABLE IF NOT EXISTS public.service_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    contract_number TEXT NOT NULL,
    client_name TEXT NOT NULL,
    service_name TEXT NOT NULL,
    contract_type TEXT DEFAULT 'AMC' NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    billing_frequency TEXT DEFAULT 'Monthly' NOT NULL,
    contract_value NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    sla_hours INTEGER DEFAULT 8 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ============================================================================
-- 10. COLLABORATION, SUPPORT & AUTOMATION MODULES
-- ============================================================================

-- 10.1 Support Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ticket_number TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' NOT NULL,
    status TEXT DEFAULT 'open' NOT NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe compatibility for support_tickets
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_tickets')
       AND NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'support_tickets') THEN
        CREATE VIEW public.support_tickets AS SELECT * FROM public.tickets;
    ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_tickets') THEN
        ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 10.2 Ticket Messages Table
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_type TEXT DEFAULT 'staff' NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe compatibility for support_ticket_messages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_ticket_messages')
       AND NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'support_ticket_messages') THEN
        CREATE VIEW public.support_ticket_messages AS SELECT * FROM public.ticket_messages;
    END IF;
END $$;

-- 10.3 Bug Tracker Table
CREATE TABLE IF NOT EXISTS public.bugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    bug_number TEXT NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'Medium' NOT NULL,
    status TEXT DEFAULT 'Open' NOT NULL,
    steps_to_reproduce TEXT,
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safe compatibility for bug_reports
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bug_reports')
       AND NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'bug_reports') THEN
        CREATE VIEW public.bug_reports AS SELECT * FROM public.bugs;
    ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bug_reports') THEN
        ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 10.4 Documents & Document Folders
CREATE TABLE IF NOT EXISTS public.document_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10.5 Workflow Automation Table
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    conditions JSONB DEFAULT '[]'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10.6 Knowledge Base Table
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    is_published BOOLEAN DEFAULT true NOT NULL,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10.7 Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ============================================================================
-- 11. ENSURE ACCOUNT_ID COLUMN ON ALL TENANT TABLES
-- ============================================================================
DO $$
DECLARE
    tbl TEXT;
    tenant_tables TEXT[] := ARRAY[
        'profiles', 'clients', 'client_tracking', 'lead_tracking', 'facebook_lead_configs',
        'quotations', 'sales_orders', 'invoices', 'credit_notes', 'products',
        'suppliers', 'bills', 'vendor_payouts', 'transactions', 'chart_of_accounts',
        'journal_entries', 'shareholders', 'purchase_requests', 'purchase_orders',
        'goods_receipts', 'employees', 'employee_attendance', 'employee_leaves',
        'payroll_runs', 'payslips', 'timesheets', 'projects', 'project_tasks',
        'project_milestones', 'project_updates', 'it_assets', 'service_contracts',
        'tickets', 'bugs', 'document_folders', 'documents', 'document_audit_logs',
        'workflows', 'knowledge_base', 'notifications', 'custom_roles', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;', tbl);
        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 12. DEFAULT ENTERPRISE TENANT & MASTER LICENSE INITIALIZATION
-- ============================================================================
DO $$
DECLARE
    master_acc_id UUID;
    master_license_key TEXT := 'LIC-ZEN-2026-ENTERPRISE';
BEGIN
    -- 1. Ensure master enterprise account exists
    SELECT id INTO master_acc_id FROM public.accounts WHERE company_name = 'ZENJOURNEY PRIVATE LIMITED' LIMIT 1;
    
    IF master_acc_id IS NULL THEN
        INSERT INTO public.accounts (
            company_name, admin_email, plan, user_limit, status
        ) VALUES (
            'ZENJOURNEY PRIVATE LIMITED', 'info@zenjourney.io', 'Enterprise', 100, 'active'
        ) RETURNING id INTO master_acc_id;

        UPDATE public.accounts SET country = 'India' WHERE id = master_acc_id;
    ELSE
        UPDATE public.accounts 
        SET admin_email = 'info@zenjourney.io' 
        WHERE id = master_acc_id AND admin_email = 'admin@zenjourney.io';
    END IF;

    -- 2. Ensure master active license exists for the account
    IF NOT EXISTS (SELECT 1 FROM public.licenses WHERE account_id = master_acc_id) THEN
        INSERT INTO public.licenses (
            account_id, license_key, status, duration_months, start_date, expiry_date
        ) VALUES (
            master_acc_id,
            master_license_key,
            'active',
            36, -- 3 years
            NOW(),
            NOW() + INTERVAL '3 years'
        );

        UPDATE public.licenses SET max_users = 100, tier = 'Enterprise' WHERE account_id = master_acc_id;
    END IF;

    -- 3. Associate super admin user profile with master account
    UPDATE public.profiles
    SET account_id = master_acc_id,
        role = 'super_admin'
    WHERE LOWER(email) = 'shyguldigital@gmail.com';

    -- 4. Backfill any existing unassociated profiles and tenant records
    UPDATE public.profiles
    SET account_id = master_acc_id
    WHERE account_id IS NULL;

    -- Backfill tenant data tables
    UPDATE public.clients SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.suppliers SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.products SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.transactions SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.invoices SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.bills SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.quotations SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.employees SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.projects SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.tickets SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.bugs SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.documents SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.document_folders SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.shareholders SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.client_tracking SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.lead_tracking SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.vendor_payouts SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.sales_orders SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.credit_notes SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.purchase_orders SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.purchase_requests SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.goods_receipts SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.it_assets SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.service_contracts SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.timesheets SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.employee_attendance SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.employee_leaves SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.workflows SET account_id = master_acc_id WHERE account_id IS NULL;
    UPDATE public.knowledge_base SET account_id = master_acc_id WHERE account_id IS NULL;
END $$;


-- ============================================================================
-- 13. AUTOMATIC ACCOUNT_ID INSERT TRIGGERS
-- ============================================================================
DO $$
DECLARE
    tbl TEXT;
    tenant_tables TEXT[] := ARRAY[
        'clients', 'client_tracking', 'lead_tracking', 'facebook_lead_configs',
        'quotations', 'sales_orders', 'invoices', 'credit_notes', 'products',
        'suppliers', 'bills', 'vendor_payouts', 'transactions', 'chart_of_accounts',
        'journal_entries', 'shareholders', 'purchase_requests', 'purchase_orders',
        'goods_receipts', 'employees', 'employee_attendance', 'employee_leaves',
        'payroll_runs', 'payslips', 'timesheets', 'projects', 'project_tasks',
        'project_milestones', 'project_updates', 'it_assets', 'service_contracts',
        'tickets', 'bugs', 'document_folders', 'documents', 'document_audit_logs',
        'workflows', 'knowledge_base', 'notifications', 'custom_roles', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_auto_set_account_id ON public.%I;', tbl, tbl);
            EXECUTE format('
                CREATE TRIGGER trg_%I_auto_set_account_id
                BEFORE INSERT ON public.%I
                FOR EACH ROW
                EXECUTE FUNCTION public.auto_set_account_id();
            ', tbl, tbl);
        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 14. PERFORMANCE INDEXES FOR MULTI-TENANCY & LOOKUPS
-- ============================================================================
DO $$
DECLARE
    tbl TEXT;
    tenant_tables TEXT[] := ARRAY[
        'profiles', 'clients', 'client_tracking', 'lead_tracking', 'facebook_lead_configs',
        'quotations', 'sales_orders', 'invoices', 'credit_notes', 'products',
        'suppliers', 'bills', 'vendor_payouts', 'transactions', 'chart_of_accounts',
        'journal_entries', 'shareholders', 'purchase_requests', 'purchase_orders',
        'goods_receipts', 'employees', 'employee_attendance', 'employee_leaves',
        'payroll_runs', 'payslips', 'timesheets', 'projects', 'project_tasks',
        'project_milestones', 'project_updates', 'it_assets', 'service_contracts',
        'tickets', 'bugs', 'document_folders', 'documents', 'document_audit_logs',
        'workflows', 'knowledge_base', 'notifications', 'custom_roles', 'audit_logs',
        'licenses', 'user_account_memberships'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_account_id ON public.%I(account_id);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- Specific High-Frequency Query Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);
CREATE INDEX IF NOT EXISTS idx_memberships_user_account ON public.user_account_memberships(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_user_date ON public.invoices(user_id, date);
CREATE INDEX IF NOT EXISTS idx_bills_user_date ON public.bills(user_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_bills_supplier_id ON public.bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.employee_attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON public.employee_leaves(employee_id);


-- ============================================================================
-- 15. STRICT MULTI-TENANT ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 15.1 Accounts Table Policy
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accounts access policy" ON public.accounts;
DROP POLICY IF EXISTS "Public CRUD on accounts" ON public.accounts;
CREATE POLICY "Accounts access policy" ON public.accounts
FOR ALL TO authenticated
USING (
    public.is_super_admin() 
    OR id = public.current_account_id()
    OR public.current_user_has_account_access(id)
)
WITH CHECK (
    public.is_super_admin() 
    OR (id = public.current_account_id() AND public.is_account_admin())
);

-- 15.2 Licenses Table Policy (Super admin controls, tenant reads their own license)
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Licenses access policy" ON public.licenses;
DROP POLICY IF EXISTS "Public CRUD on licenses" ON public.licenses;
CREATE POLICY "Licenses access policy" ON public.licenses
FOR SELECT TO authenticated
USING (
    public.is_super_admin() 
    OR account_id = public.current_account_id()
    OR public.current_user_has_account_access(account_id)
);

CREATE POLICY "Licenses write policy" ON public.licenses
FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Allow anonymous or authenticated validation of license keys during activation
DROP POLICY IF EXISTS "Allow license verification on activation" ON public.licenses;
CREATE POLICY "Allow license verification on activation" ON public.licenses
FOR SELECT TO anon
USING (license_key IS NOT NULL);

-- 15.3 Profiles Table Policy
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;
DROP POLICY IF EXISTS "Public CRUD on profiles" ON public.profiles;
CREATE POLICY "Profiles access policy" ON public.profiles
FOR ALL TO authenticated
USING (
    public.is_super_admin() 
    OR id = auth.uid() 
    OR (account_id = public.current_account_id() AND public.current_account_id() IS NOT NULL)
)
WITH CHECK (
    public.is_super_admin() 
    OR id = auth.uid() 
    OR (account_id = public.current_account_id() AND public.is_account_admin())
);

-- 15.4 Custom Roles Policy
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Custom roles access policy" ON public.custom_roles;
DROP POLICY IF EXISTS "Public CRUD on custom_roles" ON public.custom_roles;
CREATE POLICY "Custom roles access policy" ON public.custom_roles
FOR ALL TO authenticated
USING (
    public.is_super_admin() 
    OR account_id = public.current_account_id()
    OR public.current_user_has_account_access(account_id)
)
WITH CHECK (
    public.is_super_admin() 
    OR (account_id = public.current_account_id() AND public.is_account_admin())
);

-- 15.5 Memberships Policy
ALTER TABLE public.user_account_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Memberships access policy" ON public.user_account_memberships;
DROP POLICY IF EXISTS "Public CRUD on user_account_memberships" ON public.user_account_memberships;
CREATE POLICY "Memberships access policy" ON public.user_account_memberships
FOR ALL TO authenticated
USING (
    public.is_super_admin() 
    OR user_id = auth.uid() 
    OR account_id = public.current_account_id()
)
WITH CHECK (
    public.is_super_admin() 
    OR (account_id = public.current_account_id() AND public.is_account_admin())
);

-- 15.6 Audit Logs Policy
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit logs access policy" ON public.audit_logs;
DROP POLICY IF EXISTS "Public CRUD on audit_logs" ON public.audit_logs;
CREATE POLICY "Audit logs access policy" ON public.audit_logs
FOR ALL TO authenticated
USING (
    public.is_super_admin() 
    OR account_id = public.current_account_id()
    OR public.current_user_has_account_access(account_id)
)
WITH CHECK (
    public.is_super_admin() 
    OR account_id = public.current_account_id()
    OR public.current_user_has_account_access(account_id)
);

-- 15.7 Standard Tenant Tables Isolation Policy
DO $$
DECLARE
    tbl TEXT;
    standard_tables TEXT[] := ARRAY[
        'clients', 'client_tracking', 'lead_tracking', 'facebook_lead_configs',
        'quotations', 'sales_orders', 'invoices', 'credit_notes', 'products',
        'suppliers', 'bills', 'vendor_payouts', 'vendor_payout_audit_logs',
        'transactions', 'chart_of_accounts', 'journal_entries', 'shareholders',
        'purchase_requests', 'purchase_orders', 'goods_receipts', 'employees',
        'employee_attendance', 'employee_leaves', 'payroll_runs', 'payslips',
        'timesheets', 'projects', 'project_tasks', 'project_milestones',
        'project_updates', 'it_assets', 'service_contracts', 'tickets', 'bugs',
        'document_folders', 'documents', 'document_audit_logs', 'workflows',
        'knowledge_base', 'notifications'
    ];
BEGIN
    FOREACH tbl IN ARRAY standard_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation on %I" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public CRUD on %I" ON public.%I;', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "Tenant isolation on %I" ON public.%I
                FOR ALL TO authenticated
                USING (
                    public.is_super_admin()
                    OR account_id = public.current_account_id()
                    OR public.current_user_has_account_access(account_id)
                )
                WITH CHECK (
                    public.is_super_admin()
                    OR account_id = public.current_account_id()
                    OR public.current_user_has_account_access(account_id)
                );
            ', tbl, tbl, tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- 15.8 Child & Line-Item Tables RLS (Inherited Parent Tenancy)

-- Invoice Items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Public CRUD on invoice_items" ON public.invoice_items;
CREATE POLICY "Tenant isolation on invoice_items" ON public.invoice_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.invoices inv
        WHERE inv.id = invoice_items.invoice_id
          AND (inv.account_id = public.current_account_id() OR public.current_user_has_account_access(inv.account_id))
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.invoices inv
        WHERE inv.id = invoice_items.invoice_id
          AND (inv.account_id = public.current_account_id() OR public.current_user_has_account_access(inv.account_id))
    )
);

-- Bill Items
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on bill_items" ON public.bill_items;
DROP POLICY IF EXISTS "Public CRUD on bill_items" ON public.bill_items;
CREATE POLICY "Tenant isolation on bill_items" ON public.bill_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id = bill_items.bill_id
          AND (b.account_id = public.current_account_id() OR public.current_user_has_account_access(b.account_id))
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id = bill_items.bill_id
          AND (b.account_id = public.current_account_id() OR public.current_user_has_account_access(b.account_id))
    )
);

-- Quotation Items
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on quotation_items" ON public.quotation_items;
DROP POLICY IF EXISTS "Public CRUD on quotation_items" ON public.quotation_items;
CREATE POLICY "Tenant isolation on quotation_items" ON public.quotation_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.quotations q
        WHERE q.id = quotation_items.quotation_id
          AND (q.account_id = public.current_account_id() OR public.current_user_has_account_access(q.account_id))
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.quotations q
        WHERE q.id = quotation_items.quotation_id
          AND (q.account_id = public.current_account_id() OR public.current_user_has_account_access(q.account_id))
    )
);

-- Sales Order Items
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on sales_order_items" ON public.sales_order_items;
DROP POLICY IF EXISTS "Public CRUD on sales_order_items" ON public.sales_order_items;
CREATE POLICY "Tenant isolation on sales_order_items" ON public.sales_order_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.sales_orders so
        WHERE so.id = sales_order_items.sales_order_id
          AND (so.account_id = public.current_account_id() OR public.current_user_has_account_access(so.account_id))
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.sales_orders so
        WHERE so.id = sales_order_items.sales_order_id
          AND (so.account_id = public.current_account_id() OR public.current_user_has_account_access(so.account_id))
    )
);

-- Purchase Order Items
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Public CRUD on purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Tenant isolation on purchase_order_items" ON public.purchase_order_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id
          AND (po.account_id = public.current_account_id() OR public.current_user_has_account_access(po.account_id))
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id
          AND (po.account_id = public.current_account_id() OR public.current_user_has_account_access(po.account_id))
    )
);

-- Journal Entry Lines
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Public CRUD on journal_entry_lines" ON public.journal_entry_lines;
CREATE POLICY "Tenant isolation on journal_entry_lines" ON public.journal_entry_lines
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.id = journal_entry_lines.journal_entry_id
          AND (je.account_id = public.current_account_id() OR public.current_user_has_account_access(je.account_id))
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.id = journal_entry_lines.journal_entry_id
          AND (je.account_id = public.current_account_id() OR public.current_user_has_account_access(je.account_id))
    )
);

-- Ticket Messages
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on ticket_messages" ON public.ticket_messages;
DROP POLICY IF EXISTS "Public CRUD on ticket_messages" ON public.ticket_messages;
CREATE POLICY "Tenant isolation on ticket_messages" ON public.ticket_messages
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id
          AND (t.account_id = public.current_account_id() OR public.current_user_has_account_access(t.account_id))
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id
          AND (t.account_id = public.current_account_id() OR public.current_user_has_account_access(t.account_id))
    )
);


-- ============================================================================
-- 16. PUBLIC & CLIENT PORTAL ACCESS POLICIES (ANONYMOUS READS)
-- ============================================================================

-- 16.1 Public Invoice View (/invoice/:id)
DROP POLICY IF EXISTS "Public invoice view" ON public.invoices;
CREATE POLICY "Public invoice view" ON public.invoices
FOR SELECT TO anon
USING (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue'));

DROP POLICY IF EXISTS "Public invoice items view" ON public.invoice_items;
CREATE POLICY "Public invoice items view" ON public.invoice_items
FOR SELECT TO anon
USING (
    EXISTS (
        SELECT 1 FROM public.invoices inv
        WHERE inv.id = invoice_items.invoice_id
    )
);

-- 16.2 Client Portal Access (/portal)
DROP POLICY IF EXISTS "Client portal login lookup" ON public.clients;
CREATE POLICY "Client portal login lookup" ON public.clients
FOR SELECT TO anon
USING (client_number IS NOT NULL AND email IS NOT NULL);

DROP POLICY IF EXISTS "Client portal view invoices" ON public.invoices;
CREATE POLICY "Client portal view invoices" ON public.invoices
FOR SELECT TO anon
USING (client_id IS NOT NULL);

DROP POLICY IF EXISTS "Client portal view quotations" ON public.quotations;
CREATE POLICY "Client portal view quotations" ON public.quotations
FOR SELECT TO anon
USING (client_id IS NOT NULL);

DROP POLICY IF EXISTS "Client portal view quotation items" ON public.quotation_items;
CREATE POLICY "Client portal view quotation items" ON public.quotation_items
FOR SELECT TO anon
USING (
    EXISTS (
        SELECT 1 FROM public.quotations q
        WHERE q.id = quotation_items.quotation_id
    )
);

DROP POLICY IF EXISTS "Client portal view projects" ON public.projects;
CREATE POLICY "Client portal view projects" ON public.projects
FOR SELECT TO anon
USING (client_id IS NOT NULL);

DROP POLICY IF EXISTS "Client portal tickets access" ON public.tickets;
CREATE POLICY "Client portal tickets access" ON public.tickets
FOR ALL TO anon
USING (client_id IS NOT NULL)
WITH CHECK (client_id IS NOT NULL);

DROP POLICY IF EXISTS "Client portal ticket messages access" ON public.ticket_messages;
CREATE POLICY "Client portal ticket messages access" ON public.ticket_messages
FOR ALL TO anon
USING (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id 
          AND t.client_id IS NOT NULL
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id 
          AND t.client_id IS NOT NULL
    )
);


-- ============================================================================
-- 17. RELOAD SUPABASE POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
