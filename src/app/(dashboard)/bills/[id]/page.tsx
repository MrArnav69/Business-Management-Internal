'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { deleteSupplierBill } from '@/lib/bill-actions'
import type { SupplierBill, BillItem } from '@/types'
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
import { formatNPR } from '@/lib/nepali-date'
import { VAT_RATE } from '@/lib/constants'
import { ArrowLeft, Loader2, Printer, Trash2, Edit } from 'lucide-react'
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

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [bill, setBill] = useState<SupplierBill | null>(null)
  const [items, setItems] = useState<(BillItem & { product_name?: string; product_code?: string })[]>([])
  const [supplier, setSupplier] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountAmount, setDiscountAmount] = useState('')
  const [transportationAmount, setTransportationAmount] = useState('0')


  

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
        const [billRes, itemsRes] = await Promise.all([
          supabase.from('supplier_bills').select('*, suppliers(*)').eq('id', id).single(),
          supabase.from('bill_items').select('*, products(name, product_code)').eq('bill_id', id),
        ])

        if (billRes.error) throw billRes.error
        const billData = billRes.data as any
        setBill(billData as unknown as SupplierBill)
        setSupplier(billData?.suppliers || null)
        setItems(
          (itemsRes.data || []).map((item) => ({
            ...item,
            product_name: item.products?.name || '—',
            product_code: item.products?.product_code || '—',
          }))
        )
        setDiscountAmount(billData.discount_amount?.toString() || '0')
        setTransportationAmount(billData.transportation_amount?.toString() || '0')
      } catch (error) {
        console.error('Error fetching bill:', error)
        toast.error('Failed to load bill details')
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

  if (!bill) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Bill not found</p>
        <Link href="/bills">
          <Button className="mt-4">Back to Bills</Button>
        </Link>
      </div>
    )
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await deleteSupplierBill(bill.id, bill.supplier_id)
      if (res.error) throw new Error(res.error)
      toast.success('Bill deleted successfully')
      router.push('/bills')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete bill')
      setIsDeleting(false)
    }
  }

  const subtotal = Number(bill.total_amount)
  const vatAmount = subtotal * VAT_RATE
  const totalWithVat = Number(bill.total_with_vat) || subtotal + vatAmount

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bills">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{bill.bill_code}</h1>
            <p className="text-muted-foreground">
              {bill.date_bs} {bill.invoice_no ? `&middot; Invoice: ${bill.invoice_no}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              bill.status === 'paid'
                ? 'default'
                : bill.status === 'partial'
                ? 'secondary'
                : 'destructive'
            }
            className="text-sm"
          >
            {bill.status}
          </Badge>
          {bill.scan_image_url && (
            <Badge variant="outline" className="border-violet-300 text-violet-700 bg-violet-50 gap-1 text-sm items-center">
              <span>🤖</span> AI Scanned
            </Badge>
          )}
          <Link href={`/bills/${bill.id}/edit`}>
            <Button variant="outline" size="icon" title="Edit Bill">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-destructive bg-background text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50" disabled={isDeleting} title="Delete Bill">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will completely delete this bill and revert the quantities of all stock received from your inventory. It will also alter the supplier's outstanding balances permanently.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  Delete Bill
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold">{supplier?.name || '—'}</p>
            <p className="text-muted-foreground text-sm">{supplier?.supplier_code}</p>
            {supplier?.phone && <p className="text-sm">{supplier.phone}</p>}
            {supplier?.address && <p className="text-sm text-muted-foreground">{supplier.address}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatNPR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
              <span>{formatNPR(vatAmount)}</span>
            </div>
            {(bill.transportation_amount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transportation / Labour</span>
                <span>{formatNPR(bill.transportation_amount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2 text-primary">
              <span className="uppercase text-xs tracking-wider">Grand Total</span>
              <span className="text-lg">{formatNPR(totalWithVat)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bill Items</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No items</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{item.product_code}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{formatNPR(item.buy_rate)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNPR(item.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={item.vat_pan ? 'default' : 'secondary'}>
                        {item.vat_pan ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bill.scan_image_url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📷</span> Original Scanned Bill
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl overflow-hidden border bg-muted/30 p-2">
              <img 
                src={bill.scan_image_url} 
                alt={`Scanned Bill ${bill.bill_code}`} 
                className="w-full max-w-4xl mx-auto h-auto object-contain rounded-lg shadow-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
