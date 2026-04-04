'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, Category } from '@/types'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNPR } from '@/lib/nepali-date'
import { Search, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export default function StockReportPage() {
  const [products, setProducts] = useState<(Product & { category_name?: string })[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)


  

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase.from('products').select('*, categories(name)').order('name', { ascending: true }),
        supabase.from('categories').select('*').order('name', { ascending: true }),
      ])
      if (productsRes.error) throw productsRes.error
      if (categoriesRes.error) throw categoriesRes.error

      const productsData = productsRes.data as any[]
      const categoriesData = categoriesRes.data as any[]
      setProducts(
        (productsData || []).map((p: any) => ({
          ...p,
          category_name: p.categories?.name || '—',
        }))
      )
      setCategories(categoriesData || [])
    } catch (error) {
      console.error('Error fetching stock report:', error)
      toast.error('Failed to load stock report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.product_code.toLowerCase().includes(search.toLowerCase())
    const matchCategory = filterCategory === 'all' || p.category_id === filterCategory
    const matchLowStock = !showLowStockOnly || (p.quantity || 0) < 10
    return matchSearch && matchCategory && matchLowStock
  })

  const lowStockCount = products.filter((p) => (p.quantity || 0) < 10).length
  const totalValue = products.reduce(
    (sum, p) => sum + (p.quantity || 0) * p.sell_rate,
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Report</h1>
        <p className="text-muted-foreground">Current inventory levels and stock valuation</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNPR(totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showLowStockOnly ? 'default' : 'outline'}
          onClick={() => setShowLowStockOnly(!showLowStockOnly)}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Low Stock Only
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Buy Rate</TableHead>
              <TableHead className="text-right">Sell Rate</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((product) => {
                const qty = product.quantity || 0
                const isLowStock = qty < 10
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">{product.product_code}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category_name}</TableCell>
                    <TableCell className="text-right">
                      <span className={isLowStock ? 'text-red-600 font-semibold' : ''}>
                        {qty}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNPR(product.buy_rate)}</TableCell>
                    <TableCell className="text-right">{formatNPR(product.sell_rate)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNPR(qty * product.sell_rate)}
                    </TableCell>
                    <TableCell>
                      {isLowStock ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="default">In Stock</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
