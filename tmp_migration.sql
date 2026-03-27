-- 1. Multi-Currency Support Additions
ALTER TABLE profiles ADD COLUMN default_currency TEXT DEFAULT 'INR';
ALTER TABLE clients ADD COLUMN currency TEXT DEFAULT 'INR';
ALTER TABLE invoices ADD COLUMN currency TEXT DEFAULT 'INR';
ALTER TABLE invoices ADD COLUMN exchange_rate NUMERIC DEFAULT 1.0;

-- 2. Service Catalog (Products)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    rate NUMERIC DEFAULT 0,
    gst_rate NUMERIC DEFAULT 0,
    hsn_sac_code TEXT,
    type TEXT DEFAULT 'service',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own products" ON products FOR ALL USING (auth.uid() = user_id);

-- 3. Debit Management (Suppliers & Bills)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    currency TEXT DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own suppliers" ON suppliers FOR ALL USING (auth.uid() = user_id);

CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    supplier_name TEXT NOT NULL,
    supplier_email TEXT,
    supplier_phone TEXT,
    supplier_address TEXT,
    supplier_gstin TEXT,
    bill_number TEXT NOT NULL,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'unpaid',
    notes TEXT,
    payment_reference TEXT,
    currency TEXT DEFAULT 'INR',
    exchange_rate NUMERIC DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bills" ON bills FOR ALL USING (auth.uid() = user_id);

CREATE TABLE bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1,
    rate NUMERIC DEFAULT 0,
    gst NUMERIC DEFAULT 0
);

ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;

-- Note: In Supabase, usually referenced table RLS needs to be checked, or we use a nested select.
-- A simple policy for bill items:
CREATE POLICY "Users can manage their own bill items" ON bill_items FOR ALL USING (
    bill_id IN (SELECT id FROM bills WHERE user_id = auth.uid())
);
