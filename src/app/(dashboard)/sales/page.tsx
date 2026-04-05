'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { CustomerBill } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { formatNPR } from '@/lib/nepali-date'
import { Plus, Search, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'

export default function SalesPage() {
  const [bills, setBills] = useState<(CustomerBill & { customer_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const fetchBills = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customer_bills')
        .select('*, customers(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const billsData = data as any[]
      setBills(
        (billsData || []).map((b: any) => ({
          ...b,
          customer_name: b.customers?.name || '—',
        }))
      )
    } catch (error) {
      console.error('Error fetching sales:', error)
      toast.error('Failed to load sales history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBills()
  }, [fetchBills])

  const filtered = bills.filter((b) => {
    const matchSearch =
      b.bill_code.toLowerCase().includes(search.toLowerCase()) ||
      (b.customer_name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Bills</h1>
          <p className="text-muted-foreground">Manage and track customer sales</p>
        </div>
        <Link href="/sales/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Sale
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill Code</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date (BS)</TableHead>
              <TableHead className="text-right">Total (inc. VAT)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No sales bills found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-mono text-sm">{bill.bill_code}</TableCell>
                  <TableCell className="font-medium">{bill.customer_name}</TableCell>
                  <TableCell>{bill.date_bs}</TableCell>
                  <TableCell className="text-right">{formatNPR(bill.total_with_vat)}</TableCell>
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
                  <TableCell className="text-right">
                    <Link href={`/sales/${bill.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
