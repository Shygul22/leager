-- Create Support Ticket Messages table
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_agent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Agents/Admins can see all messages
CREATE POLICY "Staff can view all ticket messages" ON public.support_ticket_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'staff', 'ticket_support', 'accounts_manager', 'project_manager')
    )
);

-- Clients can see messages for their tickets
CREATE POLICY "Clients can view their own ticket messages" ON public.support_ticket_messages
FOR SELECT USING (
    ticket_id IN (
        SELECT id FROM public.support_tickets 
        WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
);

-- Everyone can insert messages to their own tickets
CREATE POLICY "Users can add messages to their tickets" ON public.support_ticket_messages
FOR INSERT WITH CHECK (
    ticket_id IN (
        SELECT id FROM public.support_tickets 
        WHERE user_id = auth.uid() OR client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    ) OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'staff', 'ticket_support', 'accounts_manager', 'project_manager')
    )
);

-- Refresh schema
NOTIFY pgrst, 'reload schema';
