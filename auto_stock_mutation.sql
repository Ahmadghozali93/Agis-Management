-- Function to handle stock mutation when a TikTok order is marked as 'done'
CREATE OR REPLACE FUNCTION trigger_tiktok_sales_status_done()
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
    -- Only act if status changed to 'done', 'completed', 'selesai', 'selesai otomatis'
    IF (LOWER(NEW.order_status) IN ('done', 'completed', 'selesai', 'selesai otomatis') AND 
        (TG_OP = 'INSERT' OR LOWER(OLD.order_status) NOT IN ('done', 'completed', 'selesai', 'selesai otomatis'))) THEN
        
        -- Default to values from the order
        v_product_name := NEW.product_name;
        v_sku := NEW.seller_sku;
        v_qty := NEW.quantity;
        v_note := 'Penjualan TikTok: ' || NEW.order_id;
        
        -- Try to find product_id and hpp from products table matching seller_sku
        SELECT id, name, hpp into v_product_id, v_product_name, v_hpp FROM products WHERE lower(sku) = lower(NEW.seller_sku) LIMIT 1;
        
        -- Fallback if no product found, keep original name
        IF v_product_name IS NULL THEN
            v_product_name := NEW.product_name;
        END IF;
        
        -- Check if mutation already exists for this order
        SELECT id INTO v_existing_id FROM stock_mutations WHERE note = v_note AND sku = v_sku LIMIT 1;
        
        -- Insert new stock mutation
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
                NEW.order_id,
                v_product_name,
                v_sku,
                'out',
                COALESCE(v_qty, 0),
                v_note,
                now(),
                COALESCE(v_hpp, 0)
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_tiktok_sales_status_done ON tiktok_sales;

-- Create the trigger
CREATE TRIGGER trg_tiktok_sales_status_done
AFTER INSERT OR UPDATE OF order_status ON tiktok_sales
FOR EACH ROW
EXECUTE FUNCTION trigger_tiktok_sales_status_done();
