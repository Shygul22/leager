-- ============================================================
-- Client Portal: Allow anonymous (unauthenticated) READ access
-- Clients auth via sessionStorage (no Supabase session) so we
-- must allow anon reads for portal-related tables.
-- ============================================================

-- 1. INVOICES — clients need to see their own invoices
DROP POLICY IF EXISTS "Portal: public can read invoices" ON public.invoices;
CREATE POLICY "Portal: public can read invoices"
  ON public.invoices FOR SELECT
  TO anon
  USING (true);

-- 2. INVOICE ITEMS — needed to compute totals
DROP POLICY IF EXISTS "Portal: public can read invoice_items" ON public.invoice_items;
CREATE POLICY "Portal: public can read invoice_items"
  ON public.invoice_items FOR SELECT
  TO anon
  USING (true);

-- 3. PROJECTS — clients see their linked projects
DROP POLICY IF EXISTS "Portal: public can read projects" ON public.projects;
CREATE POLICY "Portal: public can read projects"
  ON public.projects FOR SELECT
  TO anon
  USING (true);

-- 4. PROJECT UPDATES — timeline entries per project
DROP POLICY IF EXISTS "Portal: public can read project_updates" ON public.project_updates;
CREATE POLICY "Portal: public can read project_updates"
  ON public.project_updates FOR SELECT
  TO anon
  USING (true);

-- 5. SUPPORT TICKETS — clients see their own tickets
DROP POLICY IF EXISTS "Portal: public can read support_tickets" ON public.support_tickets;
CREATE POLICY "Portal: public can read support_tickets"
  ON public.support_tickets FOR SELECT
  TO anon
  USING (true);

-- 6. TICKET MESSAGES — chat messages per ticket
DROP POLICY IF EXISTS "Portal: public can read ticket_messages" ON public.ticket_messages;
CREATE POLICY "Portal: public can read ticket_messages"
  ON public.ticket_messages FOR SELECT
  TO anon
  USING (true);

-- 7. BUG REPORTS — clients see their own bug reports
DROP POLICY IF EXISTS "Portal: public can read bug_reports" ON public.bug_reports;
CREATE POLICY "Portal: public can read bug_reports"
  ON public.bug_reports FOR SELECT
  TO anon
  USING (true);

-- 8. QUOTATIONS — for linking projects via quotations
DROP POLICY IF EXISTS "Portal: public can read quotations" ON public.quotations;
CREATE POLICY "Portal: public can read quotations"
  ON public.quotations FOR SELECT
  TO anon
  USING (true);

-- 9. Allow anon to INSERT tickets and bug_reports (client submits issues)
DROP POLICY IF EXISTS "Portal: public can create tickets" ON public.support_tickets;
CREATE POLICY "Portal: public can create tickets"
  ON public.support_tickets FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Portal: public can create bug_reports" ON public.bug_reports;
CREATE POLICY "Portal: public can create bug_reports"
  ON public.bug_reports FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Portal: public can create ticket_messages" ON public.ticket_messages;
CREATE POLICY "Portal: public can create ticket_messages"
  ON public.ticket_messages FOR INSERT
  TO anon
  WITH CHECK (true);

-- 10. Allow anon UPDATE on clients table (for profile self-service)
DROP POLICY IF EXISTS "Portal: public can update own client" ON public.clients;
CREATE POLICY "Portal: public can update own client"
  ON public.clients FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
