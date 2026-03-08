-- Buat tabel untuk pergerakan Pindah Buku antar rekening Kas/Bank
CREATE TABLE IF NOT EXISTS public.transfers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL,
    from_account varchar NOT NULL,
    to_account varchar NOT NULL,
    amount numeric NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);

-- Berikan akses RLS jika diperlukan (secara default public bisa akses karena anon key)
-- ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Bebas akses" ON public.transfers FOR ALL USING (true);
