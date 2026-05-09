-- This migration unlocks shared company data for internal roles (Admin, Manager, Staff, Support)
-- while maintaining privacy for external Clients.

-- Function to check if the current user is a company staff member
CREATE OR REPLACE FUNCTION is_company_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('admin', 'accounts_manager', 'project_manager', 'staff', 'ticket_support')
    FROM profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. PRODUCTS
DROP POLICY IF EXISTS "Users can manage their own products" ON public.products;
CREATE POLICY "Staff can see all products" ON public.products 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);
CREATE POLICY "Staff can manage their own products" ON public.products 
FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all products" ON public.products 
FOR ALL USING (is_company_staff()); -- We can refine this later if needed

-- 2. SUPPLIERS
DROP POLICY IF EXISTS "Users can manage their own suppliers" ON public.suppliers;
CREATE POLICY "Staff can see all suppliers" ON public.suppliers 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);
CREATE POLICY "Staff can manage their own suppliers" ON public.suppliers 
FOR ALL USING (auth.uid() = user_id);

-- 3. BILLS
DROP POLICY IF EXISTS "Users can manage their own bills" ON public.bills;
CREATE POLICY "Staff can see all bills" ON public.bills 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);
CREATE POLICY "Staff can manage their own bills" ON public.bills 
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own bill items" ON public.bill_items;
CREATE POLICY "Staff can see all bill items" ON public.bill_items 
FOR SELECT USING (is_company_staff() OR EXISTS (SELECT 1 FROM bills WHERE id = bill_id AND user_id = auth.uid()));
CREATE POLICY "Staff can manage their own bill items" ON public.bill_items 
FOR ALL USING (EXISTS (SELECT 1 FROM bills WHERE id = bill_id AND user_id = auth.uid()));

-- 4. QUOTATIONS
DROP POLICY IF EXISTS "Users can only see their own quotations" ON public.quotations;
CREATE POLICY "Staff can see all quotations" ON public.quotations 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);
CREATE POLICY "Staff can manage their own quotations" ON public.quotations 
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only see items of their own quotations" ON public.quotation_items;
CREATE POLICY "Staff can see all quotation items" ON public.quotation_items 
FOR SELECT USING (is_company_staff() OR EXISTS (SELECT 1 FROM quotations WHERE id = quotation_id AND user_id = auth.uid()));
CREATE POLICY "Staff can manage their own quotation items" ON public.quotation_items 
FOR ALL USING (EXISTS (SELECT 1 FROM quotations WHERE id = quotation_id AND user_id = auth.uid()));

-- 5. CLIENTS (Ensure it's consistent)
DROP POLICY IF EXISTS "Public can see client info" ON public.clients;
CREATE POLICY "Staff can see all clients" ON public.clients 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);
CREATE POLICY "Staff can manage their own clients" ON public.clients 
FOR ALL USING (auth.uid() = user_id);

-- 6. INVOICES (Ensure it's consistent)
DROP POLICY IF EXISTS "Allow all access to invoices" ON public.invoices;
CREATE POLICY "Staff can see all invoices" ON public.invoices 
FOR SELECT USING (is_company_staff() OR auth.uid() = user_id);
CREATE POLICY "Staff can manage their own invoices" ON public.invoices 
FOR ALL USING (auth.uid() = user_id);

-- Refresh
NOTIFY pgrst, 'reload schema';
