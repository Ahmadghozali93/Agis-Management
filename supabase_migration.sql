-- ============================================
-- OLSHOP MANAGER - Supabase Database Migration
-- Run this SQL in Supabase SQL Editor
-- ============================================

-- 1. Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'host' CHECK (role IN ('admin', 'owner', 'spv', 'host', 'creator')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC DEFAULT 0,
  stock INTEGER DEFAULT 0,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TikTok Sales
CREATE TABLE IF NOT EXISTS tiktok_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT,
  product_name TEXT,
  qty INTEGER DEFAULT 0,
  total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'proses',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TikTok Finance
CREATE TABLE IF NOT EXISTS tiktok_finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT,
  type TEXT DEFAULT 'masuk',
  amount NUMERIC DEFAULT 0,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TikTok Returns
CREATE TABLE IF NOT EXISTS tiktok_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT,
  product_name TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TikTok Failed COD
CREATE TABLE IF NOT EXISTS tiktok_failed_cod (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT,
  product_name TEXT,
  customer_name TEXT,
  reason TEXT,
  total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Aggregator Sales
CREATE TABLE IF NOT EXISTS aggregator_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT,
  order_id TEXT,
  product_name TEXT,
  qty INTEGER DEFAULT 0,
  total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'proses',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Content Accounts
CREATE TABLE IF NOT EXISTS content_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT,
  username TEXT,
  followers INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Content Reports
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  platform TEXT,
  type TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Live Reports
CREATE TABLE IF NOT EXISTS live_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  platform TEXT,
  viewers INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  products_sold INTEGER DEFAULT 0,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Stock Mutations
CREATE TABLE IF NOT EXISTS stock_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT,
  type TEXT DEFAULT 'in' CHECK (type IN ('in', 'out')),
  qty INTEGER DEFAULT 0,
  note TEXT,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Purchases
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT,
  items TEXT,
  total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'belum_lunas',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT,
  amount NUMERIC DEFAULT 0,
  method TEXT DEFAULT 'transfer',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Incomes
CREATE TABLE IF NOT EXISTS incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  amount NUMERIC DEFAULT 0,
  note TEXT,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT,
  amount NUMERIC DEFAULT 0,
  note TEXT,
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_failed_cod ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregator_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (role checks done in app)
CREATE POLICY "Allow all for authenticated" ON profiles FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON categories FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON suppliers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON products FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON tiktok_sales FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON tiktok_finance FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON tiktok_returns FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON tiktok_failed_cod FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON aggregator_sales FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON content_accounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON content_reports FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON live_reports FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON stock_mutations FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON purchases FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON payments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON incomes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON expenses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON bank_accounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'host'),
    COALESCE(NEW.raw_user_meta_data->>'status', 'pending')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
