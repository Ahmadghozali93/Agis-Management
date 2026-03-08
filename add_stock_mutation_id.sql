-- Menambahkan kolom reference_id ke tabel stock_mutations
ALTER TABLE public.stock_mutations 
ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- Merefresh schema cache Supabase agar API segera mengenali kolom baru
NOTIFY pgrst, 'reload schema';
