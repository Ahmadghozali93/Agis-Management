import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf-8')
const env = {}
envFile.split('\n').forEach(line => {
    const [k, v] = line.split('=')
    if (k && v) env[k.trim()] = v.trim()
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function run() {
    const { data, error } = await supabase.from('tiktok_sales').select('order_status')
    if (error) console.error(error)
    const unique = new Set(data.map(d => d.order_status))
    console.log(Array.from(unique))
}
run()
