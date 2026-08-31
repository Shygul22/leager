-- ============================================================================
-- FIX: DOCUMENTS & PROFILES FOREIGN KEYS FOR SUPABASE POSTGREST SCHEMA CACHE
-- ============================================================================

-- 1. Ensure required columns exist on public.documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'application/octet-stream';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_data TEXT;

-- 2. Ensure required columns exist on public.document_audit_logs
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.document_audit_logs ADD COLUMN IF NOT EXISTS changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.document_audit_logs ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.document_audit_logs ADD COLUMN IF NOT EXISTS changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.document_audit_logs ADD COLUMN IF NOT EXISTS previous_values JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.document_audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.document_audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- 3. Drop existing constraint bottlenecks and re-add explicit Foreign Keys to public.profiles(id)
DO $$
BEGIN
    -- Fix uploaded_by FK
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_uploaded_by_fkey' AND table_name = 'documents'
    ) THEN
        ALTER TABLE public.documents DROP CONSTRAINT documents_uploaded_by_fkey;
    END IF;
    ALTER TABLE public.documents ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

    -- Fix verified_by FK
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'documents_verified_by_fkey' AND table_name = 'documents'
    ) THEN
        ALTER TABLE public.documents DROP CONSTRAINT documents_verified_by_fkey;
    END IF;
    ALTER TABLE public.documents ADD CONSTRAINT documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

    -- Fix document_audit_logs FKs
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'document_audit_logs_changed_by_fkey' AND table_name = 'document_audit_logs'
    ) THEN
        ALTER TABLE public.document_audit_logs DROP CONSTRAINT document_audit_logs_changed_by_fkey;
    END IF;
    ALTER TABLE public.document_audit_logs ADD CONSTRAINT document_audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
