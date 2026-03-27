-- Fix NOT NULL constraint on legacy supplier_name column
ALTER TABLE public.bills ALTER COLUMN supplier_name DROP NOT NULL;

-- Force refreshing the schema cache
NOTIFY pgrst, 'reload schema';
