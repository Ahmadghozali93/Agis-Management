-- =====================================================
-- TRIGGER: Auto Stock Mutation for Mengantar Sales
-- Fungsi : Ketika status penjualan Mengantar berubah menjadi 'Selesai',
--          otomatis catat mutasi stok 'out' di tabel stock_mutations
-- Mirip dengan trigger tiktok (trigger_tiktok_sales_status_done)
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_mengantar_sales_status_selesai()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id uuid;
    v_product_name text;
    v_sku text;
    v_qty integer;
    v_note text;
    v_existing_id uuid;
    v_hpp numeric;
BEGIN
    -- Hanya bertindak jika status berubah ke 'Selesai'
    IF (LOWER(NEW.last_status) IN ('selesai', 'completed', 'done') AND
        (TG_OP = 'INSERT' OR LOWER(OLD.last_status) NOT IN ('selesai', 'completed', 'done'))) THEN

        -- Nilai dari order
        v_qty    := COALESCE(NEW.quantity, 0);
        v_note   := 'Penjualan Mengantar: ' || COALESCE(NEW.tracking_id, NEW.order_id, NEW.id::text);

        -- Cari produk dari tabel products berdasarkan goods_description
        SELECT id, name, sku, hpp
        INTO v_product_id, v_product_name, v_sku, v_hpp
        FROM products
        WHERE LOWER(name) = LOWER(NEW.goods_description)
        LIMIT 1;

        -- Fallback ke goods_description jika produk tidak ditemukan
        IF v_product_name IS NULL THEN
            v_product_name := NEW.goods_description;
        END IF;

        -- Cek apakah mutasi sudah ada untuk tracking_id ini
        SELECT id INTO v_existing_id
        FROM stock_mutations
        WHERE note = v_note
        LIMIT 1;

        -- Insert mutasi stok keluar hanya jika belum ada
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
                COALESCE(NEW.tracking_id, NEW.order_id),
                v_product_name,
                v_sku,
                'out',
                v_qty,
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
DROP TRIGGER IF EXISTS trg_mengantar_sales_status_selesai ON mengantar_sales;

-- Buat trigger baru
CREATE TRIGGER trg_mengantar_sales_status_selesai
AFTER INSERT OR UPDATE OF last_status ON mengantar_sales
FOR EACH ROW
EXECUTE FUNCTION trigger_mengantar_sales_status_selesai();
