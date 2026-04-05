import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function wipeData() {
  console.log('--- Starting Data Wipe ---')
  
  try {
    // Delete in sequence to avoid foreign key issues
    console.log('Clearing bill_items...')
    await supabase.from('bill_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log('Clearing stock_history...')
    await supabase.from('stock_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    console.log('Clearing supplier_payments...')
    await supabase.from('supplier_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log('Clearing supplier_bills...')
    await supabase.from('supplier_bills').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log('Clearing products...')
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log('Clearing suppliers...')
    await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    console.log('--- Data Wipe Complete ---')
  } catch (error) {
    console.error('Error during wipe:', error)
  }
}

wipeData()
