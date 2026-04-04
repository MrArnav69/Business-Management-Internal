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
import { ArrowLeft, Loader2, Phone, Mail, MapPin } from 'lucide-react'
import { toast } from 'sonner'

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [bills, setBills] = useState<SupplierBill[]>([])
  const [productsSupplied, setProductsSupplied] = useState<any[]>([])
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
        const [supplierRes, billsRes, productsRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('id', id).single(),
          supabase
            .from('supplier_bills')
            .select('*')
            .eq('supplier_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('products')
            .select('*')
            .eq('status', 'active')
            .order('name', { ascending: true }),
        ])

        if (supplierRes.error) throw supplierRes.error
        setSupplier(supplierRes.data as unknown as Supplier)
        setBills(billsRes.data || [])
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

  const totalOutstanding = bills.reduce(
    (sum, bill) => sum + Number(bill.credit_amount || 0),
    0
  )
  const totalPaid = bills.reduce(
    (sum, bill) => sum + Number(bill.debit_amount || 0),
    0
  )
  const totalBilled = bills.reduce(
    (sum, bill) => sum + Number(bill.total_amount || 0),
    0
  )

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
        <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'} className="text-sm">
          {supplier.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatNPR(totalBilled)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-green-600">{formatNPR(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-red-600">{formatNPR(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{bills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{supplier.phone || '—'}</p>
          </CardContent>
        </Card>
      </div>

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
              <span>{supplier.address || '—'}</span>
            </div>
            {supplier.gst_pan_number && (
              <div>
                <p className="text-sm font-medium">GST/PAN</p>
                <p className="text-muted-foreground">{supplier.gst_pan_number}</p>
              </div>
            )}
            {supplier.bank_details && (
              <div>
                <p className="text-sm font-medium">Bank Details</p>
                <p className="text-muted-foreground">{supplier.bank_details}</p>
              </div>
            )}
            {supplier.remarks && (
              <div>
                <p className="text-sm font-medium">Remarks</p>
                <p className="text-muted-foreground">{supplier.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Bill History</CardTitle>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No bills yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-mono text-sm">
                        <Link href={`/bills/${bill.id}`} className="hover:underline">
                          {bill.bill_code}
                        </Link>
                      </TableCell>
                      <TableCell>{bill.date_bs}</TableCell>
                      <TableCell className="text-right">{formatNPR(bill.total_amount)}</TableCell>
                      <TableCell className="text-right">
                        {Number(bill.debit_amount) > 0
                          ? formatNPR(bill.debit_amount)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            bill.status === 'paid'
                              ? 'default'
                              : bill.status === 'partial'
                              ? 'secondary'
                              : 'destructive'
                          }
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
      </div>
    </div>
  )
}
