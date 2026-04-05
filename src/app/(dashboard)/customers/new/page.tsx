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

export default function NewCustomerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [customerCode, setCustomerCode] = useState('Generating...')

  useEffect(() => {
    const fetchLatestCustomerCode = async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('customer_code')
        .order('created_at', { ascending: false })
        .limit(1)
      
      let nextCode = 'CUST-0001'
      if (!error && data && data.length > 0 && data[0].customer_code) {
        const lastCode = data[0].customer_code
        if (lastCode.startsWith('CUST-')) {
          const num = parseInt(lastCode.replace('CUST-', ''), 10)
          if (!isNaN(num)) {
            nextCode = `CUST-${String(num + 1).padStart(4, '0')}`
          }
        }
      }
      setCustomerCode(nextCode)
    }
    fetchLatestCustomerCode()
  }, [])

  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPhoneCountry, setFormPhoneCountry] = useState('NP')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formGstPan, setFormGstPan] = useState('')
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
      toast.error('Customer name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        customer_code: customerCode,
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
        opening_balance_date_bs: formOpeningBalanceDateBs,
        opening_balance_date_ad: formOpeningBalanceDateAd,
        date_bs: getCurrentBsDate(),
        date_ad: getCurrentAdDate(),
        time: getCurrentTime(),
      }

      const { data, error } = await supabase
        .from('customers')
        .insert(payload as any)
        .select()
        .single()

      if (error) throw error
      toast.success('Customer added successfully')
      router.push(`/customers/${data.id}`)
    } catch (error) {
      console.error('Error creating customer:', error)
      toast.error('Failed to create customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Customer</h1>
          <p className="text-muted-foreground">Register a new customer profile</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-code">Customer Code</Label>
                <Input id="customer-code" value={customerCode} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer Name *</Label>
                <Input
                  id="customer-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. 9800000000"
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
                <Label htmlFor="opening-balance">Opening Balance (Receivable)</Label>
                <Input
                  id="opening-balance"
                  type="number"
                  value={formOpeningBalance}
                  onChange={(e) => setFormOpeningBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Opening Balance Date (BS)</Label>
                <NepaliDatePicker
                  inputClassName="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                <Label htmlFor="customer-remarks">Remarks</Label>
                <Textarea
                  id="customer-remarks"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Any additional notes"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Link href="/customers">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Customer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
