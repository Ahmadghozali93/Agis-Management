import { supabase } from './supabase'

export async function getAverageHpp(sku, name) {
    try {
        // 1. Get base HPP
        let baseHpp = 0
        let query = supabase.from('products').select('hpp')

        if (sku) {
            query = query.eq('sku', sku)
        } else if (name) {
            query = query.eq('name', name)
        } else {
            return 0
        }

        const { data: prodData } = await query.limit(1).maybeSingle()
        if (prodData) baseHpp = Number(prodData.hpp) || 0

        // 2. Get purchase history to calculate average
        const { data: purchases, error } = await supabase.from('purchases').select('items').in('status', ['lunas', 'pending'])
        if (error) throw error

        let totalCost = 0
        let totalQty = 0

        if (purchases) {
            purchases.forEach(p => {
                let items = p.items || []
                if (typeof items === 'string') {
                    try { items = JSON.parse(items) } catch (e) { items = [] }
                }
                if (Array.isArray(items)) {
                    items.forEach(it => {
                        const matchSku = sku && it.sku === sku
                        const matchName = name && it.name === name
                        if (matchSku || matchName) {
                            const q = Number(it.qty) || 0
                            const price = Number(it.price) || 0
                            totalCost += (q * price)
                            totalQty += q
                        }
                    })
                }
            })
        }

        const purchaseHpp = totalQty > 0 ? Math.round(totalCost / totalQty) : 0
        const avgHpp = purchaseHpp > 0 ? Math.round((baseHpp + purchaseHpp) / 2) : baseHpp

        return avgHpp
    } catch (err) {
        console.error('Error calculating average HPP:', err)
        return 0
    }
}
