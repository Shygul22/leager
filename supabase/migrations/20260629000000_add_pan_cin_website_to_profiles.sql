-- Add pan, cin, and website columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pan TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cin TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
