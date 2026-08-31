-- ============================================================================
-- SAVE DEFAULT FACEBOOK PAGE / DATASET INTEGRATION CREDENTIALS
-- Page / Dataset ID: 1104650452121764
-- Access Token: EAAkFBp3ZAKPsBSXH4mm...
-- ============================================================================

INSERT INTO public.facebook_lead_configs (
    page_id,
    page_name,
    page_access_token,
    verify_token,
    is_active
) VALUES (
    '1104650452121764',
    'ZenJourney Official Meta Ads Page',
    'EAAkFBp3ZAKPsBSXH4mmBaKNUP4k2C5ZBDf0qjtThDo79gE9z3srkiZBVzQ1AezU8wvLfXVVME0pF7DZC3VMDvuYQeT2x0TFZATbYk5NZAfhTBFshqqOL4lSHE6R9Ls9einGHJk6ffT4DJ79WykT8JnZCbGLAChkcw4PdGedWD8418S2FNAxbMZAJQjUkC3GKywkNCwZDZD',
    'zenjourney_meta_lead_verify_token_2026',
    true
)
ON CONFLICT (id) DO NOTHING;

-- Reload Schema
NOTIFY pgrst, 'reload schema';
