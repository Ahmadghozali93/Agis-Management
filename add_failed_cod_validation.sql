-- Menambahkan kolom is_validated ke tabel tiktok_failed_cod
ALTER TABLE public.tiktok_failed_cod 
ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false;

-- Merefresh schema cache Supabase agar API segera mengenali kolom baru
NOTIFY pgrst, 'reload schema';
