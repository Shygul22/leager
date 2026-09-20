-- ============================================================================
-- ZENJOURNEY ENTERPRISE MULTI-TENANT COMPLETE RLS & ISOLATION SYSTEM
-- ============================================================================
-- Covers all Operations & Management modules:
-- [Super Admin Portal, Transactions, Tax Reports, Shareholders, Bills & Expenses,
--  Suppliers & Payouts, Employees & Payroll, User Roles, Access Directory,
--  Audit Trail, Settings, Dashboard, Clients, Lead Tracking, Service Catalog,
--  Quotations, Invoices, Projects, Documents Library, Support Tickets, Bug Tracker,
--  and Client Portal + Public Invoices]
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CORE HELPER FUNCTIONS FOR MULTI-TENANCY
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS UUID AS $$
    SELECT account_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (role = 'super_admin' OR LOWER(email) = 'shyguldigital@gmail.com')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_account_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND (role IN ('admin', 'super_admin') OR LOWER(email) = 'shyguldigital@gmail.com')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_has_account_access(target_account_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_super BOOLEAN;
    mem_count INT;
BEGIN
    SELECT public.is_super_admin() INTO is_super;
    IF is_super THEN
        RETURN TRUE;
    END IF;

    IF target_account_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_id = target_account_id) THEN
        RETURN TRUE;
    END IF;

    SELECT COUNT(*) INTO mem_count
    FROM public.user_account_memberships
    WHERE user_id = auth.uid() AND account_id = target_account_id AND status = 'active';

    RETURN mem_count > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. ENSURE ACCOUNT_ID COLUMN & INDEXES ON ALL TENANT TABLES
DO $$
DECLARE
    tbl TEXT;
    tenant_tables TEXT[] := ARRAY[
        'profiles', 'clients', 'suppliers', 'products', 'transactions', 'invoices', 
        'bills', 'vendor_payouts', 'vendor_payout_audit_logs', 'quotations', 
        'employees', 'projects', 'tickets', 'bugs', 'document_folders', 'documents', 
        'document_audit_logs', 'shareholders', 'client_tracking', 'lead_tracking', 
        'facebook_lead_configs', 'custom_roles', 'user_account_memberships', 
        'audit_logs', 'chart_of_accounts', 'journal_entries', 'sales_orders', 
        'credit_notes', 'purchase_requests', 'purchase_orders', 'goods_receipts', 
        'project_tasks', 'project_milestones', 'timesheets', 'employee_attendance', 
        'employee_leaves', 'payroll_runs', 'payslips', 'it_assets', 
        'service_contracts', 'knowledge_base', 'workflows', 'notifications'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;', tbl);
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_account_id ON public.%I(account_id);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- Ensure extended columns exist on accounts and licenses if tables already existed
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_code TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'Annual';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 5;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Professional';

-- Remove legacy check constraint on transactions to support all voucher and transaction types
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

-- Safe handling for leave_requests compatibility (prevents 42809 error)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests')
       AND NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'leave_requests') THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_leaves') THEN
            CREATE VIEW public.leave_requests AS SELECT * FROM public.employee_leaves;
        END IF;
    ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests') THEN
        ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. DATA BACKFILL
DO $$
DECLARE
    default_acc_id UUID;
BEGIN
    SELECT id INTO default_acc_id FROM public.accounts LIMIT 1;
    
    IF default_acc_id IS NULL THEN
        INSERT INTO public.accounts (company_name, admin_email, plan, user_limit, status)
        VALUES ('ZENJOURNEY PRIVATE LIMITED', 'info@zenjourney.io', 'Enterprise', 100, 'active')
        RETURNING id INTO default_acc_id;
    ELSE
        UPDATE public.accounts 
        SET admin_email = 'info@zenjourney.io' 
        WHERE id = default_acc_id AND admin_email = 'admin@zenjourney.io';
    END IF;

    UPDATE public.profiles SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.clients SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.suppliers SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.products SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.transactions SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.invoices SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.bills SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.vendor_payouts SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.quotations SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.employees SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.projects SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.tickets SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.bugs SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.document_folders SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.documents SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.shareholders SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.client_tracking SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.lead_tracking SET account_id = default_acc_id WHERE account_id IS NULL;
    UPDATE public.facebook_lead_configs SET account_id = default_acc_id WHERE account_id IS NULL;
