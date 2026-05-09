-- Add paid_amount to invoices and bills for partial payment tracking
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
