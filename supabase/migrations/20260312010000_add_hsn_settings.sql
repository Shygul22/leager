-- Add HSN/SAC auto-generation settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hsn_prefix text DEFAULT 'ZEN-',
ADD COLUMN IF NOT EXISTS hsn_next_sequence integer DEFAULT 1;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
