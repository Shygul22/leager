-- Comprehensive Schema Synchronization
-- Ensures all expected columns exist in all core tables

-- 1. Suppliers Table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. Bills Table
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS bill_number text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS employee_id uuid; -- Will add reference later if needed
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS user_id uuid;

-- 3. Bill Items Table
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 1;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS rate numeric DEFAULT 0;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS gst numeric DEFAULT 0;

-- 4. Invoices Table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_address text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_gstin text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_msme_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_num text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_project_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS include_signature boolean DEFAULT true;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS include_background boolean DEFAULT true;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS user_id uuid;

-- 5. Invoice Items Table
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 1;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS rate numeric DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS gst numeric DEFAULT 0;

-- 6. Employees Table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary numeric;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id uuid;

-- 7. Transactions Table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS date date DEFAULT CURRENT_DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type text; -- 'income' or 'expense'
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS employee_id uuid;

-- 8. Clients Table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS msme_number text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_number text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid;

-- 9. Products Table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rate numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id uuid;

-- 10. Profiles Table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'INR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV-';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_next_sequence integer DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_log_invoices boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_items jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_logo_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_logo_opacity integer DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_person_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_designation text;

-- Final Refresh
NOTIFY pgrst, 'reload schema';
