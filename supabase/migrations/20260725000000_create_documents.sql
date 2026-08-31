-- Migration: Create Documents Table and Storage Configurations
-- Description: Sets up the public.documents table, bucket creation, and role-based policies.

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    category TEXT NOT NULL, -- 'kyc', 'invoice', 'receipt', 'contract', 'agreement', 'other'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    rejection_reason TEXT,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    entity_type TEXT, -- 'client', 'employee', 'bill', 'transaction', 'general'
    entity_id UUID, -- Links to clients, employees, bills, etc.
    file_data TEXT -- Base64 fallback if Supabase Storage is offline or unconfigured
);

-- Add indexes for common filter operations
CREATE INDEX IF NOT EXISTS idx_documents_entity ON public.documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Attempt to create the documents storage bucket in Supabase (if storage schema exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('documents', 'documents', false)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Helper function to fetch the role of a user definition
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. SELECT POLICY: 
-- Allow internal roles (admin, accounts_manager, project_manager, staff, ticket_support) to view all documents.
-- Allow clients or owners to view their own uploaded files or files linked to their client ID.
CREATE POLICY "Users can read permitted documents" ON public.documents
    FOR SELECT
    USING (
        (public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support'))
        OR (uploaded_by = auth.uid())
        OR (
            entity_type = 'client' 
            AND entity_id IN (
                SELECT id FROM public.clients WHERE user_id = auth.uid()
            )
        )
    );

-- 2. INSERT POLICY:
-- Allow any authenticated user to insert/upload documents
CREATE POLICY "Authenticated users can upload documents" ON public.documents
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3. UPDATE POLICY:
-- Admins and Accounts Managers can update status and verification metadata.
-- Document owners can update metadata (name, category) if status is still 'pending'.
CREATE POLICY "Users can update their own pending documents or admins can update status" ON public.documents
    FOR UPDATE
    USING (
        (public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager'))
        OR (uploaded_by = auth.uid() AND status = 'pending')
    )
    WITH CHECK (
        (public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager'))
        OR (
            uploaded_by = auth.uid() 
            AND status = 'pending' 
            AND (status IS NOT DISTINCT FROM 'pending')
        )
    );

-- 4. DELETE POLICY:
-- Admins/Accounts Managers or owners (while pending) can delete documents
CREATE POLICY "Users can delete their own pending documents or admins can delete any" ON public.documents
    FOR DELETE
    USING (
        (public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager'))
        OR (uploaded_by = auth.uid() AND status = 'pending')
    );

-- Storage bucket policies in storage.objects (conditional on bucket table presence)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        -- Drop policies if they already exist
        DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
        DROP POLICY IF EXISTS "Permitted roles can read files" ON storage.objects;
        DROP POLICY IF EXISTS "Permitted roles can delete files" ON storage.objects;

        -- Create policies
        CREATE POLICY "Authenticated users can upload files" ON storage.objects
            FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

        CREATE POLICY "Permitted roles can read files" ON storage.objects
            FOR SELECT USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

        CREATE POLICY "Permitted roles can delete files" ON storage.objects
            FOR DELETE USING (bucket_id = 'documents' AND (
                auth.uid() = owner 
                OR public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager')
            ));
    END IF;
END $$;
