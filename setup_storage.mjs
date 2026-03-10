import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupStorage() {
    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets()
        if (listError) throw listError

        const logosBucket = buckets.find(b => b.name === 'outlets') || buckets.find(b => b.name === 'assets') || buckets.find(b => b.name === 'settings')

        console.log("Existing buckets:", buckets.map(b => b.name))

        // Ensure a 'logos' bucket exists and is public
        if (!buckets.some(b => b.name === 'logos')) {
            console.log("Creating public 'logos' bucket...")
            const { data, error } = await supabase.storage.createBucket('logos', { public: true })
            if (error) throw error
            console.log("Bucket created:", data)
        } else {
            console.log("'logos' bucket already exists.")
        }
    } catch (e) {
        console.error("Storage setup error:", e)
    }
}

setupStorage()
