'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { VAT_RATE } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Save, Percent, UserCog } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [vatRate, setVatRate] = useState(String(VAT_RATE * 100))
  const [savingVat, setSavingVat] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [autoBackup, setAutoBackup] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)


  

  useEffect(() => {
    const stored = localStorage.getItem('retail-settings')
    if (stored) {
      try {
        const prefs = JSON.parse(stored)
        if (prefs.darkMode !== undefined) setDarkMode(prefs.darkMode)
        if (prefs.emailNotifications !== undefined) setEmailNotifications(prefs.emailNotifications)
        if (prefs.autoBackup !== undefined) setAutoBackup(prefs.autoBackup)
      } catch {
        // ignore
      }
    }
  }, [])

  const handleSaveVat = async () => {
    const rate = Number(vatRate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Please enter a valid VAT rate (0-100)')
      return
    }
    setSavingVat(true)
    try {
      localStorage.setItem('retail-vat-rate', String(rate / 100))
      toast.success(`VAT rate updated to ${rate}%`)
    } catch (error) {
      console.error('Error saving VAT rate:', error)
      toast.error('Failed to save VAT rate')
    } finally {
      setSavingVat(false)
    }
  }

  const handleSavePrefs = async () => {
    setSavingPrefs(true)
    try {
      localStorage.setItem(
        'retail-settings',
        JSON.stringify({
          darkMode,
          emailNotifications,
          autoBackup,
        })
      )
      toast.success('Preferences saved successfully')
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error('Failed to save preferences')
    } finally {
      setSavingPrefs(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure your retail management system</p>
      </div>

      <Tabs defaultValue="tax">
        <TabsList>
          <TabsTrigger value="tax">
            <Percent className="mr-2 h-4 w-4" />
            Tax Configuration
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <UserCog className="mr-2 h-4 w-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tax">
          <Card>
            <CardHeader>
              <CardTitle>VAT Configuration</CardTitle>
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
              <Button onClick={handleSaveVat} disabled={savingVat}>
                {savingVat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save VAT Rate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>User Preferences</CardTitle>
              <CardDescription>
                Customize your experience and notification settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle dark mode for the interface
                  </p>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications for important events
                  </p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Backup</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically backup data daily
                  </p>
                </div>
                <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
              </div>
              <Button onClick={handleSavePrefs} disabled={savingPrefs}>
                {savingPrefs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
