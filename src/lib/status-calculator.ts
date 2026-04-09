import { supabase } from './supabase'

export async function recalculateSupplierStatuses(supplierId: string) {
  if (!supplierId) return

  // 1. Fetch supplier opening balance
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('opening_balance')
    .eq('id', supplierId)
    .single()
    
  if (!supplier) return

  const openingBalance = Number(supplier.opening_balance || 0)

  // 2. Fetch all payments
  const { data: payments } = await supabase
    .from('supplier_payments')
    .select('amount')
    .eq('supplier_id', supplierId)
    
  const totalPayments = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)

  // 3. Fetch all bills sorted chronologically (oldest first)
  const { data: bills } = await supabase
    .from('supplier_bills')
    .select('id, total_with_vat, status')
    .eq('supplier_id', supplierId)
    .order('date_ad', { ascending: true })
    .order('created_at', { ascending: true })
  
  if (!bills || bills.length === 0) return

  // 4. Calculate FIFO
  let availablePool = totalPayments
  availablePool -= openingBalance
  if (availablePool < 0) availablePool = 0

  for (const bill of bills) {
    const billTotal = Number(bill.total_with_vat || 0)
    let newStatus: 'pending' | 'partial' | 'paid' = 'pending'

    if (availablePool >= billTotal) {
      newStatus = 'paid'
      availablePool -= billTotal
    } else if (availablePool > 0) {
      newStatus = 'partial'
      availablePool = 0
    } else {
      newStatus = 'pending'
    }

    if (bill.status !== newStatus) {
      await supabase.from('supplier_bills').update({ status: newStatus } as any).eq('id', bill.id)
    }
  }
}

export async function recalculateCustomerStatuses(customerId: string) {
  if (!customerId) return

  // 1. Fetch customer opening balance
  const { data: customer } = await supabase
    .from('customers')
    .select('opening_balance')
    .eq('id', customerId)
    .single()
    
  if (!customer) return

  const openingBalance = Number(customer.opening_balance || 0)

  // 2. Fetch all payments
  const { data: payments } = await supabase
    .from('customer_payments')
    .select('amount')
    .eq('customer_id', customerId)
    
  const totalPayments = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)

  // 3. Fetch all bills sorted chronologically (oldest first)
  const { data: bills } = await supabase
    .from('customer_bills')
    .select('id, total_with_vat, status')
    .eq('customer_id', customerId)
    .order('date_ad', { ascending: true })
    .order('created_at', { ascending: true })
  
  if (!bills || bills.length === 0) return

  // 4. Calculate FIFO
  let availablePool = totalPayments
  availablePool -= openingBalance
  if (availablePool < 0) availablePool = 0

  for (const bill of bills) {
    const billTotal = Number(bill.total_with_vat || 0)
    let newStatus: 'pending' | 'partial' | 'paid' = 'pending'

    if (availablePool >= billTotal) {
      newStatus = 'paid'
      availablePool -= billTotal
    } else if (availablePool > 0) {
      newStatus = 'partial'
      availablePool = 0
    } else {
      newStatus = 'pending'
    }

    if (bill.status !== newStatus) {
      await supabase.from('customer_bills').update({ status: newStatus } as any).eq('id', bill.id)
    }
  }
}
