-- =============================================
-- COA SCHEMA (Odoo-Style Chart of Accounts)
-- =============================================

-- Buat tabel COA
CREATE TABLE IF NOT EXISTS public.coa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    parent_id UUID REFERENCES public.coa(id) ON DELETE CASCADE,
    account_group TEXT,
    allow_reconciliation BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambah kolom baru jika tabel sudah ada
ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS account_group TEXT;
ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS allow_reconciliation BOOLEAN DEFAULT false;
ALTER TABLE public.coa ADD COLUMN IF NOT EXISTS description TEXT;

-- Update constraint tipe akun (Odoo-style)
ALTER TABLE public.coa DROP CONSTRAINT IF EXISTS coa_type_check;
ALTER TABLE public.coa ADD CONSTRAINT coa_type_check CHECK (type IN (
    'asset', 'fixed_asset', 'receivable',
    'liability', 'payable',
    'equity',
    'income',
    'expense'
));

-- Pastikan kode COA unik
CREATE UNIQUE INDEX IF NOT EXISTS idx_coa_code_unique ON public.coa (code) WHERE code IS NOT NULL AND code != '';

-- =============================================
-- SEED DATA: COA Default
-- =============================================

-- Hapus data lama jika perlu (hati-hati di production!)
-- DELETE FROM public.coa;

-- ASET (1xxx)
INSERT INTO public.coa (code, name, type, account_group) VALUES
    ('1000', 'Kas', 'asset', 'Kas/Bank'),
    ('1010', 'Bank', 'asset', 'Kas/Bank'),
    ('1100', 'Piutang Usaha', 'receivable', 'Aset Lancar'),
    ('1200', 'Persediaan', 'asset', 'Aset Lancar'),
    ('1500', 'Peralatan', 'fixed_asset', 'Aset Tetap')
ON CONFLICT DO NOTHING;

-- KEWAJIBAN (2xxx)
INSERT INTO public.coa (code, name, type, account_group) VALUES
    ('2000', 'Utang Usaha', 'payable', 'Kewajiban Lancar'),
    ('2100', 'Utang Gaji', 'liability', 'Kewajiban Lancar'),
    ('2200', 'Utang Pajak', 'liability', 'Kewajiban Lancar')
ON CONFLICT DO NOTHING;

-- EKUITAS (3xxx)
INSERT INTO public.coa (code, name, type, account_group) VALUES
    ('3000', 'Modal Pemilik', 'equity', 'Ekuitas'),
    ('3100', 'Laba Ditahan', 'equity', 'Ekuitas')
ON CONFLICT DO NOTHING;

-- PENDAPATAN (4xxx)
INSERT INTO public.coa (code, name, type, account_group) VALUES
    ('4000', 'Pendapatan Penjualan', 'income', 'Pendapatan'),
    ('4100', 'Pendapatan Jasa', 'income', 'Pendapatan')
ON CONFLICT DO NOTHING;

-- BEBAN (5xxx)
INSERT INTO public.coa (code, name, type, account_group) VALUES
    ('5000', 'Beban Gaji', 'expense', 'Beban'),
    ('5100', 'Beban Marketing', 'expense', 'Beban'),
    ('5200', 'Beban Listrik', 'expense', 'Beban'),
    ('5300', 'Beban Internet', 'expense', 'Beban')
ON CONFLICT DO NOTHING;

-- =============================================
-- TABEL PENDUKUNG
-- =============================================

-- Kolom incomes
-- ALTER TABLE public.incomes RENAME COLUMN source TO category;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- Kolom expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Tabel saldo per akun COA (untuk Neraca)
CREATE TABLE IF NOT EXISTS public.coa_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coa_id UUID UNIQUE NOT NULL REFERENCES public.coa(id) ON DELETE CASCADE,
    balance NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
