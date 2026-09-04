-- Migration: Fix quotations status check constraint
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE public.quotations ADD CONSTRAINT quotations_status_check CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'invoiced', 'pending', 'expired', 'cancelled'));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
