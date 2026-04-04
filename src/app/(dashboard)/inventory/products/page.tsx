'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Product, Category } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatNPR, getCurrentBsDate, getCurrentAdDate, getCurrentTime } from '@/lib/nepali-date'
import { UNITS } from '@/lib/constants'
import { Plus, Search, Pencil, Trash2, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'

export default function ProductsPage() {
  const [products, setProducts] = useState<(Product & { category_name?: string })[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formUnit, setFormUnit] = useState('')
  const [formBuyRate, setFormBuyRate] = useState('')
  const [formSellRate, setFormSellRate] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formVatPan, setFormVatPan] = useState(false)
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active')
  const [formQuantity, setFormQuantity] = useState('0')


  

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const productsData = data as any[]
      setProducts(
        (productsData || []).map((p: any) => ({
          ...p,
          category_name: p.categories?.name || '—',
        }))
      )
    } catch (error) {
      console.error('Error fetching products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error
      setCategories((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [fetchProducts, fetchCategories])

  const resetForm = () => {
    setFormName('')
    setFormCategoryId('')
    setFormUnit('')
    setFormBuyRate('')
    setFormSellRate('')
    setFormBrand('')
    setFormVatPan(false)
    setFormStatus('active')
    setFormQuantity('0')
  }

  const openAddDialog = () => {
    setEditingProduct(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (product: Product) => {
    setEditingProduct(product)
    setFormName(product.name)
    setFormCategoryId(product.category_id)
    setFormUnit(product.unit)
    setFormBuyRate(String(product.buy_rate))
    setFormSellRate(String(product.sell_rate))
    setFormBrand(product.brand || '')
    setFormVatPan(product.vat_pan)
    setFormStatus(product.status)
    setDialogOpen(true)
  }

  const openDeleteDialog = (product: Product) => {
    setDeletingProduct(product)
    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Product name is required')
      return
    }
    if (!formCategoryId) {
      toast.error('Category is required')
      return
    }
    if (!formUnit.trim()) {
      toast.error('Unit is required')
      return
    }
    if (!formBuyRate || isNaN(Number(formBuyRate))) {
      toast.error('Valid buy rate is required')
      return
    }
    if (!formSellRate || isNaN(Number(formSellRate))) {
      toast.error('Valid sell rate is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        category_id: formCategoryId,
        unit: formUnit.trim(),
        buy_rate: Number(formBuyRate),
        sell_rate: Number(formSellRate),
        brand: formBrand.trim() || null,
        vat_pan: formVatPan,
        status: formStatus,
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload as any)
          .eq('id', editingProduct.id)
        if (error) throw error
        toast.success('Product updated successfully')
      } else {
        const category = categories.find((c) => c.id === formCategoryId)
        const prefix = category?.prefix || 'PRD'
        
        const { data: latestProducts } = await supabase
          .from('products')
          .select('product_code')
          .ilike('product_code', `${prefix}-%`)
          .order('created_at', { ascending: false })
          .limit(1)

        let newProductCode = `${prefix}-0001`
        if (latestProducts && latestProducts.length > 0 && latestProducts[0].product_code) {
           const lastCode = latestProducts[0].product_code
           const num = parseInt(lastCode.replace(`${prefix}-`, ''), 10)
           if (!isNaN(num)) {
             newProductCode = `${prefix}-${String(num + 1).padStart(4, '0')}`
           }
        }

        const initialQuantity = Number(formQuantity) || 0

        const { data: insertedProduct, error } = await supabase
          .from('products')
          .insert({ ...payload, product_code: newProductCode, quantity: initialQuantity } as any)
          .select()
          .single()
          
        if (error) throw error

        if (initialQuantity > 0 && insertedProduct) {
           await supabase.from('stock_history').insert({
              product_id: insertedProduct.id,
              quantity_change: initialQuantity,
              quantity_after: initialQuantity,
              type: 'in',
              reference_type: 'manual',
              reference_id: null,
              date_bs: getCurrentBsDate(),
              date_ad: getCurrentAdDate(),
              time: getCurrentTime(),
           } as any)
        }

        toast.success('Product added successfully')
      }
      setDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingProduct) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: 'inactive' } as any)
        .eq('id', deletingProduct.id)
      if (error) throw error
      toast.success('Product deleted successfully')
      setDeleteDialogOpen(false)
      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    } finally {
      setSaving(false)
    }
  }

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.product_code.toLowerCase().includes(search.toLowerCase())
    const matchCategory = filterCategory === 'all' || p.category_id === filterCategory
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchCategory && matchStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Buy Rate</TableHead>
              <TableHead className="text-right">Sell Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
              filtered.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.product_code}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category_name}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        (product.quantity || 0) < 10
                          ? 'text-red-600 font-medium'
                          : ''
                      }
                    >
                      {product.quantity ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatNPR(product.buy_rate)}</TableCell>
                  <TableCell className="text-right">{formatNPR(product.sell_rate)}</TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/inventory/products/${product.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update the product details below.'
                : 'Fill in the details to add a new product.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Copper Wire 2.5mm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-unit">Unit</Label>
              <Select value={formUnit} onValueChange={setFormUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.abbreviation} value={u.abbreviation}>
                      {u.name} ({u.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingProduct && (
              <div className="space-y-2">
                <Label htmlFor="product-qty">Initial Quantity</Label>
                <Input
                  id="product-qty"
                  type="number"
                  min="0"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="product-buy-rate">Buy Rate</Label>
              <Input
                id="product-buy-rate"
                type="number"
                value={formBuyRate}
                onChange={(e) => setFormBuyRate(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sell-rate">Sell Rate</Label>
              <Input
                id="product-sell-rate"
                type="number"
                value={formSellRate}
                onChange={(e) => setFormSellRate(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-brand">Brand (optional)</Label>
              <Input
                id="product-brand"
                value={formBrand}
                onChange={(e) => setFormBrand(e.target.value)}
                placeholder="e.g. Schneider"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-status">Status</Label>
              <Select
                value={formStatus}
                onValueChange={(v) => setFormStatus(v as 'active' | 'inactive')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProduct ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingProduct?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
