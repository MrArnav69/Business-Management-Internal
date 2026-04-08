'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Supplier, SupplierBill } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatNPR } from '@/lib/nepali-date'
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Plus, Receipt, History, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { NepaliDatePicker } from 'nepali-datepicker-reactjs'
import 'nepali-datepicker-reactjs/dist/index.css'
import { getCurrentBsDate, getCurrentAdDate, bsToAd, adToBs } from '@/lib/nepali-date'
import type { SupplierPayment } from '@/types'

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [bills, setBills] = useState<SupplierBill[]>([])
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [productsSupplied, setProductsSupplied] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')

  // Payment Out Form State
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDateBs, setPaymentDateBs] = useState(getCurrentBsDate())
  const [paymentDateAd, setPaymentDateAd] = useState(getCurrentAdDate())
  const [paymentMode, setPaymentMode] = useState<'cash' | 'cheque'>('cash')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [isSavingPayment, setIsSavingPayment] = useState(false)

  const handlePaymentBsChange = (val: string) => {
    const slash = val.replace(/-/g, '/')
    setPaymentDateBs(slash)
    try {
      setPaymentDateAd(bsToAd(slash).toISOString().split('T')[0])
    } catch {}
  }

  const handlePaymentAdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setPaymentDateAd(val)
    try {
      setPaymentDateBs(adToBs(val))
    } catch {}
  }


  

  useEffect(() => {
    const unwrap = async () => {
      const p = await params
      setId(p.id)
    }
    unwrap()
  }, [params])

  useEffect(() => {
    if (!id) return
    async function fetchData() {
      try {
        const [supplierRes, billsRes, paymentsRes, productsRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('id', id).single(),
          supabase
            .from('supplier_bills')
            .select('*')
            .eq('supplier_id', id)
            .order('date_ad', { ascending: false }),
          supabase
            .from('supplier_payments')
            .select('*')
            .eq('supplier_id', id)
            .order('date_ad', { ascending: false }),
          supabase
            .from('products')
            .select('*')
            .eq('status', 'active')
            .order('name', { ascending: true }),
        ])

        if (supplierRes.error) throw supplierRes.error
        setSupplier(supplierRes.data as unknown as Supplier)
        setBills(billsRes.data || [])
        setPayments(paymentsRes.data || [])
        setProductsSupplied(productsRes.data || [])
      } catch (error) {
        console.error('Error fetching supplier:', error)
        toast.error('Failed to load supplier details')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Supplier not found</p>
        <Link href="/suppliers">
          <Button className="mt-4">Back to Suppliers</Button>
        </Link>
      </div>
    )
  }

  const handleSavePayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const amount = Number(paymentAmount)
    if (amount > balanceOwed) {
      toast.error(`Amount cannot exceed balance owed (${formatNPR(balanceOwed)})`)
      return
    }

    setIsSavingPayment(true)
    try {
      const { error } = await supabase.from('supplier_payments').insert({
        supplier_id: id,
        amount: Number(paymentAmount),
        date_bs: paymentDateBs,
        date_ad: paymentDateAd,
        mode: paymentMode,
        notes: paymentNotes || null,
      } as any)

      if (error) throw error

      toast.success('Payment recorded successfully')
      setIsPaymentDialogOpen(false)
      setPaymentAmount('')
      setPaymentNotes('')
      // Refresh data (could be more optimized but this is safe)
      window.location.reload()
    } catch (error) {
      console.error('Error saving payment:', error)
      toast.error('Failed to record payment')
    } finally {
      setIsSavingPayment(false)
    }
  }

  const totalPurchases = bills.reduce(
    (sum, bill) => sum + Number(bill.total_with_vat || 0),
    0
  )
  const totalPayments = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  )
  const openingBalance = Number(supplier.opening_balance || 0)
  const balanceOwed = openingBalance + totalPurchases - totalPayments

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">{supplier.supplier_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsPaymentDialogOpen(true)}>
            <Wallet className="mr-2 h-4 w-4 text-green-600" />
            Payment Out
          </Button>
          <Link href={`/reports/supplier-ledger?supplier_id=${supplier.id}`}>
            <Button variant="outline">
              <History className="mr-2 h-4 w-4 text-primary" />
              View Ledger
            </Button>
          </Link>
          <Link href={`/bills/new?supplier_id=${supplier.id}`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Bill
            </Button>
          </Link>
          <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'} className="text-sm">
            {supplier.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Opening Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatNPR(openingBalance)}</p>
            {supplier.opening_balance_date_bs && (
              <p className="text-xs text-muted-foreground mt-1">As of {supplier.opening_balance_date_bs}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-600" />
              Total Purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatNPR(totalPurchases)}</p>
            <p className="text-xs text-muted-foreground mt-1">{bills.length} bills recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-600" />
              Total Paid Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatNPR(totalPayments)}</p>
            <p className="text-xs text-muted-foreground mt-1">{payments.length} payments made</p>
          </CardContent>
        </Card>
        <Card className={balanceOwed > 0 ? 'border-destructive bg-destructive/5' : 'border-green-600 bg-green-50'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Balance Owed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${balanceOwed > 0 ? 'text-destructive' : 'text-green-700'}`}>
              {formatNPR(balanceOwed)}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider mt-1">
              {balanceOwed > 0 ? 'Payable' : 'Advanced/Clear'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="history">Summary</TabsTrigger>
          <TabsTrigger value="purchases">Bills ({bills.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="history" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{supplier.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{supplier.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{supplier.address || '—'}</span>
                </div>
                <div className="pt-4 border-t space-y-2">
                  {supplier.gst_pan_number && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">GST/PAN</p>
                      <p className="text-sm font-mono">{supplier.gst_pan_number}</p>
                    </div>
                  )}
                  {supplier.bank_details && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Bank Details</p>
                      <p className="text-sm">{supplier.bank_details}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Detailed ledger and automated reconciliation coming soon. Use the tabs to see full history.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Bills</CardTitle>
            </CardHeader>
            <CardContent>
              {bills.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No bills recorded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Code</TableHead>
                      <TableHead>Date (BS)</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead className="text-right">Total (inc. VAT)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-mono text-sm">
                          <Link href={`/bills/${bill.id}`} className="hover:underline font-semibold text-primary">
                            {bill.bill_code}
                          </Link>
                        </TableCell>
                        <TableCell>{bill.date_bs}</TableCell>
                        <TableCell>{bill.invoice_no || '—'}</TableCell>
                        <TableCell className="text-right font-semibold">{formatNPR(bill.total_with_vat)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Pending</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Out History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground">No records of payments out to this supplier.</p>
                  <Button variant="outline" onClick={() => setIsPaymentDialogOpen(true)}>
                    Record First Payment
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date (BS)</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.date_bs}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{p.mode}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground italic">
                          {p.notes || '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatNPR(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Out Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Payment Out</DialogTitle>
            <DialogDescription>
              Record a cash or cheque payment made to {supplier.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="amount">Amount (NPR) *</Label>
                <span className="text-sm text-muted-foreground">
                  Max: {formatNPR(balanceOwed)}
                </span>
              </div>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="text-lg font-semibold"
                autoFocus
              />
              {Number(paymentAmount) > balanceOwed && (
                <p className="text-sm text-destructive">Amount exceeds balance owed</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date (BS) *</Label>
                <NepaliDatePicker
                  inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={paymentDateBs.replace(/\//g, '-')}
                  onChange={handlePaymentBsChange}
                  options={{ calenderLocale: 'en', valueLocale: 'en' }}
                />
              </div>
              <div className="grid gap-2">
                <Label>Date (AD) *</Label>
                <Input
                  type="date"
                  value={paymentDateAd}
                  onChange={handlePaymentAdChange}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mode">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)}>
                <SelectTrigger id="mode">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Check number, reference info, etc."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePayment} disabled={isSavingPayment}>
              {isSavingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
