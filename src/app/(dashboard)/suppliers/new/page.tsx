'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentBsDate, getCurrentAdDate, getCurrentTime, bsToAd, adToBs } from '@/lib/nepali-date'
import { NepaliDatePicker } from 'nepali-datepicker-reactjs'
import 'nepali-datepicker-reactjs/dist/index.css'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NewSupplierPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [supplierCode, setSupplierCode] = useState('Generating...')

  useEffect(() => {
    const fetchLatestSupplierCode = async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('supplier_code')
        .order('created_at', { ascending: false })
        .limit(1)
      
      let nextCode = 'SUP-0001'
      if (!error && data && data.length > 0 && data[0].supplier_code) {
        const lastCode = data[0].supplier_code
        if (lastCode.startsWith('SUP-')) {
          const num = parseInt(lastCode.replace('SUP-', ''), 10)
          if (!isNaN(num)) {
            nextCode = `SUP-${String(num + 1).padStart(4, '0')}`
          }
        }
      }
      setSupplierCode(nextCode)
    }
    fetchLatestSupplierCode()
  }, [])
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPhoneCountry, setFormPhoneCountry] = useState('NP')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formGstPan, setFormGstPan] = useState('')
  const [formBankDetails, setFormBankDetails] = useState('')
  const [formRemarks, setFormRemarks] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active')
  const [formOpeningBalance, setFormOpeningBalance] = useState('0')
  const [formOpeningBalanceDateBs, setFormOpeningBalanceDateBs] = useState(getCurrentBsDate())
  const [formOpeningBalanceDateAd, setFormOpeningBalanceDateAd] = useState(getCurrentAdDate())

  const handleBsDateChange = (val: string) => {
    const slashedVal = val.replace(/-/g, '/')
    setFormOpeningBalanceDateBs(slashedVal)
    try {
      const adDate = bsToAd(slashedVal)
      setFormOpeningBalanceDateAd(adDate.toISOString().split('T')[0])
    } catch {
      // Ignore
    }
  }

  const handleAdDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormOpeningBalanceDateAd(val)
    try {
      const bsDate = adToBs(val)
      setFormOpeningBalanceDateBs(bsDate)
    } catch {
      // Ignore
    }
  }


  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        supplier_code: supplierCode,
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
        opening_balance: Number(formOpeningBalance) || 0,
        opening_balance_date_bs: formOpeningBalanceDateBs,
        opening_balance_date_ad: formOpeningBalanceDateAd,
        date_bs: getCurrentBsDate(),
        date_ad: getCurrentAdDate(),
        time: getCurrentTime(),
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert(payload as any)
        .select()
        .single()

      if (error) throw error
      toast.success('Supplier added successfully')
      router.push(`/suppliers/${data.id}`)
    } catch (error) {
      console.error('Error creating supplier:', error)
      toast.error('Failed to create supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/suppliers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Supplier</h1>
          <p className="text-muted-foreground">Fill in the supplier details</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supplier Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-code">Supplier Code</Label>
                <Input id="supplier-code" value={supplierCode} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Supplier Name *</Label>
                <Input
                  id="supplier-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. ABC Traders"
                  required
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
              <div className="space-y-2">
                <Label htmlFor="opening-balance">Opening Balance</Label>
                <Input
                  id="opening-balance"
                  type="number"
                  value={formOpeningBalance}
                  onChange={(e) => setFormOpeningBalance(e.target.value)}
                  placeholder="e.g. 1500.50"
                />
              </div>
              <div className="space-y-2">
                <Label>Opening Balance Date (BS)</Label>
                <NepaliDatePicker
                  inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formOpeningBalanceDateBs.replace(/\//g, '-')}
                  onChange={handleBsDateChange}
                  options={{ calenderLocale: 'en', valueLocale: 'en' }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-balance-ad">Opening Balance Date (AD)</Label>
                <Input
                  id="opening-balance-ad"
                  type="date"
                  value={formOpeningBalanceDateAd}
                  onChange={handleAdDateChange}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="supplier-bank">Bank Details</Label>
                <Textarea
                  id="supplier-bank"
                  value={formBankDetails}
                  onChange={(e) => setFormBankDetails(e.target.value)}
                  placeholder="Bank name, account number, branch"
                  rows={2}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="supplier-remarks">Remarks</Label>
                <Textarea
                  id="supplier-remarks"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Any additional notes"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Link href="/suppliers">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Supplier
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
