'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Supplier, SupplierBill } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatNPR } from '@/lib/nepali-date'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'

export default function SupplierLedgerPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bills, setBills] = useState<SupplierBill[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [loading, setLoading] = useState(true)


  

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true })
      if (error) throw error
      setSuppliers((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  useEffect(() => {
    if (!selectedSupplier) {
      setBills([])
      return
    }
    async function fetchBills() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('supplier_bills')
          .select('*')
          .eq('supplier_id', selectedSupplier)
          .order('created_at', { ascending: true })
        if (error) throw error
        setBills((data as any[]) || [])
      } catch (error) {
        console.error('Error fetching bills:', error)
        toast.error('Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }
    fetchBills()
  }, [selectedSupplier])

  let runningBalance = 0
  const transactions = bills.map((bill) => {
    const debit = Number(bill.debit_amount) || 0
    const credit = Number(bill.credit_amount) || 0
    runningBalance += debit - credit
    return {
      ...bill,
      running_balance: runningBalance,
    }
  })

  const totalDebit = bills.reduce((sum, b) => sum + Number(b.debit_amount || 0), 0)
  const totalCredit = bills.reduce((sum, b) => sum + Number(b.credit_amount || 0), 0)
  const currentBalance = totalDebit - totalCredit

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Supplier Ledger</h1>
        <p className="text-muted-foreground">View transaction history for each supplier</p>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a supplier" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.supplier_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSupplier ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a supplier to view their ledger
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-red-600" />
                  <p className="text-lg font-semibold text-red-600">{formatNPR(totalDebit)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <p className="text-lg font-semibold text-green-600">{formatNPR(totalCredit)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-lg font-semibold ${currentBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatNPR(Math.abs(currentBalance))}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No transactions found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bill Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.date_bs}</TableCell>
                        <TableCell className="font-mono text-sm">{t.bill_code}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              t.status === 'paid'
                                ? 'default'
                                : t.status === 'partial'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(t.debit_amount) > 0 ? formatNPR(t.debit_amount) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(t.credit_amount) > 0 ? formatNPR(t.credit_amount) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNPR(t.running_balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
