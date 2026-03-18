-- =====================================================
-- Tabel: mengantar_sales
-- Menyimpan data penjualan dari platform Mengantar
-- =====================================================

-- Drop tabel jika sudah ada
DROP TABLE IF EXISTS mengantar_sales CASCADE;

CREATE TABLE mengantar_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expedition TEXT,
    order_id TEXT,
    tracking_id TEXT,
    stt_number TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    province TEXT,
    city TEXT,
    weight NUMERIC DEFAULT 0,
    cod NUMERIC DEFAULT 0,
    product_value NUMERIC DEFAULT 0,
    product_id TEXT,
    goods_description TEXT,
    quantity INTEGER DEFAULT 0,
    diskon_persentase NUMERIC DEFAULT 0,
    diskon_nominal NUMERIC DEFAULT 0,
    harga_jual NUMERIC DEFAULT 0,
    harga_setelah_diskon NUMERIC DEFAULT 0,
    cogs NUMERIC DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    sender_name TEXT,
    create_date TIMESTAMPTZ,
    last_update TIMESTAMPTZ,
    timestamp TEXT,
    last_status TEXT,
    last_pod_status TEXT,
    shipping_fee NUMERIC DEFAULT 0,
    shipping_discount NUMERIC DEFAULT 0,
    cod_fee NUMERIC DEFAULT 0,
    shipping_fee_without_discount NUMERIC DEFAULT 0,
    estimated_pricing NUMERIC DEFAULT 0,
    origin_code TEXT,
    destination_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_mengantar_sales_order_id ON mengantar_sales(order_id);
CREATE INDEX IF NOT EXISTS idx_mengantar_sales_tracking_id ON mengantar_sales(tracking_id);
CREATE INDEX IF NOT EXISTS idx_mengantar_sales_create_date ON mengantar_sales(create_date);
CREATE INDEX IF NOT EXISTS idx_mengantar_sales_last_status ON mengantar_sales(last_status);

-- Unique constraint pada order_id agar tidak ada duplikat
ALTER TABLE mengantar_sales ADD CONSTRAINT mengantar_sales_order_id_unique UNIQUE (order_id);

-- RLS (Row Level Security)
ALTER TABLE mengantar_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON mengantar_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON mengantar_sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON mengantar_sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete" ON mengantar_sales FOR DELETE TO authenticated USING (true);
