-- 1. Add new columns to quotations for public access and payment tracking
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

-- 2. Drop existing policies to recreate them with public access support
DROP POLICY IF EXISTS "Users can only see their own quotations" ON public.quotations;
DROP POLICY IF EXISTS "Users can only see items of their own quotations" ON public.quotation_items;
DROP POLICY IF EXISTS "Public can see published quotations" ON public.quotations;
DROP POLICY IF EXISTS "Public can see items of published quotations" ON public.quotation_items;

-- 3. Recreate Authenticated Policies
CREATE POLICY "Users can only see their own quotations" ON public.quotations
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only see items of their own quotations" ON public.quotation_items
FOR ALL USING (
  quotation_id IN (SELECT id FROM public.quotations WHERE user_id = auth.uid())
) WITH CHECK (
  quotation_id IN (SELECT id FROM public.quotations WHERE user_id = auth.uid())
);

-- 4. Create Public (Anonymous) Policies
CREATE POLICY "Public can see published quotations" ON public.quotations
FOR SELECT USING (is_published = true);

CREATE POLICY "Public can see items of published quotations" ON public.quotation_items
FOR SELECT USING (
  quotation_id IN (SELECT id FROM public.quotations WHERE is_published = true)
);

-- 5. Finalize status and trigger reload
NOTIFY pgrst, 'reload schema';
