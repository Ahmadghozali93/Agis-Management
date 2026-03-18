-- =====================================================
-- FIX: Strip leading apostrophes from tracking_id fields
-- Dijalankan sekali untuk membersihkan data lama yang
-- tracking_id-nya punya prefix apostrof dari Excel
-- Contoh: 'MGT001234 → MGT001234
-- =====================================================

-- 1. Bersihkan mengantar_sales
UPDATE mengantar_sales
SET tracking_id = LTRIM(tracking_id, '''')
WHERE tracking_id LIKE '''%';

-- 2. Bersihkan mengantar_finance
UPDATE mengantar_finance
SET tracking_id = LTRIM(tracking_id, '''')
WHERE tracking_id LIKE '''%';

-- 3. Bersihkan mengantar_returns
UPDATE mengantar_returns
SET tracking_id = LTRIM(tracking_id, '''')
WHERE tracking_id LIKE '''%';

-- 4. Bersihkan order_id di mengantar_sales juga
UPDATE mengantar_sales
SET order_id = LTRIM(order_id, '''')
WHERE order_id LIKE '''%';

-- Verifikasi
SELECT COUNT(*) as masih_ada_apostrof_sales
FROM mengantar_sales WHERE tracking_id LIKE '''%';

SELECT COUNT(*) as masih_ada_apostrof_finance
FROM mengantar_finance WHERE tracking_id LIKE '''%';
