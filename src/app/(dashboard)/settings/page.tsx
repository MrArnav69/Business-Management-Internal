'use client'

import { useState } from 'react'
import { VAT_RATE } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Save, Percent } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [vatRate, setVatRate] = useState(String(VAT_RATE * 100))
  const [saving, setSaving] = useState(false)

  const handleSaveVat = async () => {
    const rate = Number(vatRate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Please enter a valid VAT rate (0-100)')
      return
    }
    setSaving(true)
    try {
      localStorage.setItem('retail-vat-rate', String(rate / 100))
      toast.success(`VAT rate updated to ${rate}%`)
    } catch (error) {
      console.error('Error saving VAT rate:', error)
      toast.error('Failed to save VAT rate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your retail management system</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Tax Configuration
          </CardTitle>
          <CardDescription>
            Configure the VAT rate applied to supplier bills and sales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vat-rate">VAT Rate (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="vat-rate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="w-32"
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Current default: {(VAT_RATE * 100).toFixed(0)}% (Nepal standard VAT rate)
            </p>
          </div>
          <Button onClick={handleSaveVat} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save VAT Rate
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}