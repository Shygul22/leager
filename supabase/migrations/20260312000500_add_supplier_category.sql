-- Comprehensive fix for suppliers table columns
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category text;

-- Force refreshing the schema cache
NOTIFY pgrst, 'reload schema';
