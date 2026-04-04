-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  prefix TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  phone_country TEXT NOT NULL DEFAULT 'NP',
  phone_national TEXT NOT NULL,
  email TEXT,
  address TEXT,
  gst_pan_number TEXT,
  bank_details TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'active',
  date_bs TEXT NOT NULL,
  date_ad DATE NOT NULL,
  time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  unit TEXT NOT NULL,
  quantity DECIMAL(12,2) DEFAULT 0,
  brand TEXT,
  buy_rate DECIMAL(12,2) NOT NULL,
  sell_rate DECIMAL(12,2) NOT NULL,
  vat_pan BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Bills
CREATE TABLE supplier_bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_code TEXT UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  invoice_no TEXT,
  date_bs TEXT NOT NULL,
  date_ad DATE NOT NULL,
  time TIME NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  total_with_vat DECIMAL(12,2) NOT NULL,
  debit_amount DECIMAL(12,2) NOT NULL,
  credit_amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill Items
CREATE TABLE bill_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id UUID REFERENCES supplier_bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(12,2) NOT NULL,
  unit TEXT NOT NULL,
  buy_rate DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  vat_pan BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price History
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  buy_rate DECIMAL(12,2) NOT NULL,
  sell_rate DECIMAL(12,2) NOT NULL,
  date_bs TEXT NOT NULL,
  date_ad DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock History
CREATE TABLE stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  quantity_change DECIMAL(12,2) NOT NULL,
  quantity_after DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  date_bs TEXT NOT NULL,
  date_ad DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_code ON suppliers(supplier_code);
CREATE INDEX idx_supplier_bills_supplier ON supplier_bills(supplier_id);
CREATE INDEX idx_supplier_bills_date ON supplier_bills(date_ad);
CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_bill_items_product ON bill_items(product_id);
CREATE INDEX idx_price_history_product ON price_history(product_id);
CREATE INDEX idx_stock_history_product ON stock_history(product_id);
CREATE INDEX idx_stock_history_date ON stock_history(date_ad);

-- Seed predefined categories
INSERT INTO categories (name, prefix) VALUES
  ('Electrical', 'ELE'),
  ('Plumbing', 'PLB'),
  ('Paints & Finishes', 'PNT'),
  ('Cement & Concrete', 'CMT'),
  ('Steel & TMT', 'STL'),
  ('Roofing / CGI Sheets', 'RFG'),
  ('Plywood & Boards', 'PLY'),
  ('Tiles & Flooring', 'TIL'),
  ('Glass', 'GLS'),
  ('Hardware & Fittings', 'HDW'),
  ('Appliances', 'APL'),
  ('Tools', 'TOL'),
  ('Sanitary', 'SAN'),
  ('Welding & Fabrication', 'WLD'),
  ('Safety & Security', 'SAF');

-- Seed predefined units
INSERT INTO units (name, abbreviation) VALUES
  ('Pieces', 'pcs'),
  ('Meters', 'm'),
  ('Feet', 'ft'),
  ('Square Feet', 'sqft'),
  ('Liters', 'L'),
  ('Kilograms', 'kg'),
  ('Bag', 'bag'),
  ('Set', 'set'),
  ('Box', 'box'),
  ('Roll', 'roll');

-- ==========================================
-- Row Level Security (RLS) Policies
-- ==========================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Development: allow all operations (restrict in production)
CREATE POLICY "Allow all on categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on units" ON units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on supplier_bills" ON supplier_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on bill_items" ON bill_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock_history" ON stock_history FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- Auto-update updated_at trigger
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_bills_updated_at BEFORE UPDATE ON supplier_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
