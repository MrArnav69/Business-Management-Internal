'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { recalculateSupplierStatuses } from '@/lib/status-calculator'
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
import { Switch } from '@/components/ui/switch'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ArrowLeft, Plus, Trash2, Loader2, Check, PackageCheck, PackagePlus, UserPlus, Search, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AiScanDialog } from '@/components/ai-scan-dialog'
import type { ScannedBillData } from '@/lib/gemini'

interface BillItemRow {
  product_id: string
  product_name: string
  product_code: string
  quantity: number
  unit: string
  buy_rate: number
  discount_percent: number
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
  const [showAiScan, setShowAiScan] = useState(false)
  const [scanImageDataUrl, setScanImageDataUrl] = useState<string | null>(null)

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
  const [transportationAmount, setTransportationAmount] = useState('0')

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

  const addProduct = (product: Product, quantity: number = 1, discountPercent: number = 0) => {
    const effectiveRate = product.buy_rate * (1 - discountPercent / 100)
    setBillItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_code: product.product_code,
        quantity: quantity,
        unit: product.unit,
        buy_rate: product.buy_rate,
        discount_percent: discountPercent,
        amount: effectiveRate * quantity,
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
      // Note: Quantity is set to 0 because the bill save will increment it.
      // This prevents double-counting where product creation adds quantity
      // and bill save adds it again.
      const payload = {
        name: npName.trim(), category_id: npCategoryId, unit: npUnit,
        buy_rate: Number(npBuyRate), sell_rate: Number(npSellRate),
        brand: npBrand.trim() || null, vat_pan: npVatPan,
        status: 'active', product_code: code, quantity: 0,
      }
      const { data: inserted, error } = await supabase.from('products').insert(payload as any).select().single()
      if (error) throw error
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
          discount_percent: 0,
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

  const recalcAmount = (qty: number, rate: number, disc: number) => {
    return qty * rate * (1 - disc / 100)
  }

  const updateItemQuantity = (productId: string, quantity: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, quantity, amount: recalcAmount(quantity, item.buy_rate, item.discount_percent) }
          : item
      )
    )
  }

  const updateItemRate = (productId: string, buy_rate: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, buy_rate, amount: recalcAmount(item.quantity, buy_rate, item.discount_percent) }
          : item
      )
    )
  }

  const updateItemDiscount = (productId: string, discount_percent: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.product_id === productId
          ? { ...item, discount_percent, amount: recalcAmount(item.quantity, item.buy_rate, discount_percent) }
          : item
      )
    )
  }

  // AI Scan handler - process extracted data and pre-fill the form
  const handleScanComplete = async (data: ScannedBillData, imageDataUrl: string) => {
    setScanImageDataUrl(imageDataUrl)

    // Set invoice number
    if (data.invoice_no) setInvoiceNo(data.invoice_no)

    // Set dates
    if (data.date_bs) {
      setFormDateBs(data.date_bs)
      try {
        const adDate = bsToAd(data.date_bs)
        setFormDateAd(adDate.toISOString().split('T')[0])
      } catch {}
    } else if (data.date_ad) {
      setFormDateAd(data.date_ad)
      try {
        setFormDateBs(adToBs(data.date_ad))
      } catch {}
    }

    // Process items — match or create products
    const newBillItems: BillItemRow[] = []
    for (const scannedItem of data.items) {
      // Try to find matching product
      const matchedProduct = products.find(p => {
        const pName = p.name.toLowerCase().trim()
        const sName = scannedItem.name.toLowerCase().trim()
        return pName === sName || pName.includes(sName) || sName.includes(pName)
      })

      if (matchedProduct) {
        newBillItems.push({
          product_id: matchedProduct.id,
          product_name: matchedProduct.name,
          product_code: matchedProduct.product_code,
          quantity: scannedItem.quantity,
          unit: matchedProduct.unit,
          buy_rate: scannedItem.buy_rate,
          discount_percent: scannedItem.discount_percent || 0,
          amount: scannedItem.amount,
          vat_pan: matchedProduct.vat_pan,
        })
      } else {
        // Auto-create the product
        try {
          const catPrefix = scannedItem.category_prefix || 'HDW'
          const category = categories.find(c => (c as any).prefix === catPrefix) || categories[0]
          const prefix = (category as any)?.prefix || 'PRD'

          const { data: latest } = await supabase.from('products').select('product_code')
            .ilike('product_code', `${prefix}-%`).order('created_at', { ascending: false }).limit(1)
          let code = `${prefix}-0001`
          if (latest && latest.length > 0) {
            const num = parseInt(latest[0].product_code.replace(`${prefix}-`, ''), 10)
            if (!isNaN(num)) code = `${prefix}-${String(num + 1).padStart(4, '0')}`
          }

          const unitMatch = scannedItem.unit?.toLowerCase() || 'pcs'

          const { data: inserted, error } = await supabase.from('products').insert({
            name: scannedItem.name.trim(),
            category_id: category?.id || categories[0]?.id,
            unit: unitMatch,
            buy_rate: scannedItem.buy_rate,
            sell_rate: 0,
            brand: null,
            vat_pan: true,
            status: 'active',
            product_code: code,
            quantity: 0,
          } as any).select().single()

          if (error) {
            console.error('Failed to create product:', scannedItem.name, error)
            toast.error(`Failed to create product: ${scannedItem.name}`)
            continue
          }

          toast.success(`Product created: ${code} — ${scannedItem.name}`)

          newBillItems.push({
            product_id: inserted.id,
            product_name: inserted.name,
            product_code: inserted.product_code,
            quantity: scannedItem.quantity,
            unit: inserted.unit,
            buy_rate: scannedItem.buy_rate,
            discount_percent: scannedItem.discount_percent || 0,
            amount: scannedItem.amount,
            vat_pan: true,
          })
        } catch (err) {
          console.error('Error creating product:', err)
          toast.error(`Error creating product: ${scannedItem.name}`)
        }
      }
    }

    setBillItems(newBillItems)
    await fetchProducts() // Refresh products list

    // Set discount if bill-level
    if (data.discount_amount > 0) {
      setDiscountAmount(String(data.discount_amount))
    }

    // Set transportation if extracted
    if (data.transportation_amount > 0) {
      setTransportationAmount(String(data.transportation_amount))
    }

    setIsManualMode(false)
    toast.success(`AI extracted ${newBillItems.length} items from the bill!`)
  }

  // Replaced computed isManualMode with dedicated state
  // const isManualMode = !!manualTotal && manualTotal !== ''
  const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
  const dAmount = Number(discountAmount) || 0
  
  // Calculations for display/saving
  const displaySubtotal = isManualMode ? Number(manualTotal) : subtotal
  const subtotalAfterDiscount = Math.max(0, displaySubtotal - dAmount)
  const vatAmount = isManualMode ? 0 : subtotalAfterDiscount * VAT_RATE
  const transAmount = Number(transportationAmount) || 0
  const totalWithVat = (isManualMode ? Number(manualTotal) : (subtotalAfterDiscount + vatAmount)) + transAmount



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
      // Check for duplicate phone
      const { data: existingPhone } = await supabase
        .from('suppliers')
        .select('id')
        .eq('phone', newSupplier.phone.trim())
        .limit(1)

      if (existingPhone && existingPhone.length > 0) {
        toast.error('A supplier with this phone number already exists!')
        setSavingSupplier(false)
        return
      }

      // Check for duplicate GST/PAN if provided
      if (newSupplier.gst_pan.trim()) {
        const { data: existingPan } = await supabase
          .from('suppliers')
          .select('id')
          .eq('gst_pan_number', newSupplier.gst_pan.trim())
          .limit(1)

        if (existingPan && existingPan.length > 0) {
          toast.error('A supplier with this GST/PAN number already exists!')
          setSavingSupplier(false)
          return
        }
      }
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
        total_amount: displaySubtotal,
        discount_percent: Number(discountPercent) || 0,
        discount_amount: Number(discountAmount) || 0,
        total_with_vat: totalWithVat,
        transportation_amount: transAmount,
        debit_amount: totalWithVat,
        credit_amount: 0,
        status: 'pending' as const,
        scan_image_url: scanImageDataUrl || null,
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

      await recalculateSupplierStatuses(selectedSupplierId)

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">New Purchase Bill</h1>
          <p className="text-muted-foreground">Create a new bill from supplier</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAiScan(true)}
          className="h-11 px-5 border-violet-300 hover:bg-violet-50 hover:border-violet-400 transition-all group"
        >
          <ScanLine className="mr-2 h-4 w-4 text-violet-600 group-hover:scale-110 transition-transform" />
          <span className="bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent font-bold">AI Scan</span>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-md border-primary/10">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-lg">Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Date (BS)</Label>
                <NepaliDatePicker
                  inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all font-medium"
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
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="Optional"
                  className="font-medium"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Supplier *</Label>
              <div className="flex gap-2">
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="flex-1 font-medium">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.supplier_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setShowNewSupplier(true)} title="Add new supplier">
                  <UserPlus className="h-4 w-4 text-primary" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-primary/10">
          <CardHeader className="bg-primary/5 pb-4">
            <CardTitle className="text-lg">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Discount (%)</Label>
                <Input type="number" value={discountPercent} onChange={handleDiscountPercentChange} className="font-medium" />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Disc. Amt (NPR)</Label>
                <Input type="number" value={discountAmount} onChange={handleDiscountAmountChange} className="font-medium" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Transportation/Labour (NPR)</Label>
              <Input 
                type="number" 
                value={transportationAmount} 
                onChange={(e) => setTransportationAmount(e.target.value)} 
                className="font-medium" 
                placeholder="0" 
              />
            </div>

            <div className="rounded-xl border bg-muted/30 p-4 space-y-3 shadow-inner">
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground font-medium">Item Subtotal</span>
                <span className="font-bold text-base">{formatNPR(manualTotal ? Number(manualTotal) : subtotal)}</span>
              </div>
              {Number(discountAmount) > 0 && (
                <div className="flex justify-between text-sm items-center text-green-600 font-semibold">
                  <span>Total Discount</span>
                  <span>-{formatNPR(Number(discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground font-medium">VAT (13%)</span>
                <span className="font-bold text-base">{formatNPR(manualTotal ? 0 : vatAmount)}</span>
              </div>
              <div className="pt-2 border-t flex justify-between items-end">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Grand Total Payable</p>
                  <p className="text-3xl font-black text-primary leading-none">{formatNPR(manualTotal ? Number(manualTotal) : totalWithVat)}</p>
                </div>
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary uppercase text-[10px] px-2 py-0.5">
                  Pending Payment
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                          <CommandItem key={p.id} onSelect={() => addProduct(p)} className="p-3 cursor-pointer">
                            <div className="flex-1">
                              <p className="font-bold">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                {p.product_code} · {p.category_name} · Stock: <span className="font-bold text-primary">{p.quantity} {p.unit}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-sm text-primary">{formatNPR(p.buy_rate)}</p>
                              <p className="text-[9px] uppercase font-bold text-muted-foreground">Buy Rate</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button variant="secondary" size="sm" className="h-9 transition-all hover:scale-105" onClick={() => { resetNewProductForm(); setShowNewProduct(true) }}>
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
                <p className="text-xs text-muted-foreground">Input the total bulk purchase amount directly</p>
              </div>
              <div className="w-full px-12">
                <Label className="text-[10px] uppercase font-black text-muted-foreground mb-2 block text-center tracking-widest">Total Bulk Purchase Amount (NPR)</Label>
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
            <>
              {billItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg space-y-3">
                  <p className="text-muted-foreground">No items added yet.</p>
                  <Button variant="outline" size="sm" onClick={() => setProductSearchOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    Find Product
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold">Product Name</TableHead>
                        <TableHead className="w-[100px] font-bold">Qty</TableHead>
                        <TableHead className="w-[80px] font-bold">Unit</TableHead>
                        <TableHead className="w-[120px] text-right font-bold">Buy Rate</TableHead>
                        <TableHead className="w-[90px] text-right font-bold">Disc %</TableHead>
                        <TableHead className="w-[120px] text-right font-bold">Amount</TableHead>
                        <TableHead className="w-[80px] font-bold">VAT</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billItems.map((item) => (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
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
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={item.discount_percent === 0 ? '' : item.discount_percent}
                              onChange={(e) => {
                                const val = e.target.value
                                updateItemDiscount(item.product_id, val === '' ? 0 : Number(val))
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-20 text-right h-8"
                              placeholder="0"
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
                  <div className="w-80 space-y-3 p-4 bg-muted/30 rounded-xl border">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground font-medium">Item Subtotal</span>
                      <span className="font-bold text-base">{formatNPR(subtotal)}</span>
                    </div>
                    {Number(discountAmount) > 0 && (
                      <div className="flex justify-between text-sm items-center text-green-600 font-semibold">
                        <span>Total Discount</span>
                        <span>-{formatNPR(Number(discountAmount))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground font-medium">VAT (13%)</span>
                      <span className="font-bold text-base">{formatNPR(vatAmount)}</span>
                    </div>
                    {transAmount > 0 && (
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-muted-foreground font-medium">Transportation</span>
                        <span className="font-bold text-base">{formatNPR(transAmount)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t flex justify-between items-end">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-tighter">Grand Total</p>
                        <p className="text-2xl font-black text-primary leading-none">{formatNPR(totalWithVat)}</p>
                      </div>
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
              <Label htmlFor="np-sell-rate">Sell Rate (optional)</Label>
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

      {/* AI Scan Dialog */}
      <AiScanDialog
        open={showAiScan}
        onOpenChange={setShowAiScan}
        onScanComplete={handleScanComplete}
      />
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
