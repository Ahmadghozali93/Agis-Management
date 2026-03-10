-- Menambahkan kolom ref_id ke tabel stock_mutations jika belum ada
ALTER TABLE public.stock_mutations 
ADD COLUMN IF NOT EXISTS ref_id TEXT;

-- (Opsional) Refresh schema cache agar otomatis terbaca oleh API / Trigger
NOTIFY pgrst, 'reload schema';
