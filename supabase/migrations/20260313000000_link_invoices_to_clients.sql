-- Migration to link invoices to clients
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Data migration: Link existing invoices to clients by name
DO $$
BEGIN
    UPDATE public.invoices i
    SET client_id = c.id
    FROM public.clients c
    WHERE i.client_name = c.name
    AND i.user_id = c.user_id
    AND i.client_id IS NULL;
END $$;
