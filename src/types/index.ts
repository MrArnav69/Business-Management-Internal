export interface Category {
  id: string
  name: string
  prefix: string
  created_at: string
}

export interface Unit {
  id: string
  name: string
  abbreviation: string
  created_at: string
}

export interface Supplier {
  id: string
  supplier_code: string
  name: string
  phone: string
  phone_country: string
  phone_national: string
  email: string | null
  address: string | null
  gst_pan_number: string | null
  bank_details: string | null
  remarks: string | null
  status: 'active' | 'inactive'
  date_bs: string
  date_ad: string
  time: string
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  product_code: string
  name: string
  category_id: string
  unit: string
  quantity: number | null
  brand: string | null
  buy_rate: number
  sell_rate: number
  vat_pan: boolean
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  category?: Category
}

export interface BillItem {
  id: string
  bill_id: string
  product_id: string
  quantity: number
  unit: string
  buy_rate: number
  amount: number
  vat_pan: boolean
  created_at: string
  product?: Product
}

export interface SupplierBill {
  id: string
  bill_code: string
  supplier_id: string
  invoice_no: string | null
  date_bs: string
  date_ad: string
  time: string
  total_amount: number
  total_with_vat: number
  debit_amount: number
  credit_amount: number
  status: 'pending' | 'paid' | 'partial'
  created_at: string
  updated_at: string
  supplier?: Supplier
  items?: BillItem[]
}

export interface PriceHistory {
  id: string
  product_id: string
  buy_rate: number
  sell_rate: number
  date_bs: string
  date_ad: string
  created_at: string
}

export interface StockHistory {
  id: string
  product_id: string
  quantity_change: number
  quantity_after: number
  type: 'in' | 'out' | 'adjustment'
  reference_type: 'bill' | 'sale' | 'manual' | null
  reference_id: string | null
  date_bs: string
  date_ad: string
  created_at: string
  product?: Product
}
