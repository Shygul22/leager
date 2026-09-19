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

-- ============================================================================
-- 1. EXTENSIONS & SCHEMA CACHE
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CORE HELPER FUNCTIONS FOR MULTI-TENANCY
-- ============================================================================

-- Resolve active account_id of the currently logged-in user
CREATE OR REPLACE FUNCTION public.current_account_id()
RETURNS UUID AS $$
    SELECT account_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is super_admin (global system admin with cross-tenant access)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is admin of their account
CREATE OR REPLACE FUNCTION public.is_account_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ============================================================================
-- 3. ENSURE ACCOUNT_ID COLUMN & INDEXES ON ALL TENANT TABLES
-- ============================================================================
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
        'leave_requests', 'payroll_runs', 'payslips', 'it_assets', 
        'service_contracts', 'knowledge_base', 'workflows', 'notifications'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables
    LOOP
        -- Add account_id column if table exists and column is missing
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;', tbl);
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_account_id ON public.%I(account_id);', tbl, tbl);
        END IF;
    END LOOP;
END $$;


-- ============================================================================
-- 4. DATA BACKFILL (PREVENTS OLD RECORDS WITH NULL ACCOUNT_ID FROM BEING HIDDEN)
-- ============================================================================
-- Ensure default account exists
DO $$
DECLARE
    default_acc_id UUID;
BEGIN
    SELECT id INTO default_acc_id FROM public.accounts LIMIT 1;
    
    IF default_acc_id IS NULL THEN
        INSERT INTO public.accounts (company_name, admin_email, plan, user_limit, status)
        VALUES ('ZENJOURNEY PRIVATE LIMITED', 'admin@zenjourney.io', 'Enterprise', 50, 'active')
        RETURNING id INTO default_acc_id;
    END IF;

    -- Attach account_id to profiles if missing
    UPDATE public.profiles p
    SET account_id = default_acc_id
    WHERE p.account_id IS NULL;

    -- Backfill all tenant tables from user's profile account_id or default_acc_id
    UPDATE public.clients c SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE c.user_id = p.id AND c.account_id IS NULL;
    UPDATE public.suppliers s SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE s.user_id = p.id AND s.account_id IS NULL;
    UPDATE public.products pr SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE pr.user_id = p.id AND pr.account_id IS NULL;
    UPDATE public.transactions t SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE t.user_id = p.id AND t.account_id IS NULL;
    UPDATE public.invoices i SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE i.user_id = p.id AND i.account_id IS NULL;
    UPDATE public.bills b SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE b.user_id = p.id AND b.account_id IS NULL;
    UPDATE public.vendor_payouts vp SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE vp.user_id = p.id AND vp.account_id IS NULL;
    UPDATE public.quotations q SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE q.user_id = p.id AND q.account_id IS NULL;
    UPDATE public.employees e SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE e.user_id = p.id AND e.account_id IS NULL;
    UPDATE public.projects proj SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE proj.user_id = p.id AND proj.account_id IS NULL;
    UPDATE public.tickets tk SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE tk.user_id = p.id AND tk.account_id IS NULL;
    UPDATE public.bugs bg SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE bg.user_id = p.id AND bg.account_id IS NULL;
    UPDATE public.document_folders df SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE df.user_id = p.id AND df.account_id IS NULL;
    UPDATE public.documents doc SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE doc.user_id = p.id AND doc.account_id IS NULL;
    UPDATE public.shareholders sh SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE sh.user_id = p.id AND sh.account_id IS NULL;
    UPDATE public.client_tracking ct SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE ct.user_id = p.id AND ct.account_id IS NULL;
    UPDATE public.lead_tracking lt SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE lt.user_id = p.id AND lt.account_id IS NULL;
    UPDATE public.facebook_lead_configs flc SET account_id = COALESCE(p.account_id, default_acc_id) FROM public.profiles p WHERE flc.user_id = p.id AND flc.account_id IS NULL;
END $$;


-- ============================================================================
-- 5. AUTOMATIC ACCOUNT_ID & USER_ID ENFORCEMENT ON INSERT (TRIGGERS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_tenant_account_id()
RETURNS TRIGGER AS $$
DECLARE
    user_acc_id UUID;
BEGIN
    SELECT account_id INTO user_acc_id FROM public.profiles WHERE id = auth.uid();
    
    -- If user belongs to an account, auto-assign their account_id
    IF user_acc_id IS NOT NULL THEN
        NEW.account_id := user_acc_id;
    END IF;
    
    -- Auto-assign user_id if table has user_id and it wasn't supplied
    IF TG_TABLE_NAME IN (
        'clients', 'suppliers', 'products', 'transactions', 'invoices', 
        'bills', 'vendor_payouts', 'quotations', 'employees', 'projects', 
        'tickets', 'bugs', 'document_folders', 'documents', 'shareholders', 
        'client_tracking', 'lead_tracking', 'facebook_lead_configs'
    ) THEN
        IF NEW.user_id IS NULL AND auth.uid() IS NOT NULL THEN
            NEW.user_id := auth.uid();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 6. MANAGEMENT MODULE POLICIES
-- ============================================================================

-- [Super Admin Portal: accounts & licenses]
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accounts access policy" ON public.accounts;
CREATE POLICY "Accounts access policy" ON public.accounts
FOR ALL TO authenticated
USING (
    public.is_super_admin() 
    OR id = public.current_account_id()
)
WITH CHECK (
    public.is_super_admin()
    OR (id = public.current_account_id() AND public.is_account_admin())
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Licenses access policy" ON public.licenses;
CREATE POLICY "Licenses access policy" ON public.licenses
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR account_id = public.current_account_id()
)
WITH CHECK (
    public.is_super_admin()
);

-- [User Roles: custom_roles & user_account_memberships]
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Custom roles access policy" ON public.custom_roles;
CREATE POLICY "Custom roles access policy" ON public.custom_roles
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR account_id = public.current_account_id()
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

-- [Access Directory & Settings: profiles]
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;
CREATE POLICY "Profiles access policy" ON public.profiles
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR id = auth.uid()
    OR account_id = public.current_account_id()
)
WITH CHECK (
    public.is_super_admin()
    OR id = auth.uid()
    OR (account_id = public.current_account_id() AND public.is_account_admin())
);

