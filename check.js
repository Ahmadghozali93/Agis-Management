import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'REDACTED'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'REDACTED'
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const { data } = await supabase.from('stock_mutations').select('*').limit(1)
    if (data && data.length > 0) {
        console.log("Keys:", Object.keys(data[0]))
    } else {
        const { error } = await supabase.from('stock_mutations').insert([{ product_name: 'test', type: 'in', qty: 1 }]).select()
        console.log("Insert result:", error ? error.message : "Success")
        const { data: d2 } = await supabase.from('stock_mutations').select('*').limit(1)
        if (d2 && d2.length > 0) console.log("Keys after insert:", Object.keys(d2[0]))
    }
}
run()
