-- Migration: Fix Invoices Client ID Link
-- Add client_id column to linked invoices to the clients table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Refresh schema cache to fix PostgREST column missing error
NOTIFY pgrst, 'reload schema';