-- [Audit Trail: audit_logs]
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit logs access policy" ON public.audit_logs;
CREATE POLICY "Audit logs access policy" ON public.audit_logs
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR account_id = public.current_account_id()
)
WITH CHECK (
    public.is_super_admin()
    OR account_id = public.current_account_id()
);


-- ============================================================================
-- 7. OPERATIONS & FINANCIAL MODULES POLICIES (STANDARD TENANT TABLES)
-- ============================================================================
-- [Transactions, Tax Reports, Shareholders, Bills, Suppliers, Employees, 
--  Dashboard, Clients, Lead Tracking, Products, Quotations, Invoices, Projects, 
--  Documents, Tickets, Bug Tracker, Payroll, HR, Assets, Contracts, Workflows]

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
        'leave_requests', 'payroll_runs', 'payslips', 'it_assets', 
        'service_contracts', 'knowledge_base', 'workflows', 'notifications'
    ];
BEGIN
    FOREACH tbl IN ARRAY standard_tenant_tables
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

            -- Clean old policies
            EXECUTE format('DROP POLICY IF EXISTS "Public CRUD on %I" ON public.%I;', tbl, tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation on %I" ON public.%I;', tbl, tbl);

            -- Enforce Multi-Tenant Policy
            EXECUTE format('
                CREATE POLICY "Tenant isolation on %I" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin()
                    OR account_id = public.current_account_id()
                )
                WITH CHECK (
                    public.is_super_admin()
                    OR account_id = public.current_account_id()
                );
            ', tbl, tbl);

            -- Attach Auto Account_ID Trigger
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


-- ============================================================================
-- 8. LINE-ITEMS & CHILD TABLES RLS (INHERITED TENANCY)
-- ============================================================================

-- [Invoices Line Items]
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public CRUD on invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Tenant isolation on invoice_items" ON public.invoice_items;
CREATE POLICY "Tenant isolation on invoice_items" ON public.invoice_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.invoices inv
        WHERE inv.id = invoice_items.invoice_id
          AND inv.account_id = public.current_account_id()
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.invoices inv
        WHERE inv.id = invoice_items.invoice_id
          AND inv.account_id = public.current_account_id()
    )
);

-- [Bills Line Items]
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public CRUD on bill_items" ON public.bill_items;
DROP POLICY IF EXISTS "Tenant isolation on bill_items" ON public.bill_items;
CREATE POLICY "Tenant isolation on bill_items" ON public.bill_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id = bill_items.bill_id
          AND b.account_id = public.current_account_id()
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id = bill_items.bill_id
          AND b.account_id = public.current_account_id()
    )
);

-- [Quotations Line Items]
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public CRUD on quotation_items" ON public.quotation_items;
DROP POLICY IF EXISTS "Tenant isolation on quotation_items" ON public.quotation_items;
CREATE POLICY "Tenant isolation on quotation_items" ON public.quotation_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.quotations q
        WHERE q.id = quotation_items.quotation_id
          AND q.account_id = public.current_account_id()
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.quotations q
        WHERE q.id = quotation_items.quotation_id
          AND q.account_id = public.current_account_id()
    )
);

-- [Sales Orders Line Items]
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public CRUD on sales_order_items" ON public.sales_order_items;
DROP POLICY IF EXISTS "Tenant isolation on sales_order_items" ON public.sales_order_items;
CREATE POLICY "Tenant isolation on sales_order_items" ON public.sales_order_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.sales_orders so
        WHERE so.id = sales_order_items.sales_order_id
          AND so.account_id = public.current_account_id()
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.sales_orders so
        WHERE so.id = sales_order_items.sales_order_id
          AND so.account_id = public.current_account_id()
    )
);

-- [Purchase Orders Line Items]
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public CRUD on purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Tenant isolation on purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "Tenant isolation on purchase_order_items" ON public.purchase_order_items
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id
          AND po.account_id = public.current_account_id()
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.purchase_order_id
          AND po.account_id = public.current_account_id()
    )
);

-- [Journal Entries Lines]
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public CRUD on journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Tenant isolation on journal_entry_lines" ON public.journal_entry_lines;
CREATE POLICY "Tenant isolation on journal_entry_lines" ON public.journal_entry_lines
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.id = journal_entry_lines.journal_entry_id
          AND je.account_id = public.current_account_id()
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.id = journal_entry_lines.journal_entry_id
          AND je.account_id = public.current_account_id()
    )
);

-- [Support Ticket Messages]
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public CRUD on ticket_messages" ON public.ticket_messages;
DROP POLICY IF EXISTS "Tenant isolation on ticket_messages" ON public.ticket_messages;
CREATE POLICY "Tenant isolation on ticket_messages" ON public.ticket_messages
FOR ALL TO authenticated
USING (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id
          AND t.account_id = public.current_account_id()
    )
)
WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id
          AND t.account_id = public.current_account_id()
    )
);


-- ============================================================================
-- 9. SPECIAL ROLES: PUBLIC INVOICE & CLIENT PORTAL ACCESS (ANON & CLIENTS)
-- ============================================================================

-- [Public Invoice View by External Customers (/invoice/:id)]
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

-- [Client Portal: Client Login & Dashboard (/portal)]
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
-- 10. REFRESH SUPABASE SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
