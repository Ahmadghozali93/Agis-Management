-- Menambahkan kolom return_status ke tabel tiktok_failed_cod
ALTER TABLE public.tiktok_failed_cod 
ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'Diproses';

-- Merefresh schema cache Supabase agar API segera mengenali kolom baru
NOTIFY pgrst, 'reload schema';
