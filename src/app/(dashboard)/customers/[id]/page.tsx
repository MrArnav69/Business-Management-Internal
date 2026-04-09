'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { recalculateCustomerStatuses } from '@/lib/status-calculator'
import type { Customer, CustomerBill, CustomerPayment } from '@/types'
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
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Plus, Receipt, History, Wallet, Coins } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { deleteCustomerPayment } from '@/lib/bill-actions'
import { Trash2 } from 'lucide-react'

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bills, setBills] = useState<CustomerBill[]>([])
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')

  // Payment In Form State
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDateBs, setPaymentDateBs] = useState(getCurrentBsDate())
  const [paymentDateAd, setPaymentDateAd] = useState(getCurrentAdDate())
  const [paymentMode, setPaymentMode] = useState<'cash' | 'cheque' | 'online'>('cash')
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
        const [customerRes, billsRes, paymentsRes] = await Promise.all([
          supabase.from('customers').select('*').eq('id', id).single(),
          supabase
            .from('customer_bills')
            .select('*')
            .eq('customer_id', id)
            .order('date_ad', { ascending: false }),
          supabase
            .from('customer_payments')
            .select('*')
            .eq('customer_id', id)
            .order('date_ad', { ascending: false }),
        ])

        if (customerRes.error) throw customerRes.error
        setCustomer(customerRes.data as unknown as Customer)
        setBills(billsRes.data || [])
        setPayments(paymentsRes.data || [])
      } catch (error) {
        console.error('Error fetching customer:', error)
        toast.error('Failed to load customer details')
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

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Customer not found</p>
        <Link href="/customers">
          <Button className="mt-4">Back to Customers</Button>
        </Link>
      </div>
    )
  }

  const handleSavePayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsSavingPayment(true)
    try {
      const { error } = await supabase.from('customer_payments').insert({
        customer_id: id,
        amount: Number(paymentAmount),
        date_bs: paymentDateBs,
        date_ad: paymentDateAd,
        mode: paymentMode,
        notes: paymentNotes || null,
      } as any)

      if (error) throw error

      await recalculateCustomerStatuses(id)

      toast.success('Collection recorded successfully')
      setIsPaymentDialogOpen(false)
      setPaymentAmount('')
      setPaymentNotes('')
      window.location.reload()
    } catch (error) {
      console.error('Error saving payment:', error)
      toast.error('Failed to record collection')
    } finally {
      setIsSavingPayment(false)
    }
  }

  const totalSales = bills.reduce(
    (sum, bill) => sum + Number(bill.total_with_vat || 0),
    0
  )
  const totalCollections = payments.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  )
  const openingBalance = Number(customer.opening_balance || 0)
  const balanceReceivable = openingBalance + totalSales - totalCollections

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">{customer.customer_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsPaymentDialogOpen(true)}>
            <Coins className="mr-2 h-4 w-4 text-green-600" />
            Collect Payment
          </Button>
          <Link href={`/reports/customer-ledger?customer_id=${customer.id}`}>
            <Button variant="outline">
              <History className="mr-2 h-4 w-4 text-primary" />
              View Ledger
            </Button>
          </Link>
          <Link href={`/sales/new?customer_id=${customer.id}`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Sale
            </Button>
          </Link>
          <Badge variant={customer.status === 'active' ? 'default' : 'secondary'} className="text-sm">
            {customer.status}
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
            {customer.opening_balance_date_bs && (
              <p className="text-xs text-muted-foreground mt-1">As of {customer.opening_balance_date_bs}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-600" />
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatNPR(totalSales)}</p>
            <p className="text-xs text-muted-foreground mt-1">{bills.length} sales recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-600" />
              Total Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-green-600">{formatNPR(totalCollections)}</p>
            <p className="text-xs text-muted-foreground mt-1">{payments.length} collections recorded</p>
          </CardContent>
        </Card>
        <Card className={balanceReceivable > 0 ? 'border-primary bg-primary/5' : 'border-green-600 bg-green-50'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Receivable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${balanceReceivable > 0 ? 'text-primary' : 'text-green-700'}`}>
              {formatNPR(balanceReceivable)}
            </p>
            <p className="text-xs font-medium uppercase tracking-wider mt-1">
              {balanceReceivable > 0 ? 'Due from Customer' : 'Advance/Clear'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="history">Summary</TabsTrigger>
          <TabsTrigger value="sales">Sales ({bills.length})</TabsTrigger>
          <TabsTrigger value="payments">Collections ({payments.length})</TabsTrigger>
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
                  <span>{customer.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{customer.address || '—'}</span>
                </div>
                <div className="pt-4 border-t space-y-2">
                  {customer.gst_pan_number && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">PAN Number</p>
                      <p className="text-sm font-mono">{customer.gst_pan_number}</p>
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
                  Monitor the net balance and transaction history in the tabs.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales History</CardTitle>
            </CardHeader>
            <CardContent>
              {bills.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No sales recorded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Code</TableHead>
                      <TableHead>Date (BS)</TableHead>
                      <TableHead className="text-right">Total (inc. VAT)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-mono text-sm">
                          <Link href={`/sales/${bill.id}`} className="hover:underline font-semibold text-primary">
                            {bill.bill_code}
                          </Link>
                        </TableCell>
                        <TableCell>{bill.date_bs}</TableCell>
                        <TableCell className="text-right font-semibold">{formatNPR(bill.total_with_vat)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              bill.status === 'paid'
                                ? 'default'
                                : bill.status === 'partial'
                                ? 'secondary'
                                : 'destructive'
                            }
                            className="capitalize"
                          >
                            {bill.status}
                          </Badge>
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
              <CardTitle>Collection History</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground">No records of payments received from this customer.</p>
                  <Button variant="outline" onClick={() => setIsPaymentDialogOpen(true)}>
                    Record First Collection
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
                        <TableCell className="text-right flex justify-end gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive bg-background text-destructive hover:bg-destructive/10 transition-colors" title="Delete Collection">
                              <Trash2 className="h-4 w-4" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Collection Record?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove this collection from the customer's history and un-pay any bills covered by this amount. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={async () => {
                                    const res = await deleteCustomerPayment(p.id, id)
                                    if (res.error) toast.error(res.error)
                                    else {
                                      toast.success('Collection deleted')
                                      window.location.reload()
                                    }
                                  }}
                                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                >
                                  Delete Collection
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <span className="font-bold text-green-600">
                            {formatNPR(p.amount)}
                          </span>
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

      {/* Collection Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Record Collection (Payment In)</DialogTitle>
            <DialogDescription>
              Record a payment received from {customer.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount Received (NPR) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="text-lg font-semibold"
                autoFocus
              />
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
                  <SelectItem value="online">Online/Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Reference info, check number, online ID, etc."
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
              Record Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
