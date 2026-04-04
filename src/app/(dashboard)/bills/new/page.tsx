'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Supplier, Product, Category } from '@/types'
import { VAT_RATE } from '@/lib/constants'
import { getCurrentBsDate, getCurrentAdDate, getCurrentTime, formatNPR } from '@/lib/nepali-date'
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
}

export default function NewBillPage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<(Product & { category_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [billCode] = useState(() => {
    const num = Math.floor(Math.random() * 9000) + 1000
    return `BILL-${num}`
  })

  const [billItems, setBillItems] = useState<BillItemRow[]>([])
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState<NewSupplierForm>({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst_pan: '',
  })
  const [savingSupplier, setSavingSupplier] = useState(false)

  const [debitAmount, setDebitAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')


  

  const fetchSuppliers = useCallback(async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true })
    if (!error) setSuppliers((data as any[]) || [])
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
    Promise.all([fetchSuppliers(), fetchProducts()]).finally(() => setLoading(false))
  }, [fetchSuppliers, fetchProducts])

  const addProduct = (product: Product) => {
    if (billItems.find((item) => item.product_id === product.id)) {
      toast.error('Product already added')
      return
    }
    setBillItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_code: product.product_code,
        quantity: 1,
        unit: product.unit,
        buy_rate: product.buy_rate,
        amount: product.buy_rate,
        vat_pan: product.vat_pan,
      },
    ])
    setProductSearchOpen(false)
    setProductSearch('')
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

  const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0)
  const vatAmount = subtotal * VAT_RATE
  const totalWithVat = subtotal + vatAmount
  const debit = Number(debitAmount) || 0
  const credit = Number(creditAmount) || totalWithVat

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setSavingSupplier(true)
    try {
      const count = suppliers.length + 1
      const supplierCode = `SUP-${String(count).padStart(4, '0')}`
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          supplier_code: supplierCode,
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
          date_bs: getCurrentBsDate(),
          date_ad: getCurrentAdDate(),
          time: getCurrentTime(),
        } as any)
        .select()
        .single()

      if (error) throw error
      toast.success('Supplier added successfully')
      setSelectedSupplierId(data.id)
      setShowNewSupplier(false)
      fetchSuppliers()
    } catch (error) {
      console.error('Error adding supplier:', error)
      toast.error('Failed to add supplier')
    } finally {
      setSavingSupplier(false)
    }
  }

  const handleSaveBill = async () => {
    if (!selectedSupplierId) {
      toast.error('Please select a supplier')
      return
    }
    if (billItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }
    setSaving(true)
    try {
      const billPayload = {
        bill_code: billCode,
        supplier_id: selectedSupplierId,
        invoice_no: invoiceNo.trim() || null,
        date_bs: getCurrentBsDate(),
        date_ad: getCurrentAdDate(),
        time: getCurrentTime(),
        total_amount: subtotal,
        total_with_vat: totalWithVat,
        debit_amount: debit,
        credit_amount: credit,
        status: credit >= totalWithVat ? ('paid' as const) : debit > 0 ? ('partial' as const) : ('pending' as const),
      }

      const { data: billData, error: billError } = await supabase
        .from('supplier_bills')
        .insert(billPayload as any)
        .select()
        .single()

      if (billError) throw billError

      const billId = billData.id

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
        try {
          await supabase.rpc('increment_product_quantity', {
            product_id: item.product_id,
            quantity_change: item.quantity,
          })
        } catch {
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
            date_bs: getCurrentBsDate(),
            date_ad: getCurrentAdDate(),
          } as any)
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
            <div className="space-y-2">
              <Label>Bill Code</Label>
              <Input value={billCode} disabled />
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
            <div className="space-y-2">
              <Label>Invoice Number (optional)</Label>
              <Input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Supplier invoice number"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Debit Amount (NPR)</Label>
              <Input
                type="number"
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Credit Amount (NPR)</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder={formatNPR(totalWithVat)}
              />
            </div>
            <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatNPR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
                <span>{formatNPR(vatAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total with VAT</span>
                <span>{formatNPR(totalWithVat)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bill Items</CardTitle>
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
        </CardHeader>
        <CardContent>
          {billItems.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No items added yet. Click &quot;Add Product&quot; to start.
            </p>
          ) : (
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
                  <TableHead className="text-right"></TableHead>
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
                        value={item.quantity}
                        onChange={(e) =>
                          updateItemQuantity(item.product_id, Number(e.target.value) || 0)
                        }
                        className="w-20 text-right"
                      />
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.buy_rate}
                        onChange={(e) =>
                          updateItemRate(item.product_id, Number(e.target.value) || 0)
                        }
                        className="w-28 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNPR(item.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.vat_pan ? 'default' : 'secondary'}>
                        {item.vat_pan ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeProduct(item.product_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {billItems.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatNPR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
                  <span>{formatNPR(vatAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatNPR(totalWithVat)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/bills">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSaveBill} disabled={saving || billItems.length === 0}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Bill
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
              <Label htmlFor="ns-phone">Phone</Label>
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
    </div>
  )
}
