'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Customer } from '@/types'
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
import { NepaliDatePicker } from 'nepali-datepicker-reactjs'
import 'nepali-datepicker-reactjs/dist/index.css'
import { getCurrentBsDate, getCurrentAdDate, bsToAd, adToBs } from '@/lib/nepali-date'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPhoneCountry, setFormPhoneCountry] = useState('NP')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formGstPan, setFormGstPan] = useState('')
  const [formRemarks, setFormRemarks] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active')
  const [formOpeningBalance, setFormOpeningBalance] = useState('0')
  const [formObDateBs, setFormObDateBs] = useState(getCurrentBsDate())
  const [formObDateAd, setFormObDateAd] = useState(getCurrentAdDate())

  const handleObBsChange = (val: string) => {
    const slash = val.replace(/-/g, '/')
    setFormObDateBs(slash)
    try { setFormObDateAd(bsToAd(slash).toISOString().split('T')[0]) } catch {}
  }
  const handleObAdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormObDateAd(val)
    try { setFormObDateBs(adToBs(val)) } catch {}
  }

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setCustomers((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const resetForm = () => {
    setFormName('')
    setFormPhone('')
    setFormPhoneCountry('NP')
    setFormEmail('')
    setFormAddress('')
    setFormGstPan('')
    setFormRemarks('')
    setFormStatus('active')
    setFormOpeningBalance('0')
    setFormObDateBs(getCurrentBsDate())
    setFormObDateAd(getCurrentAdDate())
  }

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormName(customer.name)
    setFormPhone(customer.phone || '')
    setFormPhoneCountry(customer.phone_country || 'NP')
    setFormEmail(customer.email || '')
    setFormAddress(customer.address || '')
    setFormGstPan(customer.gst_pan_number || '')
    setFormRemarks(customer.remarks || '')
    setFormStatus(customer.status)
    setFormOpeningBalance(String(customer.opening_balance || 0))
    setFormObDateBs(customer.opening_balance_date_bs || getCurrentBsDate())
    setFormObDateAd(customer.opening_balance_date_ad || getCurrentAdDate())
    setDialogOpen(true)
  }

  const openDeleteDialog = (customer: Customer) => {
    setDeletingCustomer(customer)
    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Customer name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim() || null,
        phone_country: formPhoneCountry,
        phone_national: formPhone.trim() || null,
        email: formEmail.trim() || null,
        address: formAddress.trim() || null,
        gst_pan_number: formGstPan.trim() || null,
        remarks: formRemarks.trim() || null,
        status: formStatus,
        opening_balance: Number(formOpeningBalance) || 0,
        opening_balance_date_bs: formObDateBs || null,
        opening_balance_date_ad: formObDateAd || null,
        date_bs: new Date().toISOString().split('T')[0],
        date_ad: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0],
      }

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(payload as any)
          .eq('id', editingCustomer.id)
        if (error) throw error
        toast.success('Customer updated successfully')
      }
      setDialogOpen(false)
      fetchCustomers()
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCustomer) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('customers')
        .update({ status: 'inactive' } as any)
        .eq('id', deletingCustomer.id)
      if (error) throw error
      toast.success('Customer deactivated successfully')
      setDeleteDialogOpen(false)
      fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Failed to deactivate customer')
    } finally {
      setSaving(false)
    }
  }

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_code.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <Link href="/customers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
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
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-mono text-sm">{customer.customer_code}</TableCell>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/customers/${customer.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(customer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(customer)}
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
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </DialogTitle>
            <DialogDescription>
              Update the customer details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="customer-name">Customer Name</Label>
              <Input
                id="customer-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. 9841234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. john@example.com"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="customer-address">Address</Label>
              <Input
                id="customer-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="e.g. Kathmandu, Nepal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-gst">PAN Number</Label>
              <Input
                id="customer-gst"
                value={formGstPan}
                onChange={(e) => setFormGstPan(e.target.value)}
                placeholder="e.g. 123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-status">Status</Label>
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
            <div className="space-y-2">
              <Label htmlFor="customer-ob">Opening Balance (NPR)</Label>
              <Input
                id="customer-ob"
                type="number"
                min="0"
                value={formOpeningBalance}
                onChange={(e) => setFormOpeningBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="text-xs text-muted-foreground">Opening Balance Date</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">BS Date</Label>
                  <NepaliDatePicker
                    inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formObDateBs.replace(/\//g, '-')}
                    onChange={handleObBsChange}
                    options={{ calenderLocale: 'en', valueLocale: 'en' }}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">AD Date</Label>
                  <Input type="date" value={formObDateAd} onChange={handleObAdChange} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate &quot;{deletingCustomer?.name}&quot;?
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
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
