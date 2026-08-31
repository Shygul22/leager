-- Create document_audit_logs table
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'updated', 'verified', 'rejected'
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_values JSONB,
    new_values JSONB
);

-- Disable Row Level Security to avoid caching/filter blockages in development
ALTER TABLE public.document_audit_logs DISABLE ROW LEVEL SECURITY;

-- Database Trigger Function to log document actions automatically
CREATE OR REPLACE FUNCTION public.log_document_action()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    action_type TEXT;
    prev_val JSONB := NULL;
    new_val JSONB := NULL;
BEGIN
    -- Get current authenticated user if applicable
    current_user_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        new_val := jsonb_build_object(
            'name', NEW.name,
            'document_number', NEW.document_number,
            'description', NEW.description,
            'category', NEW.category
        );
        
        INSERT INTO public.document_audit_logs (document_id, action, changed_by, new_values)
        VALUES (NEW.id, action_type, COALESCE(current_user_id, NEW.uploaded_by), new_val);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check if verification status changed
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            IF NEW.status = 'verified' THEN
                action_type := 'verified';
            ELSIF NEW.status = 'rejected' THEN
                action_type := 'rejected';
            ELSE
                action_type := 'updated';
            END IF;
        ELSE
            action_type := 'updated';
        END IF;

        -- Capture previous and new values if they changed
        IF OLD.name IS DISTINCT FROM NEW.name OR
           OLD.document_number IS DISTINCT FROM NEW.document_number OR
           OLD.description IS DISTINCT FROM NEW.description OR
           OLD.category IS DISTINCT FROM NEW.category OR
           OLD.status IS DISTINCT FROM NEW.status THEN
           
            prev_val := jsonb_build_object(
                'name', OLD.name,
                'document_number', OLD.document_number,
                'description', OLD.description,
                'category', OLD.category,
                'status', OLD.status
            );
            
            new_val := jsonb_build_object(
                'name', NEW.name,
                'document_number', NEW.document_number,
                'description', NEW.description,
                'category', NEW.category,
                'status', NEW.status
            );
            
            INSERT INTO public.document_audit_logs (document_id, action, changed_by, previous_values, new_values)
            VALUES (
                NEW.id, 
                action_type, 
                COALESCE(
                    current_user_id, 
                    CASE 
                        WHEN action_type IN ('verified', 'rejected') THEN NEW.verified_by 
                        ELSE NEW.uploaded_by 
                    END
                ), 
                prev_val, 
                new_val
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS tr_document_audit ON public.documents;

-- Create the trigger on the documents table
CREATE TRIGGER tr_document_audit
AFTER INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.log_document_action();
