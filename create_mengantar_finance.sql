-- =====================================================
-- Tabel: mengantar_finance
-- Menyimpan data keuangan/settlement dari platform Mengantar
-- =====================================================

DROP TABLE IF EXISTS mengantar_finance CASCADE;

CREATE TABLE mengantar_finance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE,
    description TEXT,
    tracking_id TEXT UNIQUE, -- Primary key untuk pencocokan
    courier TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    goods_description TEXT,
    quantity INTEGER DEFAULT 0,
    sender_name TEXT,
    cod_value NUMERIC DEFAULT 0,
    discounted_shipping_fee NUMERIC DEFAULT 0,
    estimated_pricing NUMERIC DEFAULT 0,
    cod_fee NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- Tabel: mengantar_withdrawals
-- Menyimpan log pencairan dana khusus platform Mengantar
-- =====================================================

DROP TABLE IF EXISTS mengantar_withdrawals CASCADE;

CREATE TABLE mengantar_withdrawals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store TEXT NOT NULL DEFAULT 'Mengantar', -- Secara default semuanya ditarik atas nama Mengantar
    amount NUMERIC NOT NULL DEFAULT 0,
    target_bank TEXT NOT NULL,
    withdraw_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Berikan akses full untuk authenticated user
ALTER TABLE mengantar_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE mengantar_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on mengantar_finance" ON mengantar_finance
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all for authenticated users on mengantar_withdrawals" ON mengantar_withdrawals
    FOR ALL USING (auth.role() = 'authenticated');

-- Indeksasi
CREATE INDEX idx_mengantar_finance_tracking ON mengantar_finance(tracking_id);
CREATE INDEX idx_mengantar_finance_date ON mengantar_finance(date);
CREATE INDEX idx_mengantar_withdrawals_store ON mengantar_withdrawals(store);
