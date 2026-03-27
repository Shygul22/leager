-- Migration to link transactions to clients
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Link existing income transactions to clients if possible (e.g. from invoices)
-- Note: invoices already auto-log to transactions with a description like "Invoice [num] - [client_name]"
DO $$
BEGIN
    UPDATE public.transactions t
    SET client_id = i.client_id
    FROM public.invoices i
    WHERE t.description LIKE 'Invoice ' || i.invoice_number || ' - %'
    AND t.user_id = i.user_id
    AND t.client_id IS NULL;
END $$;
