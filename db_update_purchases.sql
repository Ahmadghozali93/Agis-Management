-- 1. Tambahkan kolom purchase_no ke tabel purchases dengan tipe VARCHAR
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS purchase_no VARCHAR;

-- 2. Jadikan kolom tersebut UNIQUE
ALTER TABLE public.purchases ADD CONSTRAINT purchases_purchase_no_key UNIQUE (purchase_no);
