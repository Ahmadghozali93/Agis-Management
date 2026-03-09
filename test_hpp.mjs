import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function testHpp() {
    const { data } = await supabase.from('stock_mutations').select('hpp, type, product_name, pName:product_name').limit(10)
    console.log("From DB:", data)

    // Also test getAverageHpp manually if we can mock it
}
testHpp()
