-- Migration: Create Quotations and Quotation Items tables
-- Also add Paytm configuration fields to the profiles table

-- 1. Create Quotations Table
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  client_gstin TEXT,
  client_msme_number TEXT,
  client_num TEXT,
  client_project_id TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, invoiced
  notes TEXT,
  currency TEXT DEFAULT 'INR',
  exchange_rate NUMERIC DEFAULT 1,
  include_signature BOOLEAN DEFAULT true,
  include_background BOOLEAN DEFAULT true,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create Quotation Items Table
CREATE TABLE IF NOT EXISTS public.quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL DEFAULT 0,
  gst NUMERIC NOT NULL DEFAULT 0
);

-- 3. Add Paytm Fields to Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paytm_merchant_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paytm_merchant_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paytm_website TEXT DEFAULT 'WEBSTAGING';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paytm_industry_type TEXT DEFAULT 'Retail';

-- 4. Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
CREATE POLICY "Users can only see their own quotations" ON public.quotations
FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only see items of their own quotations" ON public.quotation_items
FOR ALL USING (
  quotation_id IN (SELECT id FROM public.quotations WHERE user_id = auth.uid())
) WITH CHECK (
  quotation_id IN (SELECT id FROM public.quotations WHERE user_id = auth.uid())
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_user_id ON public.quotations(user_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items(quotation_id);

-- 7. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
