-- Migration: Create Accounts and Licenses tables for Multi-Tenant License Management

-- 1. Add super_admin role to user_role enum if not present
DO $$ 
BEGIN 
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Create Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    admin_email TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Professional', -- Starter, Professional, Enterprise
    user_limit INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Licenses Table
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    license_key TEXT UNIQUE NOT NULL, -- Format: LIC-XXXX-XXXX-XXXX
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'expired')),
    duration_months INTEGER NOT NULL DEFAULT 12,
    start_date TIMESTAMP WITH TIME ZONE,
    expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Add account_id and is_active to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 5. Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Allow all operations for super_admin or authenticated users
CREATE POLICY "Allow public read of accounts for authenticated users" ON public.accounts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full control of accounts for authenticated users" ON public.accounts
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow public read of licenses for authenticated users" ON public.licenses
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow full control of licenses for authenticated users" ON public.licenses
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_account_id ON public.licenses(account_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON public.profiles(account_id);

-- 8. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
