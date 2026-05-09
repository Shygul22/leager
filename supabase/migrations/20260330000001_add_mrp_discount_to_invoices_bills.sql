-- Migration: Add MRP and Discount to Invoice Items and Bill Items
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS mrp NUMERIC DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;

ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS mrp NUMERIC DEFAULT 0;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
