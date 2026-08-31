-- ============================================================================
-- ZENJOURNEY ERP - SEQUENTIAL ID GENERATOR (ZJ-LEAD-2026-0001 & ZJ-CLI-2026-0001)
-- ============================================================================

-- 1. Create sequences
CREATE SEQUENCE IF NOT EXISTS public.lead_tracking_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS public.client_tracking_seq START WITH 1;

-- 2. Function & Trigger for Lead Tracking
CREATE OR REPLACE FUNCTION public.generate_lead_id_code()
RETURNS TRIGGER AS $$
DECLARE
    seq_val INT;
    curr_year TEXT;
BEGIN
    IF NEW.lead_id_code IS NULL OR NEW.lead_id_code LIKE 'LEAD-%' OR NEW.lead_id_code = '' THEN
        seq_val := nextval('public.lead_tracking_seq');
        curr_year := TO_CHAR(COALESCE(NEW.created_at, NOW()), 'YYYY');
        NEW.lead_id_code := 'ZJ-LEAD-' || curr_year || '-' || LPAD(seq_val::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_lead_id_code ON public.lead_tracking;
CREATE TRIGGER trg_generate_lead_id_code
    BEFORE INSERT ON public.lead_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_lead_id_code();

-- 3. Function & Trigger for Client Tracking
CREATE OR REPLACE FUNCTION public.generate_client_id_code()
RETURNS TRIGGER AS $$
DECLARE
    seq_val INT;
    curr_year TEXT;
BEGIN
    IF NEW.client_id_code IS NULL OR NEW.client_id_code LIKE 'CLI-%' OR NEW.client_id_code = '' THEN
        seq_val := nextval('public.client_tracking_seq');
        curr_year := TO_CHAR(COALESCE(NEW.created_at, NOW()), 'YYYY');
        NEW.client_id_code := 'ZJ-CLI-' || curr_year || '-' || LPAD(seq_val::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_client_id_code ON public.client_tracking;
CREATE TRIGGER trg_generate_client_id_code
    BEFORE INSERT ON public.client_tracking
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_client_id_code();

-- 4. Re-format existing lead & client tracking records to sequential ZJ format
WITH ranked_leads AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rnum, TO_CHAR(created_at, 'YYYY') as yr
    FROM public.lead_tracking
)
UPDATE public.lead_tracking lt
SET lead_id_code = 'ZJ-LEAD-' || rl.yr || '-' || LPAD(rl.rnum::text, 4, '0')
FROM ranked_leads rl
WHERE lt.id = rl.id;

WITH ranked_clients AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rnum, TO_CHAR(created_at, 'YYYY') as yr
    FROM public.client_tracking
)
UPDATE public.client_tracking ct
SET client_id_code = 'ZJ-CLI-' || rl.yr || '-' || LPAD(rl.rnum::text, 4, '0')
FROM ranked_clients rl
WHERE ct.id = rl.id;

-- Sync sequence starting value to prevent collision
SELECT setval('public.lead_tracking_seq', COALESCE((SELECT COUNT(*) FROM public.lead_tracking), 0) + 1, false);
SELECT setval('public.client_tracking_seq', COALESCE((SELECT COUNT(*) FROM public.client_tracking), 0) + 1, false);

-- Reload Schema
NOTIFY pgrst, 'reload schema';
