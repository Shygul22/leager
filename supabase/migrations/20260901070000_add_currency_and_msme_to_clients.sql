-- ============================================================================
-- ZENJOURNEY ERP & ACCOUNTS MANAGER - SCHEMA SYNC MIGRATION
-- Fixes: missing columns in invoices, quotations, and clients tables
-- Solves: "Could not find the 'client_gstin' column of 'invoices' in the schema cache"
-- ============================================================================

-- 1. INVOICES TABLE
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_gstin text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_msme_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_num text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_project_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS include_signature boolean DEFAULT true;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS include_background boolean DEFAULT true;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;

-- 2. INVOICE ITEMS TABLE
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS product_id uuid;

-- 3. QUOTATIONS TABLE
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS client_gstin text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS client_msme_number text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS client_num text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS client_project_id text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS include_signature boolean DEFAULT true;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS include_background boolean DEFAULT true;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;

-- 4. QUOTATION ITEMS TABLE
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS product_id uuid;

-- 5. CLIENTS TABLE
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS msme_number text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_number text;

-- 6. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
