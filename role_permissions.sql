-- Add role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    role text primary key,
    menus jsonb default '[]'::jsonb
);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select, insert, update
CREATE POLICY "Allow authenticated full access to role_permissions" ON role_permissions
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Insert default permissive roles
INSERT INTO role_permissions (role, menus) VALUES
('admin', '["dashboard", "master", "kategori", "supplier", "produk", "tiktok", "penjualan-tt", "failed-cod", "return", "keuangan-tt", "konten", "dashboard-konten", "data-akun", "laporan-konten", "laporan-live", "inventory", "stok-overview", "stok-mutation", "keuangan", "pembelian", "pembayaran", "pemasukan", "pengeluaran", "pindah-buku", "laba-rugi", "neraca", "users", "pengaturan", "general", "coa", "hak-akses"]'),
('owner', '["dashboard", "master", "kategori", "supplier", "produk", "tiktok", "penjualan-tt", "failed-cod", "return", "keuangan-tt", "konten", "dashboard-konten", "data-akun", "laporan-konten", "laporan-live", "inventory", "stok-overview", "stok-mutation", "keuangan", "pembelian", "pembayaran", "pemasukan", "pengeluaran", "pindah-buku", "laba-rugi", "neraca", "users", "pengaturan", "general", "coa", "hak-akses"]'),
('spv', '["dashboard", "master", "kategori", "supplier", "produk", "tiktok", "penjualan-tt", "failed-cod", "return", "keuangan-tt", "konten", "dashboard-konten", "data-akun", "laporan-konten", "laporan-live", "inventory", "stok-overview", "stok-mutation", "keuangan", "pembelian", "pembayaran", "pemasukan", "pengeluaran", "pindah-buku", "laba-rugi", "neraca"]'),
('host', '["dashboard", "tiktok", "penjualan-tt", "failed-cod", "return", "keuangan-tt", "konten", "dashboard-konten", "data-akun", "laporan-konten", "laporan-live"]'),
('creator', '["dashboard", "konten", "dashboard-konten", "data-akun", "laporan-konten", "laporan-live"]')
ON CONFLICT (role) DO UPDATE SET menus = EXCLUDED.menus;
