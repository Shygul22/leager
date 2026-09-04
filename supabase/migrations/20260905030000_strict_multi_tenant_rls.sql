-- Migration: Strict Multi-Tenant Authorization & Data Security Policies
-- Description: Enforces strict tenant boundaries, account memberships, and role-based permissions at PostgreSQL database level

-- 1. Helper function to check if current authenticated user belongs to an account
CREATE OR REPLACE FUNCTION public.current_user_has_account_access(target_account_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super_admin BOOLEAN;
    user_account_count INT;
BEGIN
    -- Check if user is super admin (email or role)
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR LOWER(email) = 'shyguldigital@gmail.com')
    ) INTO is_super_admin;

    IF is_super_admin THEN
        RETURN TRUE;
    END IF;

    -- Check direct profile account match
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_id = target_account_id) THEN
        RETURN TRUE;
    END IF;

    -- Check user_account_memberships table
    SELECT COUNT(*) INTO user_account_count 
    FROM public.user_account_memberships 
    WHERE user_id = auth.uid() AND account_id = target_account_id AND status = 'active';

    IF user_account_count > 0 THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply strict security triggers and policies on custom_roles
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Strict Account Isolation on custom_roles" ON public.custom_roles;
CREATE POLICY "Strict Account Isolation on custom_roles" ON public.custom_roles
    FOR ALL
    USING (
        account_id IS NULL OR public.current_user_has_account_access(account_id)
    )
    WITH CHECK (
        account_id IS NULL OR public.current_user_has_account_access(account_id)
    );

-- 3. Apply strict security policies on user_account_memberships
ALTER TABLE public.user_account_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Strict Account Isolation on user_account_memberships" ON public.user_account_memberships;
CREATE POLICY "Strict Account Isolation on user_account_memberships" ON public.user_account_memberships
    FOR ALL
    USING (
        user_id = auth.uid() OR public.current_user_has_account_access(account_id)
    )
    WITH CHECK (
        public.current_user_has_account_access(account_id)
    );

-- 4. Apply strict security policies on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Strict Account Isolation on audit_logs" ON public.audit_logs;
CREATE POLICY "Strict Account Isolation on audit_logs" ON public.audit_logs
    FOR ALL
    USING (
        account_id IS NULL OR public.current_user_has_account_access(account_id)
    )
    WITH CHECK (
        account_id IS NULL OR public.current_user_has_account_access(account_id)
    );
