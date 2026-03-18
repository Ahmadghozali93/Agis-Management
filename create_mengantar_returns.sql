-- =====================================================
-- Tabel: mengantar_returns
-- Menyimpan status dan biaya pengembalian (RTS) Mengantar
-- =====================================================

DROP TABLE IF EXISTS mengantar_returns CASCADE;

CREATE TABLE mengantar_returns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mengantar_sales_id UUID REFERENCES mengantar_sales(id) ON DELETE CASCADE,
    tracking_id TEXT NOT NULL,
    return_status TEXT DEFAULT 'Diproses', -- Diproses, Diterima, Hilang
    biaya_rts NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mengantar_returns_status ON mengantar_returns(return_status);
CREATE INDEX IF NOT EXISTS idx_mengantar_returns_tracking_id ON mengantar_returns(tracking_id);
CREATE INDEX IF NOT EXISTS idx_mengantar_returns_sales_id ON mengantar_returns(mengantar_sales_id);

-- RLS (Row Level Security)
ALTER TABLE mengantar_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON mengantar_returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON mengantar_returns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON mengantar_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete" ON mengantar_returns FOR DELETE TO authenticated USING (true);
