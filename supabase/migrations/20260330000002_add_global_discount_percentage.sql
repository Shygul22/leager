-- Migration: Add discount_percentage to all document tables
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
