-- Add full_name column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
