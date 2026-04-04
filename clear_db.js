const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearData() {
  console.log('Clearing database...')
  
  const tables = [
    'bill_items',
    'stock_history',
    'price_history',
    'supplier_bills',
    'products',
    'suppliers'
  ]

  for (const table of tables) {
    const { data: items } = await supabase.from(table).select('id')
    if (items && items.length > 0) {
      const { error } = await supabase.from(table).delete().in('id', items.map(i => i.id))
      if (error) console.error(`Error clearing ${table}:`, error)
      else console.log(`Cleared ${items.length} rows from ${table}`)
    } else {
      console.log(`${table} is already empty or error fetching.`)
    }
  }

  console.log('Done.')
}

clearData()
