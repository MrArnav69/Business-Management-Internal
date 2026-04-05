'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Supplier, SupplierBill, SupplierPayment } from '@/types'
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
import { Loader2, Eye, TrendingDown, Truck, Wallet } from 'lucide-react'
import { toast } from 'sonner'

interface SupplierPayable {
  supplier: Supplier
  openingBalance: number
  totalPurchased: number
  totalPaid: number
  netPayable: number
  billCount: number
  paymentCount: number
}

export default function PayablesReportPage() {
  const [payablesData, setPayablesData] = useState<SupplierPayable[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [suppliersRes, billsRes, paymentsRes] = await Promise.all([
        supabase.from('suppliers').select('*').order('name', { ascending: true }),
        supabase.from('supplier_bills').select('*'),
        supabase.from('supplier_payments').select('*'),
      ])

      if (suppliersRes.error) throw suppliersRes.error
      if (billsRes.error) throw billsRes.error
      if (paymentsRes.error) throw paymentsRes.error

      const suppliers = (suppliersRes.data as any[]) || []
      const bills = (billsRes.data as any[]) || []
      const payments = (paymentsRes.data as any[]) || []

      const data: SupplierPayable[] = suppliers.map((supplier) => {
        const supplierBills = bills.filter((b) => b.supplier_id === supplier.id)
        const supplierPayments = payments.filter((p) => p.supplier_id === supplier.id)
        
        const openingBalance = Number(supplier.opening_balance || 0)
        // For payables, we calculate: Opening + Bills - Payments
        const totalPurchased = supplierBills.reduce(
          (sum, b) => sum + Number(b.total_with_vat || b.total_amount),
          0
        )
        const totalPaid = supplierPayments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        )

        const netPayable = openingBalance + totalPurchased - totalPaid

        return {
          supplier,
          openingBalance,
          totalPurchased,
          totalPaid,
          netPayable,
          billCount: supplierBills.length,
          paymentCount: supplierPayments.length,
        }
      }).filter((d) => d.netPayable !== 0)

      setPayablesData(data.sort((a, b) => b.netPayable - a.netPayable))
    } catch (error) {
      console.error('Error fetching payables report:', error)
      toast.error('Failed to load payables report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPayable = payablesData.reduce((sum, d) => sum + d.netPayable, 0)
  const suppliersWithBalance = payablesData.filter(d => d.netPayable > 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payables Report (Suppliers)</h1>
          <p className="text-muted-foreground">Detailed breakdown of amounts owed to suppliers</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Total Payables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-destructive">{formatNPR(totalPayable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Suppliers with Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{suppliersWithBalance}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Avg. Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">
              {suppliersWithBalance > 0
                ? formatNPR(totalPayable / suppliersWithBalance)
                : formatNPR(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-destructive/10">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Outstanding Payables by Supplier</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            </div>
          ) : payablesData.length === 0 ? (
            <div className="text-center py-20 bg-muted/10 rounded-xl border-2 border-dashed">
              <p className="text-muted-foreground italic font-medium">
                No payables found. All supplier dues are cleared!
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Supplier</TableHead>
                    <TableHead className="font-bold">Code</TableHead>
                    <TableHead className="text-right font-bold">OP. Balance</TableHead>
                    <TableHead className="text-right font-bold">Total Purchases</TableHead>
                    <TableHead className="text-right font-bold">Total Paid</TableHead>
                    <TableHead className="text-right font-bold">Net Payable</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payablesData.map((data) => (
                    <TableRow key={data.supplier.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold">{data.supplier.name}</TableCell>
                      <TableCell className="font-mono text-sm">{data.supplier.supplier_code}</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">{formatNPR(data.openingBalance)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNPR(data.totalPurchased)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">-{formatNPR(data.totalPaid)}</TableCell>
                      <TableCell className="text-right font-black">
                        <span className={data.netPayable > 0 ? 'text-destructive' : 'text-green-700'}>
                          {formatNPR(data.netPayable)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/suppliers/${data.supplier.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-destructive/5 border-t-2">
                  <TableRow>
                    <TableCell colSpan={5} className="font-black text-right uppercase tracking-tighter">Combined Total Payable</TableCell>
                    <TableCell className="text-right font-black text-destructive text-lg">
                      {formatNPR(totalPayable)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
