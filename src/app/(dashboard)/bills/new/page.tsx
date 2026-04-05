'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Supplier, Product, Category } from '@/types'
import { VAT_RATE, UNITS } from '@/lib/constants'
import { getCurrentBsDate, getCurrentAdDate, getCurrentTime, formatNPR, getNepaliYear, bsToAd, adToBs } from '@/lib/nepali-date'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NepaliDatePicker } from 'nepali-datepicker-reactjs'
import 'nepali-datepicker-reactjs/dist/index.css'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ArrowLeft, Plus, Trash2, Loader2, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface BillItemRow {
  product_id: string
  product_name: string
  product_code: string
  quantity: number
  unit: string
  buy_rate: number
  amount: number
  vat_pan: boolean
}

interface NewSupplierForm {
  name: string
  phone: string
  email: string
  address: string
  gst_pan: string
  opening_balance: string
  opening_balance_date_bs: string
  opening_balance_date_ad: string
}

function NewBillContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedSupplierId = searchParams.get('supplier_id') || ''
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<(Product & { category_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedSupplierId, setSelectedSupplierId] = useState(preselectedSupplierId)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [billCode, setBillCode] = useState('Generating...')

  useEffect(() => {
    const fetchLatestBillCode = async () => {
      const nepaliYear = getNepaliYear()
      const { data, error } = await supabase
        .from('supplier_bills')
        .select('bill_code')
        .ilike('bill_code', `BILL${nepaliYear}-%`)
        .order('created_at', { ascending: false })
        .limit(1)
      
      let nextCode = `BILL${nepaliYear}-0001`
      if (!error && data && data.length > 0 && data[0].bill_code) {
        const lastCode = data[0].bill_code
        const num = parseInt(lastCode.replace(`BILL${nepaliYear}-`, ''), 10)
        if (!isNaN(num)) {
          nextCode = `BILL${nepaliYear}-${String(num + 1).padStart(4, '0')}`
        }
      }
      setBillCode(nextCode)
    }
    fetchLatestBillCode()
  }, [])

  const [billItems, setBillItems] = useState<BillItemRow[]>([])
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [isManualMode, setIsManualMode] = useState(false)

  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState<NewSupplierForm>({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst_pan: '',
    opening_balance: '0',
    opening_balance_date_bs: getCurrentBsDate(),
    opening_balance_date_ad: getCurrentAdDate(),
  })
  const [savingSupplier, setSavingSupplier] = useState(false)

  const handleNsBsDateChange = (val: string) => {
    const slashedVal = val.replace(/-/g, '/')
    setNewSupplier(prev => ({ 
      ...prev, 
      opening_balance_date_bs: slashedVal,
      opening_balance_date_ad: bsToAd(slashedVal).toISOString().split('T')[0]
    }))
  }

  const handleNsAdDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setNewSupplier(prev => ({ 
      ...prev, 
      opening_balance_date_ad: val,
      opening_balance_date_bs: adToBs(val)
    }))
  }

  // --- New Product inline state ---
  const [categories, setCategories] = useState<import('@/types').Category[]>([])
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [npName, setNpName] = useState('')
  const [npCategoryId, setNpCategoryId] = useState('')
  const [npUnit, setNpUnit] = useState('')
  const [npBuyRate, setNpBuyRate] = useState('')
  const [npSellRate, setNpSellRate] = useState('')
  const [npBrand, setNpBrand] = useState('')
  const [npVatPan, setNpVatPan] = useState(true)
  const [npQuantity, setNpQuantity] = useState('0')

  const resetNewProductForm = () => {
    setNpName(''); setNpCategoryId(''); setNpUnit(''); setNpBuyRate('');
    setNpSellRate(''); setNpBrand(''); setNpVatPan(true); setNpQuantity('0')
  }



  const [formDateBs, setFormDateBs] = useState(getCurrentBsDate())
  const [formDateAd, setFormDateAd] = useState(getCurrentAdDate())
  
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')

  const handleBsDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormDateBs(val)
    try {
      const adDate = bsToAd(val)
      setFormDateAd(adDate.toISOString().split('T')[0])
    } catch {
      // Ignore conversion if incomplete string
    }
  }

  const handleAdDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormDateAd(val)
    try {
      const bsDate = adToBs(val)
      setFormDateBs(bsDate)
    } catch {
      // Ignore
    }
  }

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true })
    if (!error) setSuppliers((data as any[]) || [])
  }, [])

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name', { ascending: true })
    if (data) setCategories(data as any[])
  }, [])

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('status', 'active')
      .order('name', { ascending: true })
    if (!error) {
      const productsData = data as any[]
      setProducts(
        (productsData || []).map((p: any) => ({
          ...p,
          category_name: p.categories?.name || '—',
        }))
      )
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchSuppliers(), fetchProducts(), fetchCategories()]).finally(() => setLoading(false))
  }, [fetchSuppliers, fetchProducts, fetchCategories])

  const addProduct = (product: Product, quantity: number = 1) => {
    setBillItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_code: product.product_code,
        quantity: quantity,
        unit: product.unit,
        buy_rate: product.buy_rate,
        amount: product.buy_rate * quantity,
        vat_pan: product.vat_pan,
      },
    ])
    setProductSearchOpen(false)
    setProductSearch('')
  }

  const handleAddNewProduct = async () => {
    if (!npName.trim()) { toast.error('Product name is required'); return }
    if (!npCategoryId) { toast.error('Category is required'); return }
    if (!npUnit) { toast.error('Unit is required'); return }
    if (!npBuyRate || isNaN(Number(npBuyRate))) { toast.error('Valid buy rate is required'); return }
    if (!npSellRate || isNaN(Number(npSellRate))) { toast.error('Valid sell rate is required'); return }
    setSavingProduct(true)
    try {
      const category = categories.find((c: any) => c.id === npCategoryId)
      const prefix = (category as any)?.prefix || 'PRD'
      const { data: latest } = await supabase.from('products').select('product_code')
        .ilike('product_code', `${prefix}-%`).order('created_at', { ascending: false }).limit(1)
      let code = `${prefix}-0001`
      if (latest && latest.length > 0) {
        const num = parseInt(latest[0].product_code.replace(`${prefix}-`, ''), 10)
        if (!isNaN(num)) code = `${prefix}-${String(num + 1).padStart(4, '0')}`
      }
      const initialQty = Number(npQuantity) || 0
      const payload = {
        name: npName.trim(), category_id: npCategoryId, unit: npUnit,
        buy_rate: Number(npBuyRate), sell_rate: Number(npSellRate),
        brand: npBrand.trim() || null, vat_pan: npVatPan,
        status: 'active', product_code: code, quantity: initialQty,
      }
      const { data: inserted, error } = await supabase.from('products').insert(payload as any).select().single()
      if (error) throw error
      if (initialQty > 0 && inserted) {
        await supabase.from('stock_history').insert({
          product_id: inserted.id, quantity_change: initialQty, quantity_after: initialQty,
          type: 'in', reference_type: 'manual', reference_id: null,
          date_bs: getCurrentBsDate(), date_ad: getCurrentAdDate(), time: getCurrentTime(),
        } as any)
      }
      toast.success('Product created and added to bill!')
      await fetchProducts()
      // Auto-add the newly created product to bill items
      const qty = Number(npQuantity) || 1
      setBillItems((prev) => [
        ...prev,
        { 
          product_id: inserted.id, 
          product_name: inserted.name, 
          product_code: inserted.product_code,
          quantity: qty, 
          unit: inserted.unit, 
          buy_rate: inserted.buy_rate,
          amount: inserted.buy_rate * qty, 
          vat_pan: inserted.vat_pan 
        },
      ])
      setShowNewProduct(false)
      resetNewProductForm()
    } catch (err) {
      console.error(err)
      toast.error('Failed to create product')
    } finally {
      setSavingProduct(false)
    }
  }

  const removeProduct = (productId: string) => {
    setBillItems((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const updateItemQuantity = (productId: string, quantity: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity, amount: quantity * item.buy_rate }
          : item
      )
    )
  }

  const updateItemRate = (productId: string, buy_rate: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, buy_rate, amount: item.quantity * buy_rate }
          : item
      )
    )
  }

  // Replaced computed isManualMode with dedicated state
  // const isManualMode = !!manualTotal && manualTotal !== ''
  const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
  const dAmount = Number(discountAmount) || 0
  
  // Calculations for display/saving
  const displaySubtotal = isManualMode ? Number(manualTotal) : subtotal
  const subtotalAfterDiscount = Math.max(0, displaySubtotal - dAmount)
  const vatAmount = isManualMode ? 0 : subtotalAfterDiscount * VAT_RATE
  const totalWithVat = isManualMode ? Number(manualTotal) : (subtotalAfterDiscount + vatAmount)



  useEffect(() => {
    const p = Number(discountPercent) || 0
    if (p > 0) {
      setDiscountAmount(((subtotal * p) / 100).toFixed(2))
    }
  }, [subtotal])

  const handleDiscountPercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDiscountPercent(val)
    const p = Number(val) || 0
    setDiscountAmount(((subtotal * p) / 100).toFixed(2))
  }

  const handleDiscountAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDiscountAmount(val)
    const a = Number(val) || 0
    if (subtotal > 0) {
      setDiscountPercent(((a / subtotal) * 100).toFixed(2))
    } else {
      setDiscountPercent('0')
    }
  }



  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    if (!newSupplier.phone.trim()) {
      toast.error('Supplier phone is required')
      return
    }
    setSavingSupplier(true)
    try {
      // Fetch latest supplier code for unique generation
      const { data: latestSupplier } = await supabase
        .from('suppliers')
        .select('supplier_code')
        .order('created_at', { ascending: false })
        .limit(1)
      
      let nextCode = 'SUP-0001'
      if (latestSupplier && latestSupplier.length > 0 && latestSupplier[0].supplier_code) {
        const lastCode = latestSupplier[0].supplier_code
        if (lastCode.startsWith('SUP-')) {
          const num = parseInt(lastCode.replace('SUP-', ''), 10)
          if (!isNaN(num)) {
            nextCode = `SUP-${String(num + 1).padStart(4, '0')}`
          }
        }
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          supplier_code: nextCode,
          name: newSupplier.name.trim(),
          phone: newSupplier.phone.trim(),
          phone_country: 'NP',
          phone_national: newSupplier.phone.trim(),
          email: newSupplier.email.trim() || null,
          address: newSupplier.address.trim() || null,
          gst_pan_number: newSupplier.gst_pan.trim() || null,
          bank_details: null,
          remarks: null,
          status: 'active',
          opening_balance: Number(newSupplier.opening_balance) || 0,
          opening_balance_date_bs: newSupplier.opening_balance_date_bs,
          opening_balance_date_ad: newSupplier.opening_balance_date_ad,
          date_bs: getCurrentBsDate(),
          date_ad: getCurrentAdDate(),
          time: getCurrentTime(),
        } as any)
        .select()
        .single()

      if (error) {
        console.error('Supabase Error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw new Error(error.message || 'Database error occurred')
      }
      toast.success(`Supplier added successfully (${nextCode})`)
      setSelectedSupplierId(data.id)
      setShowNewSupplier(false)
      fetchSuppliers()
    } catch (error: any) {
      console.error('Error adding supplier:', error)
      const errorMsg = error.message || (typeof error === 'string' ? error : 'Failed to add supplier')
      toast.error(errorMsg)
    } finally {
      setSavingSupplier(false)
    }
  }

  const handleSaveBill = async () => {
    if (!selectedSupplierId) {
      toast.error('Please select a supplier')
      return
    }
    if (isManualMode && (!manualTotal || Number(manualTotal) <= 0)) {
      toast.error('Please enter a valid total amount')
      return
    }

    if (!isManualMode && billItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    setSaving(true)
    try {
      const billPayload = {
        bill_code: billCode,
        supplier_id: selectedSupplierId,
        invoice_no: invoiceNo.trim() || null,
        date_bs: formDateBs,
        date_ad: formDateAd,
        time: getCurrentTime(),
        total_amount: isManualMode ? Number(manualTotal) : subtotal,
        discount_percent: Number(discountPercent) || 0,
        discount_amount: Number(discountAmount) || 0,
        total_with_vat: totalWithVat,
        debit_amount: 0,
        credit_amount: totalWithVat,
        status: 'pending' as const,
      }

      const { data: billData, error: billError } = await supabase
        .from('supplier_bills')
        .insert(billPayload as any)
        .select()
        .single()

      if (billError) throw billError

      const billId = billData.id

      if (!isManualMode && billItems.length > 0) {
        const itemsPayload = billItems.map((item) => ({
          bill_id: billId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit: item.unit,
          buy_rate: item.buy_rate,
          amount: item.amount,
          vat_pan: item.vat_pan,
        }))

        const { error: itemsError } = await supabase
          .from('bill_items')
          .insert(itemsPayload as any)

        if (itemsError) throw itemsError

        for (const item of billItems) {
          const { error: rpcError } = await supabase.rpc('increment_product_quantity', {
            product_id: item.product_id,
            quantity_change: item.quantity,
          })
          
          if (rpcError) {
            console.warn('RPC failed, falling back to client-side update', rpcError)
            const { data: product } = await supabase
              .from('products')
              .select('quantity')
              .eq('id', item.product_id)
              .single()
            const newQty = ((product as any)?.quantity || 0) + item.quantity
            await supabase
              .from('products')
              .update({ quantity: newQty } as any)
              .eq('id', item.product_id)

            await supabase.from('stock_history').insert({
              product_id: item.product_id,
              quantity_change: item.quantity,
              quantity_after: newQty,
              type: 'in',
              reference_type: 'bill',
              reference_id: billId,
              date_bs: formDateBs,
              date_ad: formDateAd,
              time: getCurrentTime(),
            } as any)
          }
        }
      }

      toast.success('Bill saved successfully')
      router.push(`/bills/${billId}`)
    } catch (error) {
      console.error('Error saving bill:', error)
      toast.error('Failed to save bill')
    } finally {
      setSaving(false)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.product_code.toLowerCase().includes(productSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/bills">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Supplier Bill</h1>
          <p className="text-muted-foreground">Create a new bill for a supplier</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date (BS) *</Label>
                <div className="relative">
                  <NepaliDatePicker
                    inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formDateBs.replace(/\//g, '-')}
                    onChange={(val: string) => {
                      const slashedVal = val.replace(/-/g, '/')
                      setFormDateBs(slashedVal)
                      try {
                        const adDate = bsToAd(slashedVal)
                        setFormDateAd(adDate.toISOString().split('T')[0])
                      } catch {
                        // Ignore
                    }}}
                    options={{ calenderLocale: 'en', valueLocale: 'en' }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date (AD) *</Label>
                <Input type="date" value={formDateAd} onChange={handleAdDateChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bill Code</Label>
                <Input value={billCode} disabled />
              </div>
              <div className="space-y-2">
                <Label>Invoice Number (optional)</Label>
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="Supplier invoice number"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <div className="flex gap-2">
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.supplier_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewSupplier(true)}
                  title="Add new supplier"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bill Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input type="number" min="0" max="100" value={discountPercent} onChange={handleDiscountPercentChange} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Discount Amt (NPR)</Label>
                <Input type="number" min="0" value={discountAmount} onChange={handleDiscountAmountChange} placeholder="0.00" />
              </div>
            </div>
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatNPR(manualTotal ? Number(manualTotal) : subtotal)}</span>
              </div>
              {Number(discountAmount) > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount</span>
                  <span>-{formatNPR(Number(discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
                <span>{formatNPR(manualTotal ? 0 : vatAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total (Pending)</span>
                <span>{formatNPR(manualTotal ? Number(manualTotal) : totalWithVat)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Bill will be saved as <strong>Pending</strong>. Use "Payment Out" on the supplier's profile to record payments.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>Bill Items</CardTitle>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <span className={!isManualMode ? 'font-semibold' : 'text-muted-foreground'}>Itemized</span>
                <button
                  type="button"
                  onClick={() => {
                    const newMode = !isManualMode
                    setIsManualMode(newMode)
                    if (newMode && (!manualTotal || manualTotal === '0')) {
                      setManualTotal(String(totalWithVat || ''))
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isManualMode ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isManualMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={isManualMode ? 'font-semibold' : 'text-muted-foreground'}>Quick Total</span>
              </div>
              {!isManualMode && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { resetNewProductForm(); setShowNewProduct(true) }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Product
                  </Button>
                  <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search products..."
                          value={productSearch}
                          onValueChange={setProductSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No products found.</CommandEmpty>
                          <CommandGroup>
                            {filteredProducts.map((product) => (
                              <CommandItem
                                key={product.id}
                                value={`${product.name} ${product.product_code}`}
                                onSelect={() => addProduct(product)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    billItems.find((i) => i.product_id === product.id)
                                      ? 'opacity-100'
                                      : 'opacity-0'
                                  )}
                                />
                                <div className="flex-1">
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {product.product_code} &middot; {formatNPR(product.buy_rate)}
                                  </p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isManualMode ? (
            <div className="space-y-4 py-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label className="text-lg">Total Bill Amount (NPR) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={manualTotal}
                  onChange={(e) => setManualTotal(e.target.value)}
                  placeholder="Enter total amount including VAT"
                  className="text-2xl h-14 font-bold text-center"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">VAT is assumed to be included in this manual total.</p>
              </div>
            </div>
          ) : (
            <>
              {billItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg space-y-3">
                  <p className="text-muted-foreground">No items added yet.</p>
                  <Button variant="outline" size="sm" onClick={() => setProductSearchOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Select a Product
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Buy Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>VAT</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billItems.map((item) => (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="font-mono text-sm">{item.product_code}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const val = e.target.value
                                updateItemQuantity(item.product_id, val === '' ? 0 : Number(val))
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-20 text-right h-8"
                            />
                          </TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.buy_rate === 0 ? '' : item.buy_rate}
                              onChange={(e) => {
                                const val = e.target.value
                                updateItemRate(item.product_id, val === '' ? 0 : Number(val))
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-28 text-right h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNPR(item.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.vat_pan ? 'outline' : 'secondary'} className={item.vat_pan ? 'border-primary text-primary' : ''}>
                              {item.vat_pan ? 'VAT' : 'None'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => removeProduct(item.product_id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {billItems.length > 0 && (
                <div className="mt-6 flex justify-end">
                  <div className="w-80 space-y-3 p-4 bg-muted/30 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Item Subtotal</span>
                      <span className="font-medium">{formatNPR(subtotal)}</span>
                    </div>
                    {Number(discountAmount) > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Total Discount</span>
                        <span>-{formatNPR(Number(discountAmount))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT (13%)</span>
                      <span className="font-medium">{formatNPR(vatAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-3 text-primary">
                      <span>Grand Total</span>
                      <span>{formatNPR(totalWithVat)}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Link href="/bills">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSaveBill} disabled={saving} className="min-w-[150px]">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isManualMode ? 'Save Bill' : 'Save Purchase Bill'}
        </Button>
      </div>

      <Dialog open={showNewSupplier} onOpenChange={setShowNewSupplier}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>
              Quickly add a new supplier while creating a bill.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ns-name">Supplier Name *</Label>
              <Input
                id="ns-name"
                value={newSupplier.name}
                onChange={(e) =>
                  setNewSupplier((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. ABC Traders"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ns-phone">Phone *</Label>
              <Input
                id="ns-phone"
                value={newSupplier.phone}
                onChange={(e) =>
                  setNewSupplier((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="e.g. 9841234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ns-email">Email</Label>
              <Input
                id="ns-email"
                type="email"
                value={newSupplier.email}
                onChange={(e) =>
                  setNewSupplier((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="e.g. info@abc.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ns-address">Address</Label>
              <Input
                id="ns-address"
                value={newSupplier.address}
                onChange={(e) =>
                  setNewSupplier((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="e.g. Kathmandu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ns-gst">GST/PAN</Label>
              <Input
                id="ns-gst"
                value={newSupplier.gst_pan}
                onChange={(e) =>
                  setNewSupplier((prev) => ({ ...prev, gst_pan: e.target.value }))
                }
                placeholder="e.g. 123456789"
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ns-opening-balance">Opening Balance</Label>
                <Input
                  id="ns-opening-balance"
                  type="number"
                  value={newSupplier.opening_balance}
                  onChange={(e) =>
                    setNewSupplier((prev) => ({ ...prev, opening_balance: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Opening Balance Date (BS)</Label>
                  <NepaliDatePicker
                    inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newSupplier.opening_balance_date_bs.replace(/\//g, '-')}
                    onChange={handleNsBsDateChange}
                    options={{ calenderLocale: 'en', valueLocale: 'en' }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Opening Balance Date (AD)</Label>
                  <Input
                    type="date"
                    value={newSupplier.opening_balance_date_ad}
                    onChange={handleNsAdDateChange}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSupplier(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSupplier} disabled={savingSupplier}>
              {savingSupplier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Product Dialog */}
      <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Create a new product and it will be automatically added to this bill.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="np-name">Product Name *</Label>
              <Input id="np-name" value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="e.g. Copper Wire 2.5mm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-category">Category *</Label>
              <Select value={npCategoryId} onValueChange={setNpCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-unit">Unit *</Label>
              <Select value={npUnit} onValueChange={setNpUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.abbreviation} value={u.abbreviation}>
                      {u.name} ({u.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-buy-rate">Buy Rate *</Label>
              <Input id="np-buy-rate" type="number" value={npBuyRate} onChange={(e) => setNpBuyRate(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-sell-rate">Sell Rate *</Label>
              <Input id="np-sell-rate" type="number" value={npSellRate} onChange={(e) => setNpSellRate(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-qty">Initial Quantity</Label>
              <Input id="np-qty" type="number" min="0" value={npQuantity} onChange={(e) => setNpQuantity(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-brand">Brand (optional)</Label>
              <Input id="np-brand" value={npBrand} onChange={(e) => setNpBrand(e.target.value)} placeholder="e.g. Schneider" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-vat">VAT / PAN</Label>
              <Select value={npVatPan ? 'yes' : 'no'} onValueChange={(v) => setNpVatPan(v === 'yes')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes (VAT applicable)</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProduct(false)}>Cancel</Button>
            <Button onClick={handleAddNewProduct} disabled={savingProduct}>
              {savingProduct && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Add to Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function NewBillPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <NewBillContent />
    </Suspense>
  )
}
