-- Migration: Add MRP and Discount to Quotation Items
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS mrp NUMERIC DEFAULT 0;
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
