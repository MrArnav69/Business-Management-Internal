'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Product, PriceHistory, StockHistory, Category } from '@/types'
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
import { ArrowLeft, Pencil, Loader2, Package, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([])
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
        const [productRes, priceRes, stockRes] = await Promise.all([
          supabase.from('products').select('*, categories(name)').eq('id', id).single(),
          supabase.from('price_history').select('*').eq('product_id', id).order('created_at', { ascending: false }),
          supabase.from('stock_history').select('*').eq('product_id', id).order('created_at', { ascending: false }).limit(50),
        ])

        if (productRes.error) throw productRes.error
        setProduct(productRes.data as unknown as Product)
        setPriceHistory(priceRes.data || [])
        setStockHistory(stockRes.data || [])
      } catch (error) {
        console.error('Error fetching product:', error)
        toast.error('Failed to load product details')
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

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Product not found</p>
        <Link href="/inventory/products">
          <Button className="mt-4">Back to Products</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory/products">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground font-mono text-sm">{product.product_code}</p>
          </div>
        </div>
        <Link href={`/inventory/products/${product.id}/edit`}>
          <Button>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Product
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{(product as any).categories?.name || '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{product.quantity ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Buy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatNPR(product.buy_rate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sell Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{formatNPR(product.sell_rate)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock History</TabsTrigger>
          <TabsTrigger value="price">Price History</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Stock History</CardTitle>
            </CardHeader>
            <CardContent>
              {stockHistory.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No stock history</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>After</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date_bs}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              entry.type === 'in'
                                ? 'default'
                                : entry.type === 'out'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {entry.quantity_change > 0 ? (
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            )}
                            {entry.quantity_change > 0 ? '+' : ''}
                            {entry.quantity_change}
                          </div>
                        </TableCell>
                        <TableCell>{entry.quantity_after}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.reference_type ? `${entry.reference_type}` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="price">
          <Card>
            <CardHeader>
              <CardTitle>Price History</CardTitle>
            </CardHeader>
            <CardContent>
              {priceHistory.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No price history</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Buy Rate</TableHead>
                      <TableHead className="text-right">Sell Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date_bs}</TableCell>
                        <TableCell className="text-right">{formatNPR(entry.buy_rate)}</TableCell>
                        <TableCell className="text-right">{formatNPR(entry.sell_rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
