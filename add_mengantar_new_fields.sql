-- Menambahkan 7 kolom baru sesuai header file import Mengantar terbaru
ALTER TABLE mengantar_sales ADD COLUMN IF NOT EXISTS expedition TEXT;
ALTER TABLE mengantar_sales ADD COLUMN IF NOT EXISTS stt_number TEXT;
ALTER TABLE mengantar_sales ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE mengantar_sales ADD COLUMN IF NOT EXISTS diskon_persentase NUMERIC DEFAULT 0;
ALTER TABLE mengantar_sales ADD COLUMN IF NOT EXISTS diskon_nominal NUMERIC DEFAULT 0;
ALTER TABLE mengantar_sales ADD COLUMN IF NOT EXISTS harga_setelah_diskon NUMERIC DEFAULT 0;
ALTER TABLE mengantar_sales ADD COLUMN IF NOT EXISTS cogs NUMERIC DEFAULT 0;

-- Catatan Index: jika nantinya stt_number dan product_id digunakan sebagai relasi atau keyword pencarian cepat.
CREATE INDEX IF NOT EXISTS idx_mengantar_sales_stt_number ON mengantar_sales(stt_number);
CREATE INDEX IF NOT EXISTS idx_mengantar_sales_product_id ON mengantar_sales(product_id);
