-- =====================================================
-- TRIGGER: Auto Stock Mutation untuk Return Mengantar
-- Fungsi : Ketika return_status di mengantar_returns berubah ke 'Hilang',
--          otomatis catat mutasi stok 'out' ke tabel stock_mutations
-- Logika :
--   Diproses → stok di kolom 'RTS Proses' (ditangani di frontend, tidak ada DB action)
--   Diterima → stok kembali ke Gudang (tidak ada DB action, frontend menganggap stok ada)
--   Hilang   → stok keluar permanen (insert stock_mutations 'out')
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_mengantar_return_hilang()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id   uuid;
    v_product_name text;
    v_sku          text;
    v_qty          integer;
    v_note         text;
    v_existing_id  uuid;
    v_hpp          numeric;
BEGIN
    -- Hanya bertindak jika return_status berubah menjadi 'Hilang' atau 'Diterima'
    IF (LOWER(NEW.return_status) IN ('hilang', 'diterima') AND
        (TG_OP = 'INSERT' OR LOWER(OLD.return_status) <> LOWER(NEW.return_status))) THEN

        -- Ambil data dari mengantar_sales berdasarkan tracking_id
        SELECT
            ms.quantity,
            ms.goods_description
        INTO v_qty, v_product_name
        FROM mengantar_sales ms
        WHERE ms.id = NEW.mengantar_sales_id OR ms.tracking_id = NEW.tracking_id
        LIMIT 1;

        IF LOWER(NEW.return_status) = 'hilang' THEN
            v_note := 'Return Hilang Mengantar: ' || COALESCE(NEW.tracking_id, '');
        ELSE
            v_note := 'Return Diterima Mengantar: ' || COALESCE(NEW.tracking_id, '');
        END IF;

        -- Cari produk dari tabel products berdasarkan nama barang
        SELECT id, name, sku, hpp
        INTO v_product_id, v_product_name, v_sku, v_hpp
        FROM products
        WHERE LOWER(name) = LOWER(v_product_name)
        LIMIT 1;

        -- Cek apakah mutasi sudah ada
        SELECT id INTO v_existing_id
        FROM stock_mutations
        WHERE note = v_note
        LIMIT 1;

        -- Insert mutasi stok hanya jika belum ada
        IF v_existing_id IS NULL THEN
            INSERT INTO stock_mutations (
                reference_id,
                product_name,
                sku,
                type,
                qty,
                note,
                date,
                hpp
            ) VALUES (
                NEW.tracking_id,
                COALESCE(v_product_name, 'Produk Mengantar'),
                v_sku,
                CASE WHEN LOWER(NEW.return_status) = 'hilang' THEN 'out' ELSE 'in' END,
                COALESCE(v_qty, 1),
                v_note,
                now(),
                COALESCE(v_hpp, 0)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hapus trigger lama jika ada
DROP TRIGGER IF EXISTS trg_mengantar_return_hilang ON mengantar_returns;

-- Buat trigger baru
CREATE TRIGGER trg_mengantar_return_hilang
AFTER INSERT OR UPDATE OF return_status ON mengantar_returns
FOR EACH ROW
EXECUTE FUNCTION trigger_mengantar_return_hilang();
