'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Supplier, SupplierBill } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNPR } from '@/lib/nepali-date'
import { Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface SupplierOutstanding {
  supplier: Supplier
  totalBilled: number
  totalPaid: number
  outstanding: number
  billCount: number
  pendingBills: number
  partialBills: number
}

export default function OutstandingReportPage() {
  const [outstandingData, setOutstandingData] = useState<SupplierOutstanding[]>([])
  const [loading, setLoading] = useState(true)


  

  const fetchData = useCallback(async () => {
    try {
      const [suppliersRes, billsRes] = await Promise.all([
        db
          .from('suppliers')
          .select('*')
          .order('name', { ascending: true }),
        db
          .from('supplier_bills')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      if (suppliersRes.error) throw suppliersRes.error
      if (billsRes.error) throw billsRes.error

      const suppliers = (suppliersRes.data as any[]) || []
      const bills = (billsRes.data as any[]) || []

      const data: SupplierOutstanding[] = suppliers.map((supplier) => {
        const supplierBills = bills.filter((b) => b.supplier_id === supplier.id)
        const totalBilled = supplierBills.reduce(
          (sum, b) => sum + Number(b.total_with_vat || b.total_amount),
          0
        )
        const totalPaid = supplierBills.reduce(
          (sum, b) => sum + Number(b.credit_amount || 0),
          0
        )
        const pendingBills = supplierBills.filter((b) => b.status === 'pending').length
        const partialBills = supplierBills.filter((b) => b.status === 'partial').length

        return {
          supplier,
          totalBilled,
          totalPaid,
          outstanding: totalBilled - totalPaid,
          billCount: supplierBills.length,
          pendingBills,
          partialBills,
        }
      }).filter((d) => d.outstanding > 0)

      setOutstandingData(data)
    } catch (error) {
      console.error('Error fetching outstanding report:', error)
      toast.error('Failed to load outstanding report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalOutstanding = outstandingData.reduce((sum, d) => sum + d.outstanding, 0)
  const totalSuppliersWithOutstanding = outstandingData.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Outstanding Report</h1>
        <p className="text-muted-foreground">Suppliers with pending or partial payments</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatNPR(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Suppliers with Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalSuppliersWithOutstanding}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalSuppliersWithOutstanding > 0
                ? formatNPR(totalOutstanding / totalSuppliersWithOutstanding)
                : formatNPR(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding by Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : outstandingData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No outstanding balances. All suppliers are up to date!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Total Billed</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Partial</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingData.map((data) => (
                  <TableRow key={data.supplier.id}>
                    <TableCell className="font-medium">{data.supplier.name}</TableCell>
                    <TableCell className="font-mono text-sm">{data.supplier.supplier_code}</TableCell>
                    <TableCell className="text-right">{formatNPR(data.totalBilled)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatNPR(data.totalPaid)}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {formatNPR(data.outstanding)}
                    </TableCell>
                    <TableCell className="text-center">
                      {data.pendingBills > 0 ? (
                        <Badge variant="destructive">{data.pendingBills}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {data.partialBills > 0 ? (
                        <Badge variant="secondary">{data.partialBills}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/suppliers/${data.supplier.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    {formatNPR(totalOutstanding)}
                  </TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
