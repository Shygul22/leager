-- Add category column to bills table
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS category text;

-- Force refreshing the schema cache
NOTIFY pgrst, 'reload schema';
