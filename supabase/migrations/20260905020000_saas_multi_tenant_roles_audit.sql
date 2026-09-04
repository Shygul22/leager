-- Migration: Multi-Tenant Roles, Memberships, and Audit Logs
-- Description: Adds custom_roles, user_account_memberships, and audit_logs tables with RLS policies

-- 1. Create custom_roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on custom_roles
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on custom_roles" ON public.custom_roles FOR SELECT USING (true);
CREATE POLICY "Allow authenticated full access on custom_roles" ON public.custom_roles FOR ALL USING (true);

-- 2. Create user_account_memberships table (Allows a user to belong to multiple accounts)
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

-- Enable RLS on user_account_memberships
ALTER TABLE public.user_account_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on user_account_memberships" ON public.user_account_memberships FOR SELECT USING (true);
CREATE POLICY "Allow authenticated full access on user_account_memberships" ON public.user_account_memberships FOR ALL USING (true);

-- 3. Create audit_logs table
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

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow authenticated full access on audit_logs" ON public.audit_logs FOR ALL USING (true);

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.user_account_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_account ON public.user_account_memberships(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account ON public.audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
