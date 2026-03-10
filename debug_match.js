import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testMatchAndUpdate() {
    try {
        console.log("Fetching up to 5 orders from tiktok_finance...");
        const { data: finance, error: finErr } = await supabase
            .from('tiktok_finance')
            .select('order_id')
            .limit(5);

        if (finErr) throw finErr;
        if (!finance || finance.length === 0) {
            console.log("No data found in tiktok_finance.");
            return;
        }

        const ids = finance.map(f => f.order_id);
        console.log("Checking these orders in tiktok_sales: ", ids);

        const { data: sales, error: saleErr } = await supabase
            .from('tiktok_sales')
            .select('order_id, order_status')
            .in('order_id', ids);

        if (saleErr) throw saleErr;

        console.log("Found in tiktok_sales:", sales);

        if (sales && sales.length > 0) {
            const firstId = sales[0].order_id;
            console.log(`\nAttempting to set order_id = ${firstId} to 'Completed'`);

            const { data: updateData, error: updateError } = await supabase
                .from('tiktok_sales')
                .update({ order_status: 'Completed' })
                .eq('order_id', firstId)
                .select();

            if (updateError) {
                console.error("Update failed with error:", updateError);
            } else {
                console.log("Update success! Data returned:", updateData);
                console.log("If this works here, the issue is on the frontend logic or there is no matching order ID.");
            }
        } else {
            console.log("\nWARNING: None of the finance order IDs exist in tiktok_sales. They do not match.");
            console.log("This means the 'Cari Match Baru' button will do nothing because there's no Penjualan transaction that has the EXACT SAME order_id as Keuangan.");
        }
    } catch (e) {
        console.error("Script error:", e);
    }
}

testMatchAndUpdate()
