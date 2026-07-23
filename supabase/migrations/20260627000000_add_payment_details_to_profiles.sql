-- Add payment_details column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_details TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;


