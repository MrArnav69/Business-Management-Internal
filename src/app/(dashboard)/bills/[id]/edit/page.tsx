'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { recalculateSupplierStatuses } from '@/lib/status-calculator'
import { revertSupplierBillStock } from '@/lib/bill-actions'
import type { Supplier, Product, Category } from '@/types'
import { VAT_RATE } from '@/lib/constants'
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
import { ArrowLeft, Loader2, PackageCheck, Search } from 'lucide-react'
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

export default function EditSupplierBillPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<(Product & { category_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [editBillId, setEditBillId] = useState('')

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [billCode, setBillCode] = useState('Loading...')
  
  const [billItems, setBillItems] = useState<BillItemRow[]>([])
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [isManualMode, setIsManualMode] = useState(false)

  const [formDateBs, setFormDateBs] = useState(getCurrentBsDate())
  const [formDateAd, setFormDateAd] = useState(getCurrentAdDate())
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [transportationAmount, setTransportationAmount] = useState('')

  useEffect(() => {
    const unwrap = async () => {
      const p = await params
      setEditBillId(p.id)
    }
    unwrap()
  }, [params])

  const fetchSuppliers = useCallback(async () => {
    const { data } = await supabase.from('suppliers').select('*').eq('status', 'active').order('name', { ascending: true })
    if (data) setSuppliers(data as any[])
  }, [])

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*, categories(name)').eq('status', 'active').order('name', { ascending: true })
    if (data) {
      setProducts((data as any[]).map((p: any) => ({ ...p, category_name: p.categories?.name || '—' })))
    }
  }, [])

  useEffect(() => {
    if (!editBillId) return
    Promise.all([fetchSuppliers(), fetchProducts()]).then(async () => {
      try {
        const { data: billRes, error } = await supabase.from('supplier_bills').select('*').eq('id', editBillId).single()
        if (error) throw error
        
        const bill = billRes as any
        setBillCode(bill.bill_code)
        setSelectedSupplierId(bill.supplier_id)
        setInvoiceNo(bill.invoice_no || '')
        setFormDateBs(bill.date_bs)
        setFormDateAd(bill.date_ad)
        
        const { data: itemsRes } = await supabase.from('bill_items').select('*, products(name, product_code)').eq('bill_id', editBillId)
        
        if (itemsRes && itemsRes.length > 0) {
          setIsManualMode(false)
          setBillItems(itemsRes.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.products?.name || 'Unknown',
            product_code: item.products?.product_code || '',
            quantity: item.quantity,
            unit: item.unit,
            buy_rate: item.buy_rate,
            amount: item.amount,
            vat_pan: item.vat_pan
          })))
          setDiscountAmount(String(bill.discount_amount || 0))
          setDiscountPercent(String(bill.discount_percent || 0))
          setTransportationAmount(String(bill.transportation_amount || 0))
        } else {
          setIsManualMode(true)
          setManualTotal(String(bill.total_amount))
        }
      } catch (err) {
        console.error(err)
        toast.error('Failed to load bill for editing')
        router.push('/bills')
      } finally {
        setLoading(false)
      }
    })
  }, [editBillId, fetchSuppliers, fetchProducts, router])

  const handleDiscountPercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDiscountPercent(val)
    const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
    setDiscountAmount(((Number(val) / 100) * subtotal).toFixed(2))
  }

  const handleDiscountAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setDiscountAmount(val)
    const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
    setDiscountPercent(((Number(val) / subtotal) * 100).toFixed(2))
  }

  const handleUpdateBill = async () => {
    if (!selectedSupplierId) return toast.error('select a supplier')
    if (isManualMode && (!manualTotal || Number(manualTotal) <= 0)) return toast.error('enter valid amount')
    if (!isManualMode && billItems.length === 0) return toast.error('add at least one item')

    setSaving(true)
    try {
      // 1. Revert Old Items 
      await revertSupplierBillStock(editBillId)
      
      const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
      const dAmount = Number(discountAmount) || 0
      const transAmount = Number(transportationAmount) || 0
      const subtotalAfterDiscount = Math.max(0, subtotal - dAmount)
      const vatAmount = isManualMode ? 0 : subtotalAfterDiscount * VAT_RATE
      const totalWithVat = isManualMode ? Number(manualTotal) : (subtotalAfterDiscount + vatAmount + transAmount)

      // 2. Update core bill
      const billPayload = {
        supplier_id: selectedSupplierId,
        invoice_no: invoiceNo.trim() || null,
        date_bs: formDateBs,
        date_ad: formDateAd,
        total_amount: isManualMode ? Number(manualTotal) : subtotal,
        discount_percent: Number(discountPercent) || 0,
        discount_amount: dAmount,
        transportation_amount: transAmount,
        total_with_vat: totalWithVat,
        credit_amount: totalWithVat,
      }
      const { error: billError } = await supabase.from('supplier_bills').update(billPayload as any).eq('id', editBillId)
      if (billError) throw billError

      // 3. Insert fresh items 
      if (!isManualMode && billItems.length > 0) {
        const itemsPayload = billItems.map((item) => ({
          bill_id: editBillId, product_id: item.product_id, quantity: item.quantity,
          unit: item.unit, buy_rate: item.buy_rate, amount: item.amount, vat_pan: item.vat_pan,
        }))
        await supabase.from('bill_items').insert(itemsPayload as any)

        // 4. Update new stock
        for (const item of billItems) {
          const { data: product } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
          const newQty = ((product as any)?.quantity || 0) + item.quantity
          await supabase.from('products').update({ quantity: newQty } as any).eq('id', item.product_id)
          await supabase.from('stock_history').insert({
            product_id: item.product_id, quantity_change: item.quantity, quantity_after: newQty,
            type: 'in', reference_type: 'bill', reference_id: editBillId,
            date_bs: formDateBs, date_ad: formDateAd, time: getCurrentTime(),
          } as any)
        }
      }

      await recalculateSupplierStatuses(selectedSupplierId)
      toast.success('Bill successfully updated!')
      router.push(`/bills/${editBillId}`)
    } catch (err: any) {
      toast.error('Failed to update bill: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>

  // Render variables
  const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
  const dAmount = Number(discountAmount) || 0
  const transAmount = Number(transportationAmount) || 0
  const subtotalAfterDiscount = Math.max(0, subtotal - dAmount)
  const vatAmount = isManualMode ? 0 : subtotalAfterDiscount * VAT_RATE
  const totalWithVat = isManualMode ? Number(manualTotal) : (subtotalAfterDiscount + vatAmount + transAmount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/bills/${editBillId}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Purchase Bill</h1>
            <p className="text-muted-foreground">{billCode}</p>
          </div>
        </div>
        <Button onClick={handleUpdateBill} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Changes
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-md border-primary/10">
          <CardHeader className="bg-primary/5 pb-4"><CardTitle className="text-lg">Bill Details</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date (BS)</Label>
                <Input value={formDateBs} onChange={(e) => setFormDateBs(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Invoice No</Label>
                <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
              </div>
            </div>
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
          </CardContent>
        </Card>
        
        <Card className="shadow-md border-primary/10">
          <CardHeader className="bg-primary/5 pb-4"><CardTitle className="text-lg">Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-6">
             <div className="rounded-xl border bg-muted/30 p-4 space-y-3 shadow-inner">
              <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground font-medium">Item Subtotal</span><span className="font-bold text-base">{formatNPR(manualTotal ? Number(manualTotal) : subtotal)}</span></div>
              <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground font-medium">VAT (13%)</span><span className="font-bold text-base">{formatNPR(manualTotal ? 0 : vatAmount)}</span></div>
              <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground font-medium">Transportation</span><span className="font-bold text-base">{formatNPR(transAmount)}</span></div>
              <div className="pt-2 border-t flex justify-between items-end">
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Grand Total</p>
                  <p className="text-3xl font-black text-primary">{formatNPR(manualTotal ? Number(manualTotal) : totalWithVat)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-primary/5">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-4">
            <CardTitle className="text-lg flex items-center gap-2">Bill Items</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs">Itemized</span><Switch checked={isManualMode} onCheckedChange={setIsManualMode} /><span className="text-xs">Quick Total</span>
            </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isManualMode ? (
            <div className="w-full max-w-sm mx-auto">
              <Label>Total Bulk Amount</Label>
              <Input type="number" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} className="text-2xl h-14" />
            </div>
          ) : (
             <div className="space-y-4">
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline"><Search className="mr-2 h-4 w-4" /> Add Product</Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search..." value={productSearch} onValueChange={setProductSearch} />
                    <CommandList>
                      {products.filter(p => (p.name+p.product_code).toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <CommandItem key={p.id} onSelect={() => {
                          setBillItems(prev => [...prev, { product_id: p.id, product_name: p.name, product_code: p.product_code, quantity: 1, unit: p.unit, buy_rate: p.buy_rate, amount: p.buy_rate, vat_pan: p.vat_pan }])
                          setProductSearchOpen(false)
                        }}>{p.name}</CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {billItems.map(item => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell><Input type="number" value={item.quantity} onChange={(e) => {
                        const qty = Number(e.target.value) || 0
                        setBillItems(prev => prev.map(i => i.product_id === item.product_id ? {...i, quantity: qty, amount: qty * i.buy_rate} : i))
                      }} className="w-20" /></TableCell>
                      <TableCell>{item.buy_rate}</TableCell>
                      <TableCell>{item.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
