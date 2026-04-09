import { supabase } from './supabase'
import { recalculateSupplierStatuses, recalculateCustomerStatuses } from './status-calculator'

export async function deleteSupplierBill(billId: string, supplierId: string) {
  if (!billId || !supplierId) return { error: 'Missing bill or supplier ID' }

  try {
    // 1. Fetch bill items to revert stock
    const { data: items, error: itemsError } = await supabase
      .from('bill_items')
      .select('product_id, quantity')
      .eq('bill_id', billId)

    if (itemsError) throw itemsError

    // 2. Revert stock sequentially
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.product_id) continue
        
        // Fetch current quantity
        const { data: prod } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single()

        if (prod) {
          const newQty = Number(prod.quantity || 0) - Number(item.quantity || 0)
          await supabase
            .from('products')
            .update({ quantity: newStatusCheck(newQty) } as any)
            .eq('id', item.product_id)
        }
      }
    }

    // 3. Delete stock history logs
    await supabase.from('stock_history').delete().eq('reference_id', billId)

    // 4. Delete bill items
    const { error: delItemsError } = await supabase.from('bill_items').delete().eq('bill_id', billId)
    if (delItemsError) throw delItemsError

    // 5. Delete bill
    const { error: delBillError } = await supabase.from('supplier_bills').delete().eq('id', billId)
    if (delBillError) throw delBillError

    // 6. Recalculate statuses
    await recalculateSupplierStatuses(supplierId)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting supplier bill:', error)
    return { error: error.message || 'Failed to delete bill' }
  }
}

export async function deleteCustomerBill(billId: string, customerId: string) {
  if (!billId || !customerId) return { error: 'Missing bill or customer ID' }

  try {
    // 1. Fetch billing items to revert stock
    const { data: items, error: itemsError } = await supabase
      .from('customer_bill_items')
      .select('product_id, quantity')
      .eq('bill_id', billId)

    if (itemsError) throw itemsError

    // 2. Revert stock sequentially (Customers TOOK stock, so we RETURN it to inventory)
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.product_id) continue
        
        // Fetch current quantity
        const { data: prod } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single()

        if (prod) {
          const newQty = Number(prod.quantity || 0) + Number(item.quantity || 0)
          await supabase
            .from('products')
            .update({ quantity: newStatusCheck(newQty) } as any)
            .eq('id', item.product_id)
        }
      }
    }

    // 3. Delete stock history logs
    await supabase.from('stock_history').delete().eq('reference_id', billId)

    // 4. Delete items
    const { error: delItemsError } = await supabase.from('customer_bill_items').delete().eq('bill_id', billId)
    if (delItemsError) throw delItemsError

    // 5. Delete bill
    const { error: delBillError } = await supabase.from('customer_bills').delete().eq('id', billId)
    if (delBillError) throw delBillError

    // 6. Recalculate statuses
    await recalculateCustomerStatuses(customerId)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting customer bill:', error)
    return { error: error.message || 'Failed to delete bill' }
  }
}

// Utility to ensure quantities don't go strictly NaN
function newStatusCheck(qty: number) {
    if (isNaN(qty)) return 0
    return qty
}

export async function revertSupplierBillStock(billId: string) {
  // Reverts stock and deletes bill items without deleting the bill itself
  const { data: items } = await supabase.from('bill_items').select('product_id, quantity').eq('bill_id', billId)
  if (items && items.length > 0) {
    for (const item of items) {
      if (!item.product_id) continue
      const { data: prod } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
      if (prod) {
        const newQty = Number(prod.quantity || 0) - Number(item.quantity || 0)
        await supabase.from('products').update({ quantity: newStatusCheck(newQty) } as any).eq('id', item.product_id)
      }
    }
  }
  await supabase.from('stock_history').delete().eq('reference_id', billId)
  await supabase.from('bill_items').delete().eq('bill_id', billId)
}

export async function revertCustomerBillStock(billId: string) {
  const { data: items } = await supabase.from('customer_bill_items').select('product_id, quantity').eq('bill_id', billId)
  if (items && items.length > 0) {
    for (const item of items) {
      if (!item.product_id) continue
      const { data: prod } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
      if (prod) {
        const newQty = Number(prod.quantity || 0) + Number(item.quantity || 0)
        await supabase.from('products').update({ quantity: newStatusCheck(newQty) } as any).eq('id', item.product_id)
      }
    }
  }
  await supabase.from('stock_history').delete().eq('reference_id', billId)
  await supabase.from('customer_bill_items').delete().eq('bill_id', billId)
}

export async function deleteSupplierPayment(paymentId: string, supplierId: string) {
  if (!paymentId || !supplierId) return { error: 'Missing payment or supplier ID' }

  try {
    const { error } = await supabase.from('supplier_payments').delete().eq('id', paymentId)
    if (error) throw error

    // Recalculate bill statuses for this supplier
    await recalculateSupplierStatuses(supplierId)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting supplier payment:', error)
    return { error: error.message || 'Failed to delete payment' }
  }
}

export async function deleteCustomerPayment(paymentId: string, customerId: string) {
  if (!paymentId || !customerId) return { error: 'Missing payment or customer ID' }

  try {
    const { error } = await supabase.from('customer_payments').delete().eq('id', paymentId)
    if (error) throw error

    // Recalculate bill statuses for this customer
    await recalculateCustomerStatuses(customerId)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting customer payment:', error)
    return { error: error.message || 'Failed to delete payment' }
  }
}
