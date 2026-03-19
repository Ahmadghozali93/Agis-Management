import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: prod } = await supabase.from('products').select('*');
    const { data: pur } = await supabase.from('purchases').select('*').neq('status', 'batal');
    const { data: mut } = await supabase.from('stock_mutations').select('*');

    console.log("Products:", JSON.stringify(prod, null, 2));
    console.log("Purchases:", JSON.stringify(pur, null, 2));
    console.log("Mutations:", JSON.stringify(mut, null, 2));
}

check().catch(console.error);
