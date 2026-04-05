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
  TrendingDown,
  Plus,
  ArrowRight,
  ShoppingCart,
  Receipt,
  Coins
} from 'lucide-react'

interface DashboardStats {
  totalProducts: number
  totalSuppliers: number
  totalCustomers: number
  lowStockCount: number
  totalPayable: number
  totalPaid: number
  totalReceivable: number
  totalCollected: number
  recentBills: Array<{
    id: string
    bill_code: string
    total_with_vat: number
    date_bs: string
    supplier_name?: string
  }>
  recentSales: Array<{
    id: string
    bill_code: string
    total_with_vat: number
    date_bs: string
    customer_name?: string
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalSuppliers: 0,
    totalCustomers: 0,
    lowStockCount: 0,
    totalPayable: 0,
    totalPaid: 0,
    totalReceivable: 0,
    totalCollected: 0,
    recentBills: [],
    recentSales: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [
          productsRes, 
          suppliersRes, 
          customersRes,
          lowStockRes, 
          supplierBillsRes, 
          supplierPaymentsRes, 
          suppliersBalancesRes,
          customerBillsRes,
          customerPaymentsRes,
          customersBalancesRes,
          recentBillsRes,
          recentSalesRes
        ] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('quantity', 10),
          supabase.from('supplier_bills').select('total_with_vat'),
          supabase.from('supplier_payments').select('amount'),
          supabase.from('suppliers').select('opening_balance'),
          supabase.from('customer_bills').select('total_with_vat'),
          supabase.from('customer_payments').select('amount'),
          supabase.from('customers').select('opening_balance'),
          supabase
            .from('supplier_bills')
            .select('id, bill_code, total_with_vat, date_bs, suppliers(name)')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('customer_bills')
            .select('id, bill_code, total_with_vat, date_bs, customers(name)')
            .order('created_at', { ascending: false })
            .limit(5)
        ])

        // Supplier Calculations
        const purchaseData = supplierBillsRes.data || []
        const paymentOutData = supplierPaymentsRes.data || []
        const supplierOpeningData = suppliersBalancesRes.data || []
        
        const totalSupplierOpening = supplierOpeningData.reduce((sum, s) => sum + Number(s.opening_balance || 0), 0)
        const totalPurchases = purchaseData.reduce((sum, b) => sum + Number(b.total_with_vat || 0), 0)
        const totalPaidOut = paymentOutData.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        const totalPayable = totalSupplierOpening + totalPurchases - totalPaidOut

        // Customer Calculations
        const salesData = customerBillsRes.data || []
        const collectionsData = customerPaymentsRes.data || []
        const customerOpeningData = customersBalancesRes.data || []

        const totalCustomerOpening = customerOpeningData.reduce((sum, c) => sum + Number(c.opening_balance || 0), 0)
        const totalSales = salesData.reduce((sum, b) => sum + Number(b.total_with_vat || 0), 0)
        const totalCollected = collectionsData.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        const totalReceivable = totalCustomerOpening + totalSales - totalCollected

        setStats({
          totalProducts: productsRes.count || 0,
          totalSuppliers: suppliersRes.count || 0,
          totalCustomers: customersRes.count || 0,
          lowStockCount: lowStockRes.count || 0,
          totalPayable,
          totalPaid: totalPaidOut,
          totalReceivable,
          totalCollected,
          recentBills: (recentBillsRes.data as any[])?.map(b => ({
            id: b.id,
            bill_code: b.bill_code,
            total_with_vat: Number(b.total_with_vat || 0),
            date_bs: b.date_bs,
            supplier_name: b.suppliers?.name
          })) || [],
          recentSales: (recentSalesRes.data as any[])?.map(s => ({
            id: s.id,
            bill_code: s.bill_code,
            total_with_vat: Number(s.total_with_vat || 0),
            date_bs: s.date_bs,
            customer_name: s.customers?.name
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
      title: 'Net Receivables',
      value: formatNPR(stats.totalReceivable),
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: 'Due from customers'
    },
    {
      title: 'Current Payables',
      value: formatNPR(stats.totalPayable),
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Owed to suppliers'
    },
    {
      title: 'Total Collections',
      value: formatNPR(stats.totalCollected),
      icon: Coins,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Payments received'
    },
    {
      title: 'Low Stock Alerts',
      value: stats.lowStockCount.toString(),
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      description: 'Items needing restock'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">Snapshot of your hardware business performance</p>
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
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-semibold tracking-wider">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 space-y-4">
          <CardHeader className="pb-2">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Recent Sales */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Recent Sales
                </h3>
                <Link href="/sales">
                  <Button variant="ghost" size="xs" className="h-7 text-xs">
                    View All
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {loading ? <div className="py-4 text-center">Loading...</div> : 
                 stats.recentSales.length === 0 ? <p className="text-xs text-muted-foreground italic px-1">No sales yet</p> :
                 stats.recentSales.map(sale => (
                  <div key={sale.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{sale.bill_code}</p>
                      <p className="text-[11px] text-muted-foreground">{sale.customer_name || 'Unknown Customer'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatNPR(sale.total_with_vat)}</p>
                      <Badge variant="outline" className="text-[10px] h-4">{sale.date_bs}</Badge>
                    </div>
                  </div>
                 ))
                }
              </div>
            </div>

            {/* Recent Purchases */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-blue-600" />
                  Recent Purchases
                </h3>
                <Link href="/bills">
                  <Button variant="ghost" size="xs" className="h-7 text-xs">
                    View All
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {loading ? <div className="py-4 text-center">Loading...</div> : 
                 stats.recentBills.length === 0 ? <p className="text-xs text-muted-foreground italic px-1">No bills yet</p> :
                 stats.recentBills.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{bill.bill_code}</p>
                      <p className="text-[11px] text-muted-foreground">{bill.supplier_name || 'Unknown Supplier'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatNPR(bill.total_with_vat)}</p>
                      <Badge variant="outline" className="text-[10px] h-4">{bill.date_bs}</Badge>
                    </div>
                  </div>
                 ))
                }
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/sales/new">
              <Button className="w-full justify-start gap-3 h-11" variant="default">
                <ShoppingCart className="h-4 w-4" />
                New Sale Bill
              </Button>
            </Link>
            <Link href="/bills/new">
              <Button className="w-full justify-start gap-3 h-11" variant="outline">
                <FileText className="h-4 w-4" />
                Add Supplier Bill
              </Button>
            </Link>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Link href="/inventory/products/new">
                <Button className="w-full justify-start gap-2 text-[10px] px-2 h-9" variant="secondary">
                  <Plus className="h-3 w-3" />
                  Product
                </Button>
              </Link>
              <Link href="/customers/new">
                <Button className="w-full justify-start gap-2 text-[10px] px-2 h-9" variant="secondary">
                  <Plus className="h-3 w-3" />
                  Customer
                </Button>
              </Link>
              <Link href="/suppliers/new">
                <Button className="w-full justify-start gap-2 text-[10px] px-2 h-9" variant="secondary">
                  <Plus className="h-3 w-3" />
                  Supplier
                </Button>
              </Link>
            </div>
          </CardContent>

          <CardHeader className="pt-6 pb-2">
            <CardTitle className="text-sm font-semibold">Entity Counts</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            <div className="bg-muted/50 p-2 rounded text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold">Items</p>
              <p className="text-lg font-bold">{stats.totalProducts}</p>
            </div>
            <div className="bg-muted/50 p-2 rounded text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold">Cust</p>
              <p className="text-lg font-bold">{stats.totalCustomers}</p>
            </div>
            <div className="bg-muted/50 p-2 rounded text-center">
              <p className="text-xs text-muted-foreground uppercase font-bold">Supp</p>
              <p className="text-lg font-bold">{stats.totalSuppliers}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
