-- Migration: Create Document Folders Table
-- Description: Sets up the public.document_folders table for custom user-created folders.

CREATE TABLE IF NOT EXISTS public.document_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'blue',
    allowed_roles TEXT[] NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: All authenticated users can read all folders.
CREATE POLICY "Authenticated users can view folders" ON public.document_folders
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. INSERT Policy: Permitted roles (admin, accounts_manager, project_manager, staff) can create folders.
CREATE POLICY "Permitted roles can create folders" ON public.document_folders
    FOR INSERT WITH CHECK (
        public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager', 'project_manager', 'staff')
    );

-- 3. UPDATE Policy: Admins, Accounts Managers, or folder creator can update.
CREATE POLICY "Admins or owners can update folders" ON public.document_folders
    FOR UPDATE USING (
        public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager')
        OR created_by = auth.uid()
    );

-- 4. DELETE Policy: Admins, Accounts Managers, or folder creator can delete.
CREATE POLICY "Admins or owners can delete folders" ON public.document_folders
    FOR DELETE USING (
        public.get_user_role(auth.uid()) IN ('admin', 'accounts_manager')
        OR created_by = auth.uid()
    );

-- Seed default folders if the table is empty
INSERT INTO public.document_folders (name, category, color, allowed_roles)
VALUES 
    ('KYC & Identity', 'kyc', 'blue', ARRAY['admin', 'accounts_manager']),
    ('Contracts', 'contract', 'amber', ARRAY['admin', 'accounts_manager', 'project_manager']),
    ('Agreements', 'agreement', 'teal', ARRAY['admin', 'accounts_manager', 'project_manager']),
    ('Invoices', 'invoice', 'purple', ARRAY['admin', 'accounts_manager', 'staff']),
    ('Receipts', 'receipt', 'indigo', ARRAY['admin', 'accounts_manager', 'staff']),
    ('Other Files', 'other', 'slate', ARRAY['admin', 'accounts_manager', 'staff', 'project_manager'])
ON CONFLICT (category) DO NOTHING;
