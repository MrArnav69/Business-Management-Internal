'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
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
import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [bill, setBill] = useState<SupplierBill | null>(null)
  const [items, setItems] = useState<(BillItem & { product_name?: string; product_code?: string })[]>([])
  const [supplier, setSupplier] = useState<any>(null)
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
          <Button variant="outline" size="icon">
            <Printer className="h-4 w-4" />
          </Button>
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
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total</span>
              <span>{formatNPR(totalWithVat)}</span>
            </div>
            <div className="flex justify-between font-bold border-t pt-2">
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
    </div>
  )
}
