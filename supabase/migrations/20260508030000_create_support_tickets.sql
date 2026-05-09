-- Create Support Tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Ticket Messages table (for conversation)
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- 1. SUPPORT TICKETS RLS
DROP POLICY IF EXISTS "Staff can see all tickets" ON public.support_tickets;
CREATE POLICY "Staff can see all tickets" ON public.support_tickets 
FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support')
  OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can manage their own tickets" ON public.support_tickets;
CREATE POLICY "Users can manage their own tickets" ON public.support_tickets 
FOR ALL USING (auth.uid() = user_id);

-- 2. TICKET MESSAGES RLS
DROP POLICY IF EXISTS "Staff can see all messages" ON public.ticket_messages;
CREATE POLICY "Staff can see all messages" ON public.ticket_messages 
FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support')
  OR EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can add messages to their tickets" ON public.ticket_messages;
CREATE POLICY "Users can add messages to their tickets" ON public.ticket_messages 
FOR INSERT WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support')
  OR EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
);

-- Refresh schema
NOTIFY pgrst, 'reload schema';
