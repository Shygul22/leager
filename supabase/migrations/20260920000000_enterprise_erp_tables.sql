-- ==============================================================================
-- ENTERPRISE ERP TABLES MIGRATION
-- Multi-tenant schema with strict account_id isolation and RLS policies
-- ==============================================================================

-- 1. Sales Orders
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  client_name text NOT NULL,
  order_date date DEFAULT CURRENT_DATE NOT NULL,
  delivery_date date,
  status text DEFAULT 'confirmed' NOT NULL,
  subtotal numeric(15,2) DEFAULT 0 NOT NULL,
  tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
  total_amount numeric(15,2) DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Credit Notes
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  credit_note_number text NOT NULL,
  client_name text NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  amount numeric(15,2) DEFAULT 0 NOT NULL,
  tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
  total_amount numeric(15,2) DEFAULT 0 NOT NULL,
  reason text,
  status text DEFAULT 'applied' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  supplier_name text NOT NULL,
  order_date date DEFAULT CURRENT_DATE NOT NULL,
  expected_delivery_date date,
  status text DEFAULT 'issued' NOT NULL,
  subtotal numeric(15,2) DEFAULT 0 NOT NULL,
  tax_amount numeric(15,2) DEFAULT 0 NOT NULL,
  total_amount numeric(15,2) DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Purchase Requests
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_number text NOT NULL,
  department text NOT NULL,
  estimated_cost numeric(15,2) DEFAULT 0 NOT NULL,
  priority text DEFAULT 'medium' NOT NULL,
  reason text,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Goods Receipts (GRN)
CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  grn_number text NOT NULL,
  supplier_name text NOT NULL,
  received_date date DEFAULT CURRENT_DATE NOT NULL,
  status text DEFAULT 'accepted' NOT NULL,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. IT Assets & Inventory
CREATE TABLE IF NOT EXISTS public.it_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  asset_tag text NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'Laptop' NOT NULL,
  serial_number text,
  purchase_date date DEFAULT CURRENT_DATE,
  purchase_cost numeric(15,2) DEFAULT 0 NOT NULL,
  current_value numeric(15,2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'in_use' NOT NULL,
  location text DEFAULT 'Main Office',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Service Contracts (AMC / SLA)
CREATE TABLE IF NOT EXISTS public.service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_number text NOT NULL,
  client_name text NOT NULL,
  service_name text NOT NULL,
  contract_type text DEFAULT 'AMC' NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  billing_frequency text DEFAULT 'Monthly' NOT NULL,
  contract_value numeric(15,2) DEFAULT 0 NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  sla_hours integer DEFAULT 8 NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Timesheets
CREATE TABLE IF NOT EXISTS public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  hours numeric(6,2) DEFAULT 0 NOT NULL,
  hourly_rate numeric(10,2) DEFAULT 850 NOT NULL,
  task_description text,
  status text DEFAULT 'submitted' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Employee Attendance
CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE NOT NULL,
  check_in text,
  check_out text,
  status text DEFAULT 'present' NOT NULL,
  hours_worked numeric(5,2) DEFAULT 8.0 NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Employee Leaves
CREATE TABLE IF NOT EXISTS public.employee_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text DEFAULT 'paid' NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_count integer DEFAULT 1 NOT NULL,
  reason text,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Workflows & Automation
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  trigger_event text NOT NULL,
  conditions jsonb DEFAULT '[]'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Knowledge Base
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  is_published boolean DEFAULT true NOT NULL,
  tags text[],
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY & MULTI-TENANT ISOLATION POLICIES
-- ==============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sales_orders', 'credit_notes', 'purchase_orders', 'purchase_requests',
    'goods_receipts', 'it_assets', 'service_contracts', 'timesheets',
    'employee_attendance', 'employee_leaves', 'workflows', 'knowledge_base'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    
    -- Tenant isolation policy
    EXECUTE format('
      DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I;
      CREATE POLICY %I_tenant_isolation ON public.%I
        FOR ALL TO authenticated
        USING (
          account_id = current_account_id() OR is_super_admin()
        )
        WITH CHECK (
          account_id = current_account_id() OR is_super_admin()
        );
    ', t, t, t, t);

    -- Auto account_id trigger
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_auto_account_id ON public.%I;
      CREATE TRIGGER trg_%I_auto_account_id
        BEFORE INSERT ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.auto_set_account_id();
    ', t, t, t, t);
  END LOOP;
END;
$$;
