'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatNPR } from '@/lib/nepali-date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowRight,
} from 'lucide-react'

interface DashboardStats {
  totalProducts: number
  totalSuppliers: number
  lowStockCount: number
  totalOutstanding: number
  recentBills: Array<{
    id: string
    bill_code: string
    total_amount: number
    debit_amount: number
    date_bs: string
    supplier_name?: string
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalSuppliers: 0,
    lowStockCount: 0,
    totalOutstanding: 0,
    recentBills: [],
  })
  const [loading, setLoading] = useState(true)


  

  useEffect(() => {
    async function fetchStats() {
      try {
        const [productsRes, suppliersRes, lowStockRes, billsRes, recentBillsRes] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('quantity', 10),
          supabase.from('supplier_bills').select('debit_amount').eq('status', 'pending'),
          supabase
            .from('supplier_bills')
            .select('id, bill_code, total_amount, debit_amount, date_bs, suppliers(name)')
            .order('created_at', { ascending: false })
            .limit(10),
        ])

        const billsData = billsRes.data as any[]
        const recentData = recentBillsRes.data as any[]
        const totalOutstanding = (billsData || []).reduce((sum, bill) => sum + Number(bill.debit_amount), 0)

        setStats({
          totalProducts: productsRes.count || 0,
          totalSuppliers: suppliersRes.count || 0,
          lowStockCount: lowStockRes.count || 0,
          totalOutstanding,
          recentBills:
            recentData?.map((bill: any) => ({
              id: bill.id,
              bill_code: bill.bill_code,
              total_amount: Number(bill.total_amount),
              debit_amount: Number(bill.debit_amount),
              date_bs: bill.date_bs,
              supplier_name: bill.suppliers?.name,
            })) || [],
        })
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const metrics = [
    {
      title: 'Total Products',
      value: stats.totalProducts.toString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Suppliers',
      value: stats.totalSuppliers.toString(),
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Low Stock Alerts',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Total Outstanding',
      value: formatNPR(stats.totalOutstanding),
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your retail operations</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <div className={`rounded-lg p-2 ${metric.bgColor}`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '...' : metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Bills
              <Link href="/bills">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : stats.recentBills.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No bills yet</div>
            ) : (
              <div className="space-y-4">
                {stats.recentBills.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">{bill.bill_code}</p>
                      <p className="text-sm text-muted-foreground">{bill.supplier_name || 'Unknown'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatNPR(bill.total_amount)}</p>
                      <Badge variant={bill.debit_amount > 0 ? 'destructive' : 'secondary'}>
                        {bill.debit_amount > 0 ? 'Pending' : 'Paid'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/bills/new">
              <Button className="w-full justify-start gap-2" variant="outline">
                <FileText className="h-4 w-4" />
                Add New Bill
              </Button>
            </Link>
            <Link href="/inventory/products/new">
              <Button className="w-full justify-start gap-2" variant="outline">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </Link>
            <Link href="/suppliers/new">
              <Button className="w-full justify-start gap-2" variant="outline">
                <Users className="h-4 w-4" />
                Add Supplier
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
