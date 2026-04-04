'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Supplier } from '@/types'
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
import { Plus, Search, Pencil, Trash2, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPhoneCountry, setFormPhoneCountry] = useState('NP')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formGstPan, setFormGstPan] = useState('')
  const [formBankDetails, setFormBankDetails] = useState('')
  const [formRemarks, setFormRemarks] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active')

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setSuppliers((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const resetForm = () => {
    setFormName('')
    setFormPhone('')
    setFormPhoneCountry('NP')
    setFormEmail('')
    setFormAddress('')
    setFormGstPan('')
    setFormBankDetails('')
    setFormRemarks('')
    setFormStatus('active')
  }

  const openAddDialog = () => {
    setEditingSupplier(null)
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormName(supplier.name)
    setFormPhone(supplier.phone)
    setFormPhoneCountry(supplier.phone_country)
    setFormEmail(supplier.email || '')
    setFormAddress(supplier.address || '')
    setFormGstPan(supplier.gst_pan_number || '')
    setFormBankDetails(supplier.bank_details || '')
    setFormRemarks(supplier.remarks || '')
    setFormStatus(supplier.status)
    setDialogOpen(true)
  }

  const openDeleteDialog = (supplier: Supplier) => {
    setDeletingSupplier(supplier)
    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Supplier name is required')
      return
    }
    if (!formPhone.trim()) {
      toast.error('Supplier phone is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim(),
        phone_country: formPhoneCountry,
        phone_national: formPhone.trim(),
        email: formEmail.trim() || null,
        address: formAddress.trim() || null,
        gst_pan_number: formGstPan.trim() || null,
        bank_details: formBankDetails.trim() || null,
        remarks: formRemarks.trim() || null,
        status: formStatus,
        date_bs: new Date().toISOString().split('T')[0],
        date_ad: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
      }

      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(payload as any)
          .eq('id', editingSupplier.id)
        if (error) throw error
        toast.success('Supplier updated successfully')
      } else {
        const { data: latestSupplier } = await supabase
          .from('suppliers')
          .select('supplier_code')
          .order('created_at', { ascending: false })
          .limit(1)

        let newSupplierCode = 'SUP-0001'
        if (latestSupplier && latestSupplier.length > 0 && latestSupplier[0].supplier_code) {
           const lastCode = latestSupplier[0].supplier_code
           if (lastCode.startsWith('SUP-')) {
             const num = parseInt(lastCode.replace('SUP-', ''), 10)
             if (!isNaN(num)) {
               newSupplierCode = `SUP-${String(num + 1).padStart(4, '0')}`
             }
           }
        }

        const { error } = await supabase
          .from('suppliers')
          .insert({ ...payload, supplier_code: newSupplierCode } as any)
        if (error) throw error
        toast.success('Supplier added successfully')
      }
      setDialogOpen(false)
      fetchSuppliers()
    } catch (error) {
      console.error('Error saving supplier:', error)
      toast.error('Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingSupplier) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ status: 'inactive' } as any)
        .eq('id', deletingSupplier.id)
      if (error) throw error
      toast.success('Supplier deleted successfully')
      setDeleteDialogOpen(false)
      fetchSuppliers()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      toast.error('Failed to delete supplier')
    } finally {
      setSaving(false)
    }
  }

  const filtered = suppliers.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.supplier_code.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.includes(search))
    const matchStatus = filterStatus === 'all' || s.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage your suppliers</p>
        </div>
        <Link href="/suppliers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Supplier
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
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
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No suppliers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-mono text-sm">{supplier.supplier_code}</TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={supplier.status === 'active' ? 'default' : 'secondary'}>
                      {supplier.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/suppliers/${supplier.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(supplier)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(supplier)}
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
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? 'Update the supplier details below.'
                : 'Fill in the details to add a new supplier.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="supplier-name">Supplier Name</Label>
              <Input
                id="supplier-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. ABC Traders"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Phone *</Label>
              <Input
                id="supplier-phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. 9841234567"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. info@abc.com"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Input
                id="supplier-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="e.g. Kathmandu, Nepal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-gst">GST/PAN Number</Label>
              <Input
                id="supplier-gst"
                value={formGstPan}
                onChange={(e) => setFormGstPan(e.target.value)}
                placeholder="e.g. 123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-status">Status</Label>
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
              {editingSupplier ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingSupplier?.name}&quot;? This action cannot be undone.
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
