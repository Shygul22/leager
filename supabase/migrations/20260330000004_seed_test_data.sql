-- Migration: Seed Test Data for MRP and Discount Features
DO $$
DECLARE
    v_user_id UUID;
    v_client_id UUID;
    v_product1_id UUID;
    v_product2_id UUID;
    v_quotation_id UUID;
    v_invoice_id UUID;
BEGIN
    -- 1. Get the first user ID from profiles
    SELECT id INTO v_user_id FROM public.profiles LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'No user found in profiles. Please sign up first.';
        RETURN;
    END IF;

    -- 2. Insert a Sample Client
    INSERT INTO public.clients (name, email, phone, address, user_id)
    VALUES ('Acme Corp', 'contact@acme.com', '+1-555-0199', '123 Innovation Drive, Tech City', v_user_id)
    RETURNING id INTO v_client_id;

    -- 3. Insert Sample Products
    INSERT INTO public.products (name, description, rate, gst_rate, type, user_id)
    VALUES ('Premium Workstation', 'High-performance laptop for professional use', 1250.00, 18, 'product', v_user_id)
    RETURNING id INTO v_product1_id;

    INSERT INTO public.products (name, description, rate, gst_rate, type, user_id)
    VALUES ('Cloud Storage (1TB)', 'Annual subscription for cloud backup services', 99.00, 5, 'service', v_user_id)
    RETURNING id INTO v_product2_id;

    -- 4. Create a Sample Quotation with Global Discount
    INSERT INTO public.quotations (
        quotation_number, client_id, client_name, client_email, status, notes, discount_percentage, user_id
    )
    VALUES (
        'QT-TEST-001', v_client_id, 'Acme Corp', 'contact@acme.com', 'sent', 
        'Test quotation demonstrating line-item discounts and 5% global discount.', 5, v_user_id
    )
    RETURNING id INTO v_quotation_id;

    -- Line Items for Quotation
    INSERT INTO public.quotation_items (quotation_id, product_id, description, quantity, rate, gst, mrp, discount)
    VALUES (v_quotation_id, v_product1_id, 'Premium Workstation', 2, 1000.00, 18, 1250.00, 20); -- 20% discount on MRP

    INSERT INTO public.quotation_items (quotation_id, product_id, description, quantity, rate, gst, mrp, discount)
    VALUES (v_quotation_id, v_product2_id, 'Cloud Storage (1TB)', 1, 89.10, 5, 99.00, 10); -- 10% discount on MRP

    -- 5. Create a Sample Invoice with Global Discount
    INSERT INTO public.invoices (
        invoice_number, client_id, client_name, client_email, status, notes, discount_percentage, user_id
    )
    VALUES (
        'INV-TEST-001', v_client_id, 'Acme Corp', 'contact@acme.com', 'unpaid', 
        'Test invoice demonstrating high-discount scenario and 10% global discount.', 10, v_user_id
    )
    RETURNING id INTO v_invoice_id;

    -- Line Items for Invoice
    INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, gst, mrp, discount)
    VALUES (v_invoice_id, 'Bulk Hardware Order', 10, 450.00, 18, 500.00, 10);

END $$;
