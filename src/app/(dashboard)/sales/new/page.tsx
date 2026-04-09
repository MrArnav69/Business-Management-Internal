'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { recalculateCustomerStatuses } from '@/lib/status-calculator'
import type { Customer, Product, CustomerBillItem, Category } from '@/types'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  getCurrentBsDate, 
  getCurrentAdDate, 
  getCurrentTime, 
  bsToAd, 
  adToBs, 
  formatNPR, 
  getNepaliYear 
} from '@/lib/nepali-date'
import { VAT_RATE, UNITS } from '@/lib/constants'
import { NepaliDatePicker } from 'nepali-datepicker-reactjs'
import 'nepali-datepicker-reactjs/dist/index.css'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Plus, Trash2, Search, PackageCheck, Check, UserPlus, PackagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function SalesNewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const customerIdParam = searchParams.get('customer_id')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<(Product & { category_name?: string })[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [billCode, setBillCode] = useState('Generating...')

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerIdParam || '')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [formDateBs, setFormDateBs] = useState(getCurrentBsDate())
  const [formDateAd, setFormDateAd] = useState(getCurrentAdDate())
  const [isManualMode, setIsManualMode] = useState(false)
  const [manualTotal, setManualTotal] = useState('')
  const [discountPercent, setDiscountPercent] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [transportationAmount, setTransportationAmount] = useState('0')
  const [billItems, setBillItems] = useState<(Partial<CustomerBillItem> & { product_name?: string, product_code?: string })[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productSearchOpen, setProductSearchOpen] = useState(false)

  // Dialog States
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showNewProduct, setShowNewProduct] = useState(false)
  
  // New Customer State
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    name: '', 
    phone: '', 
    email: '', 
    address: '', 
    pan: '', 
    opening_balance: '0',
    opening_balance_date_bs: getCurrentBsDate(),
    opening_balance_date_ad: getCurrentAdDate()
  })

  const handleNsBsDateChange = (val: string) => {
    const slashed = val.replace(/-/g, '/')
    setNewCustomer((prev) => ({
      ...prev,
      opening_balance_date_bs: slashed,
      opening_balance_date_ad: bsToAd(slashed).toISOString().split('T')[0],
    }))
  }

  const handleNsAdDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setNewCustomer((prev) => ({
      ...prev,
      opening_balance_date_ad: val,
      opening_balance_date_bs: adToBs(val),
    }))
  }

  // New Product State
  const [savingProduct, setSavingProduct] = useState(false)
  const [npName, setNpName] = useState('')
  const [npCategoryId, setNpCategoryId] = useState('')
  const [npUnit, setNpUnit] = useState('pcs')
  const [npBuyRate, setNpBuyRate] = useState('')
  const [npSellRate, setNpSellRate] = useState('')
  const [npQuantity, setNpQuantity] = useState('0')
  const [npBrand, setNpBrand] = useState('')
  const [npVatPan, setNpVatPan] = useState(true)

  const fetchInitialData = useCallback(async () => {
    try {
      const [customersRes, productsRes, categoriesRes, latestBillRes] = await Promise.all([
        supabase.from('customers').select('*').eq('status', 'active').order('name'),
        supabase.from('products').select('*, categories(name)').eq('status', 'active').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('customer_bills').select('bill_code').order('created_at', { ascending: false }).limit(1)
      ])

      const currentYear = getNepaliYear()
      let nextCode = `SALE${currentYear}-0001`
      
      if (latestBillRes.data && latestBillRes.data.length > 0) {
        const lastCode = latestBillRes.data[0].bill_code
        // Extract year and number
        const match = lastCode.match(/SALE(\d+)-(\d+)/)
        if (match) {
          const lastYear = parseInt(match[1])
          const lastNum = parseInt(match[2])
          
          if (lastYear === currentYear) {
            nextCode = `SALE${currentYear}-${String(lastNum + 1).padStart(4, '0')}`
          } else {
            // New year reset
            nextCode = `SALE${currentYear}-0001`
          }
        } else {
          // Fallback for old codes like SALE-0001
          const simpleMatch = lastCode.match(/SALE-(\d+)/)
          if (simpleMatch) {
            nextCode = `SALE${currentYear}-${String(parseInt(simpleMatch[1]) + 1).padStart(4, '0')}`
          }
        }
      }
      setBillCode(nextCode)

      setCustomers(customersRes.data || [])
      setProducts((productsRes.data || []).map((p: any) => ({
        ...p,
        category_name: p.categories?.name || 'Uncategorized'
      })))
      setCategories(categoriesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load form data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  const handleBsDateChange = (val: string) => {
    const slashed = val.replace(/-/g, '/')
    setFormDateBs(slashed)
    try {
      const ad = bsToAd(slashed)
      setFormDateAd(ad.toISOString().split('T')[0])
    } catch {}
  }

  const handleAdDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormDateAd(val)
    try {
      setFormDateBs(adToBs(val))
    } catch {}
  }

  const addProductToBill = (product: Product, quantity: number = 1) => {
    const existing = billItems.find((item) => item.product_id === product.id)
    if (existing) {
      toast.info(`${product.name} is already in the list`)
      setProductSearchOpen(false)
      return
    }
    
    setBillItems([
      ...billItems,
      {
        product_id: product.id,
        product_name: product.name,
        product_code: product.product_code,
        quantity: quantity,
        unit: product.unit,
        sell_rate: product.sell_rate,
        discount_percent: 0,
        amount: product.sell_rate * quantity,
        vat_pan: product.vat_pan,
      },
    ])
    setProductSearchOpen(false)
    setProductSearch('')
  }

  const updateItem = (index: number, updates: Partial<CustomerBillItem>) => {
    const newItems = [...billItems]
    newItems[index] = { ...newItems[index], ...updates }
    if (updates.quantity !== undefined || updates.sell_rate !== undefined || updates.discount_percent !== undefined) {
      const qty = newItems[index].quantity || 0
      const rate = newItems[index].sell_rate || 0
      const disc = newItems[index].discount_percent || 0
      newItems[index].amount = qty * rate * (1 - disc / 100)
    }
    setBillItems(newItems)
  }

  const removeItem = (index: number) => {
    setBillItems(billItems.filter((_, i) => i !== index))
  }

  const subtotal = billItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  const currentSubtotal = isManualMode ? Number(manualTotal) || 0 : subtotal
  const discountFromPercent = currentSubtotal * (Number(discountPercent) / 100)
  const totalDiscount = discountFromPercent + Number(discountAmount)
  const taxableAmount = currentSubtotal - totalDiscount
  const vatAmount = isManualMode ? 0 : taxableAmount * VAT_RATE
  const transportation = Number(transportationAmount) || 0
  const totalWithVat = taxableAmount + vatAmount + transportation

  const handleSaveSale = async (isEstimate: boolean = false) => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer')
      return
    }
    if (!isManualMode && billItems.length === 0) {
      toast.error('Please add at least one item or use Quick Total mode')
      return
    }

    setSaving(true)
    try {
      const salePayload = {
        bill_code: billCode,
        customer_id: selectedCustomerId,
        invoice_no: invoiceNo.trim() || null,
        date_bs: formDateBs,
        date_ad: formDateAd,
        time: getCurrentTime(),
        total_amount: currentSubtotal,
        discount_amount: totalDiscount,
        tax_amount: isEstimate ? 0 : vatAmount,
        transportation_amount: transportation,
        total_with_vat: isEstimate ? (taxableAmount + transportation) : totalWithVat,
        status: 'pending',
      }

      const { data: saleData, error: saleError } = await supabase
        .from('customer_bills')
        .insert(salePayload as any)
        .select()
        .single()

      if (saleError) throw saleError

      const saleId = saleData.id

      if (!isManualMode && billItems.length > 0) {
        const itemsPayload = billItems.map((item) => ({
          bill_id: saleId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit: item.unit,
          sell_rate: item.sell_rate,
          discount_percent: Number(item.discount_percent) || 0,
          amount: item.amount,
          vat_pan: item.vat_pan,
        }))

        const { error: itemsError } = await supabase
          .from('customer_bill_items')
          .insert(itemsPayload as any)

        if (itemsError) throw itemsError

        // Inventory Stock Decrement Logic
        for (const item of billItems) {
          const { data: product } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .single()
          
          const newQty = (Number(product?.quantity) || 0) - (Number(item.quantity) || 0)
          
          await supabase
            .from('products')
            .update({ quantity: newQty } as any)
            .eq('id', item.product_id)

          await supabase.from('stock_history').insert({
            product_id: item.product_id,
            quantity_change: -Number(item.quantity),
            quantity_after: newQty,
            type: 'out',
            reference_type: 'sale',
            reference_id: saleId,
            date_bs: formDateBs,
            date_ad: formDateAd,
            time: getCurrentTime(),
          } as any)
        }
      }

      await recalculateCustomerStatuses(selectedCustomerId)

      toast.success(isEstimate ? 'Estimate saved' : 'Sale bill saved successfully')
      router.push(`/sales/${saleId}${isEstimate ? '?print=estimate' : ''}`)
    } catch (error) {
      console.error('Error saving sale:', error)
      toast.error('Failed to save sale bill')
    } finally {
      setSaving(false)
    }
  }

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('Please enter name and phone')
      return
    }
    setSavingCustomer(true)
    try {
      // Check for duplicate phone
      if (newCustomer.phone.trim()) {
        const { data: existingPhone } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', newCustomer.phone.trim())
          .limit(1)

        if (existingPhone && existingPhone.length > 0) {
          toast.error('A customer with this phone number already exists!')
          setSavingCustomer(false)
          return
        }
      }

      // Check for duplicate PAN if provided
      if (newCustomer.pan.trim()) {
        const { data: existingPan } = await supabase
          .from('customers')
          .select('id')
          .eq('gst_pan_number', newCustomer.pan.trim())
          .limit(1)

        if (existingPan && existingPan.length > 0) {
          toast.error('A customer with this PAN number already exists!')
          setSavingCustomer(false)
          return
        }
      }
      const { data: latest } = await supabase.from('customers').select('customer_code').order('created_at', { ascending: false }).limit(1)
      let nextCode = 'CUST-0001'
      if (latest && latest.length > 0) {
        const match = latest[0].customer_code.match(/CUST-(\d+)/)
        if (match) nextCode = `CUST-${String(parseInt(match[1]) + 1).padStart(4, '0')}`
      }

      const { data, error } = await supabase.from('customers').insert({
        customer_code: nextCode,
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email || null,
        address: newCustomer.address || null,
        gst_pan_number: newCustomer.pan || null,
        opening_balance: Number(newCustomer.opening_balance),
        opening_balance_date_bs: newCustomer.opening_balance_date_bs,
        opening_balance_date_ad: newCustomer.opening_balance_date_ad,
        status: 'active',
        date_bs: getCurrentBsDate(),
        date_ad: getCurrentAdDate(),
        time: getCurrentTime(),
      } as any).select().single()

      if (error) throw error
      toast.success('Customer added')
      setSelectedCustomerId(data.id)
      setCustomers([...customers, data])
      setShowNewCustomer(false)
      setNewCustomer({ 
        name: '', 
        phone: '', 
        email: '', 
        address: '', 
        pan: '', 
        opening_balance: '0',
        opening_balance_date_bs: getCurrentBsDate(),
        opening_balance_date_ad: getCurrentAdDate()
      })
    } catch (error) {
      console.error(error)
      toast.error('Failed to add customer')
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleAddNewProduct = async () => {
    if (!npName || !npCategoryId || !npUnit || !npSellRate) {
      toast.error('Please fill all required fields (Name, Category, Unit, Sell Rate)')
      return
    }

    setSavingProduct(true)
    try {
      const category = categories.find(c => c.id === npCategoryId)
      const prefix = (category as any)?.prefix || 'PROD'
      
      const { data: latest } = await supabase.from('products').select('product_code').order('created_at', { ascending: false }).limit(1)
      let nextCode = `${prefix}-0001`
      if (latest && latest.length > 0) {
        const lastCode = latest[0].product_code
        const numPart = lastCode.split('-')[1]
        if (numPart) {
          nextCode = `${prefix}-${String(parseInt(numPart) + 1).padStart(4, '0')}`
        }
      }

      const { data, error } = await supabase.from('products').insert({
        product_code: nextCode,
        name: npName,
        category_id: npCategoryId,
        category: category?.name,
        unit: npUnit,
        buy_rate: Number(npBuyRate),
        sell_rate: Number(npSellRate),
        quantity: Number(npQuantity),
        brand: npBrand || null,
        vat_pan: npVatPan,
        status: 'active',
        date_bs: getCurrentBsDate(),
        date_ad: getCurrentAdDate(),
        time: getCurrentTime(),
      } as any).select().single()

      if (error) throw error
      
      toast.success(`Product ${nextCode} created`)
      setProducts([...products, data])
      addProductToBill(data, 0)
      setShowNewProduct(false)
      // Reset form
      setNpName('')
      setNpBuyRate('')
      setNpSellRate('')
      setNpQuantity('0')
      setNpBrand('')
    } catch (error) {
      console.error(error)
      toast.error('Failed to create product')
    } finally {
      setSavingProduct(false)
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
        <Link href="/sales">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Sale Bill</h1>
          <p className="text-muted-foreground">Create a new sale bill for customer</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Sale Info Card */}
        <Card className="shadow-md border-primary/10">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-lg">Sale Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Date (BS)</Label>
                <NepaliDatePicker
                  inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
                  value={formDateBs.replace(/\//g, '-')}
                  onChange={handleBsDateChange}
                  options={{ calenderLocale: 'en', valueLocale: 'en' }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Date (AD)</Label>
                <Input type="date" value={formDateAd} onChange={handleAdDateChange} className="font-medium" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Bill Code</Label>
                <Input value={billCode} disabled className="font-mono bg-muted font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Ref / Invoice #</Label>
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Optional" className="font-medium" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Customer *</Label>
              <div className="flex gap-2">
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="flex-1 font-medium">
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.customer_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setShowNewCustomer(true)} title="Add new customer">
                  <UserPlus className="h-4 w-4 text-primary" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary Card */}
        <Card className="shadow-md border-primary/10">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-lg">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Discount (%)</Label>
                <Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="font-medium" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Disc. Amt (NPR)</Label>
                <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="font-medium" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Transportation/Labour (NPR)</Label>
              <Input type="number" value={transportationAmount} onChange={(e) => setTransportationAmount(e.target.value)} className="font-medium" placeholder="0" />
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3 shadow-inner">
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground font-medium">Item Subtotal</span>
                <span className="font-bold text-base">{formatNPR(currentSubtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm items-center text-green-600 font-semibold">
                  <span>Total Discount</span>
                  <span>-{formatNPR(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground font-medium">VAT (13%)</span>
                <span className="font-bold text-base">{formatNPR(vatAmount)}</span>
              </div>
              {Number(transportationAmount) > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground font-medium">Transportation</span>
                  <span className="font-bold text-base">{formatNPR(Number(transportationAmount))}</span>
                </div>
              )}
              <div className="pt-2 border-t flex justify-between items-end">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Grand Total Payable</p>
                  <p className="text-3xl font-black text-primary leading-none">{formatNPR(totalWithVat)}</p>
                </div>
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary uppercase text-[10px] px-2 py-0.5">
                  Pending Collection
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bill Items Section */}
      <Card className="shadow-lg border-primary/5">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              Bill Items
            </CardTitle>
            <div className="flex items-center bg-background rounded-full border p-1 scale-90">
              <span className={cn("text-[10px] px-2 font-bold transition-all", !isManualMode ? "text-primary" : "text-muted-foreground")}>ITEMIZED</span>
              <Switch checked={isManualMode} onCheckedChange={setIsManualMode} />
              <span className={cn("text-[10px] px-2 font-bold transition-all", isManualMode ? "text-primary" : "text-muted-foreground")}>QUICK TOTAL</span>
            </div>
          </div>
          {!isManualMode && (
            <div className="flex gap-2">
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 border-primary/20 bg-background hover:bg-primary/5">
                    <Search className="mr-2 h-4 w-4 text-primary" />
                    Find Product
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Type to search products..." value={productSearch} onValueChange={setProductSearch} />
                    <CommandList>
                      <CommandEmpty>No products found.</CommandEmpty>
                      <CommandGroup heading="Available Inventory">
                        {filteredProducts.map((p) => (
                          <CommandItem key={p.id} onSelect={() => addProductToBill(p)} className="p-3 cursor-pointer">
                            <div className="flex-1">
                              <p className="font-bold">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {p.product_code} · {p.category_name} · Stock: <span className="font-bold text-primary">{p.quantity} {p.unit}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-sm text-primary">{formatNPR(p.sell_rate)}</p>
                              <p className="text-[9px] uppercase font-bold text-muted-foreground">Retail Rate</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button variant="secondary" size="sm" className="h-9 transition-all hover:scale-105" onClick={() => setShowNewProduct(true)}>
                <PackagePlus className="mr-2 h-4 w-4" />
                New Product
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {isManualMode ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 max-w-lg mx-auto bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20">
              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-primary uppercase italic">Quick Entry Mode</h3>
                <p className="text-xs text-muted-foreground">Input the total bulk sale amount directly</p>
              </div>
              <div className="w-full px-12">
                <Label className="text-[10px] uppercase font-black text-muted-foreground mb-2 block text-center tracking-widest">Total Bulk Sale Amount (NPR)</Label>
                <Input
                  type="number"
                  value={manualTotal}
                  onChange={(e) => setManualTotal(e.target.value)}
                  className="text-4xl h-20 font-black text-center border-2 border-primary/30 focus-visible:ring-primary shadow-xl rounded-xl"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Product Name</TableHead>
                    <TableHead className="w-[100px] font-bold">Qty</TableHead>
                    <TableHead className="w-[80px] font-bold">Unit</TableHead>
                    <TableHead className="w-[120px] font-bold">Sell Rate</TableHead>
                    <TableHead className="w-[90px] text-right font-bold">Disc %</TableHead>
                    <TableHead className="text-right w-[140px] font-bold">Amount</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                        <PackagePlus className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        No items added. Use the "Find Product" button to start building the bill.
                      </TableCell>
                    </TableRow>
                  ) : (
                    billItems.map((item, index) => (
                      <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <p className="font-bold text-sm">{item.product_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{item.product_code}</p>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => updateItem(index, { quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                            className="h-9 text-right font-medium focus:ring-primary"
                            onFocus={(e) => e.target.select()}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium text-muted-foreground">{item.unit}</TableCell>
                        <TableCell>
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-[10px] text-muted-foreground">Rs.</span>
                            <Input
                              type="number"
                              value={item.sell_rate === 0 ? '' : item.sell_rate}
                              onChange={(e) => updateItem(index, { sell_rate: e.target.value === '' ? 0 : Number(e.target.value) })}
                              className="h-9 pl-7 text-right font-medium focus:ring-primary"
                              onFocus={(e) => e.target.select()}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={item.discount_percent === 0 ? '' : item.discount_percent}
                            onChange={(e) => updateItem(index, { discount_percent: e.target.value === '' ? 0 : Number(e.target.value) })}
                            className="h-9 text-right font-medium focus:ring-primary"
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                          />
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-900">{formatNPR(item.amount || 0)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Action Bar */}
      <div className="flex justify-end items-center gap-4 pt-4 border-t sticky bottom-6 z-10 bg-background/80 backdrop-blur-md py-4">
        <Link href="/sales">
          <Button variant="outline" className="px-8 h-11">Cancel</Button>
        </Link>
        <Button onClick={() => handleSaveSale(true)} disabled={saving} variant="outline" size="lg" className="h-12 px-8 font-bold border-violet-300 text-violet-700 hover:bg-violet-50 transition-all hover:scale-105 active:scale-95">
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          Save & Print Estimate
        </Button>
        <Button onClick={() => handleSaveSale(false)} disabled={saving} size="lg" className="px-16 h-12 text-lg font-black shadow-xl ring-2 ring-primary/20 ring-offset-2 transition-all hover:scale-105 active:scale-95">
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackageCheck className="mr-2 h-5 w-5" />}
          {isManualMode ? 'POST MANUAL BILL' : 'POST BILL'}
        </Button>
      </div>

      {/* Add New Customer Dialog */}
      <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Quick Register Customer</DialogTitle>
            <DialogDescription>Add a new customer without exiting the billing screen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Full Name *</Label>
              <Input value={newCustomer.name} onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="Customer / Firm Name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Phone *</Label>
                <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} placeholder="Mobile Number" />
              </div>
              <div className="grid gap-2">
                <Label>PAN (Optional)</Label>
                <Input value={newCustomer.pan} onChange={(e) => setNewCustomer({...newCustomer, pan: e.target.value})} placeholder="Vat/Pan Number" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Input value={newCustomer.address} onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})} placeholder="City, Area" />
            </div>
            <div className="grid gap-2">
              <Label>Opening Balance</Label>
              <Input type="number" value={newCustomer.opening_balance} onChange={(e) => setNewCustomer({...newCustomer, opening_balance: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Balance Date (BS)</Label>
                <NepaliDatePicker
                  inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
                  value={newCustomer.opening_balance_date_bs.replace(/\//g, '-')}
                  onChange={handleNsBsDateChange}
                  options={{ calenderLocale: 'en', valueLocale: 'en' }}
                />
              </div>
              <div className="space-y-2">
                <Label>Balance Date (AD)</Label>
                <Input
                  type="date"
                  value={newCustomer.opening_balance_date_ad}
                  onChange={handleNsAdDateChange}
                  className="font-medium"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCustomer(false)}>Cancel</Button>
            <Button onClick={handleAddNewCustomer} disabled={savingCustomer}>
              {savingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create & Select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Product Dialog */}
      <Dialog open={showNewProduct} onOpenChange={setShowNewProduct}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Create a new product and it will be added to this sale bill.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label>Product Name *</Label>
              <Input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="e.g. Copper Wire 2.5mm" />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={npCategoryId} onValueChange={setNpCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select value={npUnit} onValueChange={setNpUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.abbreviation} value={u.abbreviation}>{u.name} ({u.abbreviation})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4 col-span-2">
              <div className="grid gap-2">
                <Label>Buy Rate (Optional)</Label>
                <Input type="number" value={npBuyRate} onChange={(e) => setNpBuyRate(e.target.value)} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <Label>Sell Rate *</Label>
                <Input type="number" value={npSellRate} onChange={(e) => setNpSellRate(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Initial Quantity</Label>
              <Input type="number" value={npQuantity} onChange={(e) => setNpQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Brand (optional)</Label>
              <Input value={npBrand} onChange={(e) => setNpBrand(e.target.value)} placeholder="e.g. Schneider" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>VAT / PAN Setting</Label>
              <Select value={npVatPan ? 'yes' : 'no'} onValueChange={(v) => setNpVatPan(v === 'yes')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes (VAT applicable)</SelectItem>
                  <SelectItem value="no">No VAT (Local/Zero)</SelectItem>
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

export default function NewSalePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <SalesNewContent />
    </Suspense>
  )
}
