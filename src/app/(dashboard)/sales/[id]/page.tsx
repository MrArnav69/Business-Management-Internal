'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { CustomerBill, CustomerBillItem } from '@/types'
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
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'

export default function SaleBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [bill, setBill] = useState<CustomerBill | null>(null)
  const [items, setItems] = useState<(CustomerBillItem & { product_name?: string; product_code?: string })[]>([])
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState('')

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
          supabase.from('customer_bills').select('*, customers(*)').eq('id', id).single(),
          supabase.from('customer_bill_items').select('*, products(name, product_code)').eq('bill_id', id),
        ])

        if (billRes.error) throw billRes.error
        const billData = billRes.data as any
        setBill(billData as unknown as CustomerBill)
        setCustomer(billData?.customers || null)
        setItems(
          (itemsRes.data || []).map((item) => ({
            ...item,
            product_name: item.products?.name || '—',
            product_code: item.products?.product_code || '—',
          }))
        )
      } catch (error) {
        console.error('Error fetching sale bill:', error)
        toast.error('Failed to load sale bill details')
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
        <p className="text-muted-foreground">Sale bill not found</p>
        <Link href="/sales">
          <Button className="mt-4">Back to Sales</Button>
        </Link>
      </div>
    )
  }

  const subtotal = Number(bill.total_amount)
  const discountAmount = Number(bill.discount_amount || 0)
  const taxAmount = Number(bill.tax_amount || 0)
  const totalWithVat = Number(bill.total_with_vat)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sales">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{bill.bill_code}</h1>
            <p className="text-muted-foreground">
              {bill.date_bs} {bill.invoice_no ? `&middot; Ref: ${bill.invoice_no}` : ''}
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
            className="text-sm capitalize"
          >
            {bill.status}
          </Badge>
          <Button variant="outline" size="icon">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-semibold text-lg">{customer?.name || '—'}</p>
            <p className="text-muted-foreground text-sm font-mono">{customer?.customer_code}</p>
            {customer?.phone && <p className="text-sm">{customer.phone}</p>}
            {customer?.address && <p className="text-sm text-muted-foreground">{customer.address}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatNPR(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">- {formatNPR(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT (13%)</span>
                <span className="font-medium">{formatNPR(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2 text-primary text-xl">
              <span>Total</span>
              <span>{formatNPR(totalWithVat)}</span>
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
            <p className="text-center py-8 text-muted-foreground italic">
              No items recorded for this bill (Quick Total entry).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Sell Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{item.product_code}</TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                    <TableCell className="text-right font-medium">{formatNPR(item.sell_rate)}</TableCell>
                    <TableCell className="text-right font-bold">{formatNPR(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
