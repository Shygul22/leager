-- ============================================================================
-- FACEBOOK / META ADS AUTOMATED LEAD INGESTION CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.facebook_lead_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL,
    page_name TEXT,
    page_access_token TEXT NOT NULL,
    app_id TEXT,
    app_secret TEXT,
    verify_token TEXT DEFAULT 'zenjourney_meta_lead_verify_token_2026',
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.facebook_lead_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public CRUD on facebook_lead_configs" ON public.facebook_lead_configs;
CREATE POLICY "Public CRUD on facebook_lead_configs" 
    ON public.facebook_lead_configs FOR ALL 
    USING (true) WITH CHECK (true);

-- Index for fast webhook lookup by page_id
CREATE INDEX IF NOT EXISTS idx_facebook_lead_configs_page_id ON public.facebook_lead_configs(page_id);

-- Reload Schema
NOTIFY pgrst, 'reload schema';
