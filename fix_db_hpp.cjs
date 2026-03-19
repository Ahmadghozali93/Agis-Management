const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching all products and purchases...");
    const [prodRes, purRes, mutRes] = await Promise.all([
        supabase.from("products").select("id, name, sku, hpp"),
        supabase.from("purchases").select("items, status").neq("status", "batal"),
        supabase.from("stock_mutations").select("id, hpp, sku, product_name")
    ]);

    let allPurchasedItems = [];
    if (purRes.data) {
        purRes.data.forEach(p => {
            let pItems = p.items;
            if (typeof pItems === "string") {
                try { pItems = JSON.parse(pItems) } catch (e) { pItems = [] }
            }
            if (Array.isArray(pItems)) {
                allPurchasedItems.push(...pItems);
            }
        });
    }

    const computedProducts = (prodRes.data || []).map(p => {
        const baseHpp = Number(p.hpp) || 0;
        const pItems = allPurchasedItems.filter(it => it.product_id === p.id || (it.sku && p.sku && it.sku === p.sku) || it.name === p.name);
        let totalCost = 0;
        let totalQty = 0;
        pItems.forEach(it => {
            const q = Number(it.qty) || 0;
            const price = Number(it.price) || 0;
            totalCost += (q * price);
            totalQty += q;
        });
        const purchaseHpp = totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
        const avgHpp = purchaseHpp > 0 ? Math.round((baseHpp + purchaseHpp) / 2) : baseHpp;
        return { ...p, avg_hpp: avgHpp };
    });

    console.log("Calculated Dynamic HPP for Products.");

    const mutations = mutRes.data || [];
    let updatedCount = 0;

    for (const m of mutations) {
        const prod = computedProducts.find(p => (m.sku && p.sku === m.sku) || p.name === m.product_name);
        const correctHpp = prod ? prod.avg_hpp : m.hpp;
        
        if (m.hpp !== correctHpp) {
            await supabase.from("stock_mutations").update({ hpp: correctHpp }).eq("id", m.id);
            updatedCount++;
            console.log(`Updated Mutation ID ${m.id} from ${m.hpp} to ${correctHpp}`);
        }
    }

    console.log(`Finished updating ${updatedCount} mutations.`);
}

main().catch(console.error);
