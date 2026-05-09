-- This migration robustifies role-based access control and ensures Admins/Managers 
-- can manage all shared company data (Clients, Suppliers, Bills, etc.)

-- 1. Robustify is_company_staff()
CREATE OR REPLACE FUNCTION is_company_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Robustify is_manager() for management tasks
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'accounts_manager', 'project_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. CLIENTS
-- Note: Portal needs public SELECT access to verify email/ID
DROP POLICY IF EXISTS "Staff can see all clients" ON public.clients;
DROP POLICY IF EXISTS "Public can see client info" ON public.clients;
CREATE POLICY "Anyone can see client info" ON public.clients 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can manage their own clients" ON public.clients;
CREATE POLICY "Staff can manage their own clients" ON public.clients 
FOR ALL USING (auth.uid() = user_id OR is_manager());

-- 4. PRODUCTS
DROP POLICY IF EXISTS "Staff can see all products" ON public.products;
CREATE POLICY "Staff can see all products" ON public.products 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can manage their own products" ON public.products;
CREATE POLICY "Staff can manage their own products" ON public.products 
FOR ALL USING (auth.uid() = user_id OR is_manager());

-- 5. SUPPLIERS
DROP POLICY IF EXISTS "Staff can see all suppliers" ON public.suppliers;
CREATE POLICY "Staff can see all suppliers" ON public.suppliers 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can manage their own suppliers" ON public.suppliers;
CREATE POLICY "Staff can manage their own suppliers" ON public.suppliers 
FOR ALL USING (auth.uid() = user_id OR is_manager());

-- 6. BILLS
DROP POLICY IF EXISTS "Staff can see all bills" ON public.bills;
CREATE POLICY "Staff can see all bills" ON public.bills 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can manage their own bills" ON public.bills;
CREATE POLICY "Staff can manage their own bills" ON public.bills 
FOR ALL USING (auth.uid() = user_id OR is_manager());

-- 7. INVOICES
DROP POLICY IF EXISTS "Staff can see all invoices" ON public.invoices;
CREATE POLICY "Staff can see all invoices" ON public.invoices 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can manage their own invoices" ON public.invoices;
CREATE POLICY "Staff can manage their own invoices" ON public.invoices 
FOR ALL USING (auth.uid() = user_id OR is_manager());

-- 8. QUOTATIONS
DROP POLICY IF EXISTS "Staff can see all quotations" ON public.quotations;
CREATE POLICY "Staff can see all quotations" ON public.quotations 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can manage their own quotations" ON public.quotations;
CREATE POLICY "Staff can manage their own quotations" ON public.quotations 
FOR ALL USING (auth.uid() = user_id OR is_manager());

-- 9. SUPPORT TICKETS
DROP POLICY IF EXISTS "Staff can see all tickets" ON public.support_tickets;
CREATE POLICY "Staff can see all tickets" ON public.support_tickets 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own tickets" ON public.support_tickets;
CREATE POLICY "Users can manage their own tickets" ON public.support_tickets 
FOR ALL USING (auth.uid() = user_id OR is_manager());

DROP POLICY IF EXISTS "Staff can see all messages" ON public.ticket_messages;
CREATE POLICY "Staff can see all messages" ON public.ticket_messages 
FOR SELECT USING (is_company_staff() OR EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can add messages to their tickets" ON public.ticket_messages;
CREATE POLICY "Users can add messages to their tickets" ON public.ticket_messages 
FOR INSERT WITH CHECK (is_company_staff() OR EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid()));

-- Final Refresh
NOTIFY pgrst, 'reload schema';