END $$;

-- 5. AUTOMATIC ACCOUNT_ID & USER_ID ENFORCEMENT TRIGGER
CREATE OR REPLACE FUNCTION public.enforce_tenant_account_id()
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

-- 6. MANAGEMENT MODULE POLICIES
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accounts access policy" ON public.accounts;
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

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Licenses access policy" ON public.licenses;
CREATE POLICY "Licenses access policy" ON public.licenses
FOR SELECT TO authenticated
USING (
    public.is_super_admin()
    OR account_id = public.current_account_id()
    OR public.current_user_has_account_access(account_id)
);

DROP POLICY IF EXISTS "Licenses write policy" ON public.licenses;
CREATE POLICY "Licenses write policy" ON public.licenses
FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Allow license verification on activation" ON public.licenses;
CREATE POLICY "Allow license verification on activation" ON public.licenses
FOR SELECT TO anon
USING (license_key IS NOT NULL);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Custom roles access policy" ON public.custom_roles;
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

ALTER TABLE public.user_account_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Memberships access policy" ON public.user_account_memberships;
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;
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

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit logs access policy" ON public.audit_logs;
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

-- 7. STANDARD TENANT MODULE POLICIES
DO $$
DECLARE
    tbl TEXT;
    standard_tenant_tables TEXT[] := ARRAY[
        'clients', 'suppliers', 'products', 'transactions', 'invoices', 
        'bills', 'vendor_payouts', 'vendor_payout_audit_logs', 'quotations', 
        'employees', 'projects', 'tickets', 'bugs', 'document_folders', 'documents', 
        'document_audit_logs', 'shareholders', 'client_tracking', 'lead_tracking', 
        'facebook_lead_configs', 'chart_of_accounts', 'journal_entries', 'sales_orders', 
        'credit_notes', 'purchase_requests', 'purchase_orders', 'goods_receipts', 
        'project_tasks', 'project_milestones', 'timesheets', 'employee_attendance', 
        'employee_leaves', 'payroll_runs', 'payslips', 'it_assets', 
        'service_contracts', 'knowledge_base', 'workflows', 'notifications'
    ];
BEGIN
    FOREACH tbl IN ARRAY standard_tenant_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public CRUD on %I" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation on %I" ON public.%I;', tbl, tbl);

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

            EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_tenant_account_id ON public.%I;', tbl);
            EXECUTE format('
                CREATE TRIGGER trg_enforce_tenant_account_id
                BEFORE INSERT ON public.%I
                FOR EACH ROW
                EXECUTE FUNCTION public.enforce_tenant_account_id();
            ', tbl);
        END IF;
    END LOOP;
END $$;

-- 8. LINE-ITEMS & CHILD TABLES RLS
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on invoice_items" ON public.invoice_items;
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

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on bill_items" ON public.bill_items;
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

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on quotation_items" ON public.quotation_items;
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

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on ticket_messages" ON public.ticket_messages;
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

-- 9. SPECIAL ROLES: PUBLIC INVOICE & CLIENT PORTAL ACCESS
DROP POLICY IF EXISTS "Public invoice view" ON public.invoices;
CREATE POLICY "Public invoice view" ON public.invoices
FOR SELECT TO anon
USING (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue'));

DROP POLICY IF EXISTS "Public invoice items view" ON public.invoice_items;
CREATE POLICY "Public invoice items view" ON public.invoice_items
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.invoices inv WHERE inv.id = invoice_items.invoice_id));

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
USING (EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_items.quotation_id));

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
USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_messages.ticket_id AND t.client_id IS NOT NULL))
WITH CHECK (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_messages.ticket_id AND t.client_id IS NOT NULL));

-- 10. REFRESH SUPABASE SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
