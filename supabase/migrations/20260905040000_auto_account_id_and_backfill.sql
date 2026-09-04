-- Migration: Auto Account ID Triggers & Data Backfill for Company Multi-Tenancy
-- Description: Ensures account_id is populated for all existing and new records across all tenant tables.

-- 1. Backfill account_id in profiles for any users with company_name matching an active account
UPDATE public.profiles p
SET account_id = a.id
FROM public.accounts a
WHERE p.account_id IS NULL 
  AND p.company_name IS NOT NULL 
  AND LOWER(TRIM(p.company_name)) = LOWER(TRIM(a.company_name));

-- 2. Backfill account_id across all tenant data tables based on profiles.account_id
UPDATE public.transactions t
SET account_id = p.account_id
FROM public.profiles p
WHERE t.user_id = p.id AND t.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.invoices i
SET account_id = p.account_id
FROM public.profiles p
WHERE i.user_id = p.id AND i.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.bills b
SET account_id = p.account_id
FROM public.profiles p
WHERE b.user_id = p.id AND b.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.clients c
SET account_id = p.account_id
FROM public.profiles p
WHERE c.user_id = p.id AND c.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.suppliers s
SET account_id = p.account_id
FROM public.profiles p
WHERE s.user_id = p.id AND s.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.products pr
SET account_id = p.account_id
FROM public.profiles p
WHERE pr.user_id = p.id AND pr.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.quotations q
SET account_id = p.account_id
FROM public.profiles p
WHERE q.user_id = p.id AND q.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.employees e
SET account_id = p.account_id
FROM public.profiles p
WHERE e.user_id = p.id AND e.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.projects proj
SET account_id = p.account_id
FROM public.profiles p
WHERE proj.user_id = p.id AND proj.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.tickets tk
SET account_id = p.account_id
FROM public.profiles p
WHERE tk.user_id = p.id AND tk.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.bugs bg
SET account_id = p.account_id
FROM public.profiles p
WHERE bg.user_id = p.id AND bg.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.documents doc
SET account_id = p.account_id
FROM public.profiles p
WHERE doc.user_id = p.id AND doc.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.shareholders sh
SET account_id = p.account_id
FROM public.profiles p
WHERE sh.user_id = p.id AND sh.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.client_tracking ct
SET account_id = p.account_id
FROM public.profiles p
WHERE ct.user_id = p.id AND ct.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.lead_tracking lt
SET account_id = p.account_id
FROM public.profiles p
WHERE lt.user_id = p.id AND lt.account_id IS NULL AND p.account_id IS NOT NULL;

UPDATE public.vendor_payouts vp
SET account_id = p.account_id
FROM public.profiles p
WHERE vp.user_id = p.id AND vp.account_id IS NULL AND p.account_id IS NOT NULL;

-- 3. Create generic trigger function to auto-populate account_id from user's profile on insert
CREATE OR REPLACE FUNCTION public.auto_set_account_id()
RETURNS TRIGGER AS $$
DECLARE
    user_acc_id UUID;
BEGIN
    IF NEW.account_id IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT account_id INTO user_acc_id FROM public.profiles WHERE id = NEW.user_id;
        IF user_acc_id IS NOT NULL THEN
            NEW.account_id := user_acc_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to all tenant tables
DO $$
DECLARE
    t text;
    tenant_tables text[] := ARRAY[
        'transactions', 'invoices', 'bills', 'clients', 'suppliers', 
        'products', 'quotations', 'employees', 'projects', 'tickets', 
        'bugs', 'documents', 'shareholders', 'client_tracking', 'lead_tracking', 'vendor_payouts'
    ];
BEGIN
    FOREACH t IN ARRAY tenant_tables
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_set_account_id ON public.%I;', t);
        EXECUTE format('CREATE TRIGGER trg_auto_set_account_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_set_account_id();', t);
    END LOOP;
END $$;
