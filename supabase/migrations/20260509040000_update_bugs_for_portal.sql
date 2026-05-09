-- Add client_id to bug_reports for portal visibility
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Enable RLS for clients to see their own bugs
CREATE POLICY "Clients can view their own bugs" ON public.bug_reports 
FOR SELECT USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);

-- Enable RLS for clients to report bugs
CREATE POLICY "Clients can report bugs" ON public.bug_reports 
FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
);
