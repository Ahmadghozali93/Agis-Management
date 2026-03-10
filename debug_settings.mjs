import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function debug() {
    console.log("Checking settings table...")
    const { data, error } = await supabase.from('settings').select('*')
    if (error) {
        console.error("Error fetching settings:", error)
    } else {
        console.log("Settings data:", data)
    }
}

debug()
