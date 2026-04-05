'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Customer, CustomerBill, CustomerPayment } from '@/types'
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
import { Loader2, Eye, TrendingUp, Users, Wallet } from 'lucide-react'
import { toast } from 'sonner'

interface CustomerReceivable {
  customer: Customer
  openingBalance: number
  totalSales: number
  totalCollected: number
  netReceivable: number
  billCount: number
  paymentCount: number
}

export default function ReceivablesReportPage() {
  const [receivablesData, setReceivablesData] = useState<CustomerReceivable[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [customersRes, billsRes, paymentsRes] = await Promise.all([
        supabase.from('customers').select('*').order('name', { ascending: true }),
        supabase.from('customer_bills').select('*'),
        supabase.from('customer_payments').select('*'),
      ])

      if (customersRes.error) throw customersRes.error
      if (billsRes.error) throw billsRes.error
      if (paymentsRes.error) throw paymentsRes.error

      const customers = (customersRes.data as any[]) || []
      const bills = (billsRes.data as any[]) || []
      const payments = (paymentsRes.data as any[]) || []

      const data: CustomerReceivable[] = customers.map((customer) => {
        const customerBills = bills.filter((b) => b.customer_id === customer.id)
        const customerPayments = payments.filter((p) => p.customer_id === customer.id)
        
        const openingBalance = Number(customer.opening_balance || 0)
        const totalSales = customerBills.reduce(
          (sum, b) => sum + Number(b.total_with_vat || 0),
          0
        )
        const totalCollected = customerPayments.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        )

        const netReceivable = openingBalance + totalSales - totalCollected

        return {
          customer,
          openingBalance,
          totalSales,
          totalCollected,
          netReceivable,
          billCount: customerBills.length,
          paymentCount: customerPayments.length,
        }
      }).filter((d) => d.netReceivable !== 0) // Only show customers with any balance (positive or negative)

      // Sort by highest receivable first
      setReceivablesData(data.sort((a, b) => b.netReceivable - a.netReceivable))
    } catch (error) {
      console.error('Error fetching receivables report:', error)
      toast.error('Failed to load receivables report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalReceivable = receivablesData.reduce((sum, d) => sum + d.netReceivable, 0)
  const customersWithBalance = receivablesData.filter(d => d.netReceivable > 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receivables Report (Customers)</h1>
          <p className="text-muted-foreground">Detailed breakdown of amounts due from customers</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Total Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-primary">{formatNPR(totalReceivable)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Customers with Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">{customersWithBalance}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Avg. Receivable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black">
              {customersWithBalance > 0
                ? formatNPR(totalReceivable / customersWithBalance)
                : formatNPR(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-primary/10">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Outstanding Receivables by Customer</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : receivablesData.length === 0 ? (
            <div className="text-center py-20 bg-muted/10 rounded-xl border-2 border-dashed">
              <p className="text-muted-foreground italic font-medium">
                No receivables found. All customers are cleared!
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Customer</TableHead>
                    <TableHead className="font-bold">Code</TableHead>
                    <TableHead className="text-right font-bold">OP. Balance</TableHead>
                    <TableHead className="text-right font-bold">Total Sales</TableHead>
                    <TableHead className="text-right font-bold">Total Collected</TableHead>
                    <TableHead className="text-right font-bold">Net Receivable</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivablesData.map((data) => (
                    <TableRow key={data.customer.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold">{data.customer.name}</TableCell>
                      <TableCell className="font-mono text-sm">{data.customer.customer_code}</TableCell>
                      <TableCell className="text-right font-medium text-muted-foreground">{formatNPR(data.openingBalance)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNPR(data.totalSales)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">-{formatNPR(data.totalCollected)}</TableCell>
                      <TableCell className="text-right font-black">
                        <span className={data.netReceivable > 0 ? 'text-primary' : 'text-green-700'}>
                          {formatNPR(data.netReceivable)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/customers/${data.customer.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-primary/5 border-t-2">
                  <TableRow>
                    <TableCell colSpan={5} className="font-black text-right uppercase tracking-tighter">Combined Total Receivable</TableCell>
                    <TableCell className="text-right font-black text-primary text-lg">
                      {formatNPR(totalReceivable)}
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
