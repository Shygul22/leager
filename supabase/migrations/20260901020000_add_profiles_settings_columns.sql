-- ============================================================================
-- FIX: ADD MISSING SETTINGS & PREFERENCES COLUMNS TO PUBLIC.PROFILES
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_log_invoices BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV-';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invoice_next_sequence INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hsn_prefix TEXT DEFAULT 'ZEN-';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hsn_next_sequence INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transaction_categories JSONB DEFAULT '["General", "Salary", "Food", "Transport", "Utilities", "Entertainment", "Health", "Shopping", "Other"]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_logo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS background_logo_opacity INTEGER DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_details TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pan TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cin TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
