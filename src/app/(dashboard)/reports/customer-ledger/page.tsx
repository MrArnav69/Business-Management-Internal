'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Customer, CustomerBill, CustomerPayment } from '@/types'
import { Button } from '@/components/ui/button'
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
import { formatNPR, getCurrentBsDate, getCurrentTime } from '@/lib/nepali-date'
import { Loader2, TrendingUp, TrendingDown, FileDown, Table as TableIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomerLedgerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <CustomerLedgerContent />
    </Suspense>
  )
}

function CustomerLedgerContent() {
  const searchParams = useSearchParams()
  const initialCustomerId = searchParams.get('customer_id') || ''
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bills, setBills] = useState<CustomerBill[]>([])
  const [payments, setPayments] = useState<CustomerPayment[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId)
  const [loading, setLoading] = useState(true)

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true })
      if (error) throw error
      setCustomers((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to load customers')
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    if (!selectedCustomerId) {
      setBills([])
      setPayments([])
      return
    }
    async function fetchData() {
      setLoading(true)
      try {
        const [billsRes, paymentsRes] = await Promise.all([
          supabase.from('customer_bills').select('*').eq('customer_id', selectedCustomerId).order('date_ad', { ascending: true }),
          supabase.from('customer_payments').select('*').eq('customer_id', selectedCustomerId).order('date_ad', { ascending: true })
        ])
        
        if (billsRes.error) throw billsRes.error
        if (paymentsRes.error) throw paymentsRes.error
        
        setBills(billsRes.data || [])
        setPayments(paymentsRes.data || [])
      } catch (error) {
        console.error('Error fetching ledger data:', error)
        toast.error('Failed to load transactions')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedCustomerId])

  const openingBalance = Number(selectedCustomer?.opening_balance || 0)
  
  const transactions = [
    ...bills.map(b => ({
      id: b.id,
      date_ad: b.date_ad,
      date_bs: b.date_bs,
      type: 'sale',
      ref: b.bill_code,
      increase: Number(b.total_with_vat || 0),
      decrease: 0,
    })),
    ...payments.map(p => ({
      id: p.id,
      date_ad: p.date_ad,
      date_bs: p.date_bs,
      type: 'collection',
      ref: `${p.mode.toUpperCase()}${p.notes ? ` - ${p.notes}` : ''}`,
      increase: 0,
      decrease: Number(p.amount || 0),
    }))
  ].sort((a, b) => new Date(a.date_ad).getTime() - new Date(b.date_ad).getTime())

  let currentRunning = openingBalance
  const ledgerItems = transactions.map(t => {
    currentRunning = currentRunning + t.increase - t.decrease
    return { ...t, balance: currentRunning }
  })

  const totalSales = bills.reduce((sum, b) => sum + Number(b.total_with_vat || 0), 0)
  const totalCollections = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const finalBalance = openingBalance + totalSales - totalCollections

  const downloadPdf = () => {
    if (!selectedCustomer) return
    const doc = new jsPDF()
    
    doc.setFontSize(20)
    doc.text('Customer Ledger Report', 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generated on: ${getCurrentBsDate()} ${getCurrentTime()}`, 14, 30)
    
    doc.setTextColor(0)
    doc.setFontSize(14)
    doc.text(selectedCustomer.name, 14, 45)
    doc.setFontSize(11)
    doc.text(`Code: ${selectedCustomer.customer_code}`, 14, 52)
    doc.text(`Phone: ${selectedCustomer.phone || '—'}`, 14, 58)
    
    doc.setDrawColor(200)
    doc.line(14, 65, 196, 65)
    doc.text('Summary Statistics', 14, 75)
    doc.text(`Opening Balance: NPR ${openingBalance.toLocaleString()}`, 14, 82)
    doc.text(`Total Sales: NPR ${totalSales.toLocaleString()}`, 14, 88)
    doc.text(`Total Collected: NPR ${totalCollections.toLocaleString()}`, 14, 94)
    doc.setFont(undefined, 'bold')
    doc.text(`Closing Balance (Net Receivable): NPR ${finalBalance.toLocaleString()}`, 14, 102)
    doc.setFont(undefined, 'normal')
    
    const tableData = [
      ['Date (BS)', 'Type', 'Reference', 'Sales (+)', 'Collections (-)', 'Balance'],
      [selectedCustomer.opening_balance_date_bs || '—', 'OPENING', 'Forwarded', '—', '—', openingBalance.toLocaleString()],
      ...ledgerItems.map(item => [
        item.date_bs,
        item.type.toUpperCase(),
        item.ref,
        item.increase > 0 ? item.increase.toLocaleString() : '—',
        item.decrease > 0 ? item.decrease.toLocaleString() : '—',
        item.balance.toLocaleString()
      ])
    ]

    autoTable(doc, {
      startY: 110,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' }
      }
    })

    const timestamp = `${getCurrentBsDate().replace(/\//g, '-')}_${getCurrentTime().replace(/:/g, '-')}`
    doc.save(`Ledger_Customer_${selectedCustomer.name.replace(/\s+/g, '_')}_${timestamp}.pdf`)
  }

  const downloadExcel = () => {
    if (!selectedCustomer) return
    
    const infoData = [
      ['Customer Ledger Report'],
      [`Customer: ${selectedCustomer.name} (${selectedCustomer.customer_code})`],
      [`Generated on: ${getCurrentBsDate()} ${getCurrentTime()}`],
      [],
      ['SUMMARY'],
      ['Opening Balance', openingBalance],
      ['Total Sales', totalSales],
      ['Total Collections', totalCollections],
      ['Net Receivable', finalBalance],
      [],
      ['TRANSACTION DETAILS'],
      ['Date (BS)', 'Date (AD)', 'Type', 'Reference', 'Sales (+)', 'Collections (-)', 'Running Balance']
    ]

    const transactionData = [
      [selectedCustomer.opening_balance_date_bs || '—', selectedCustomer.opening_balance_date_ad || '—', 'OPENING', 'Opening Balance Forward', 0, 0, openingBalance],
      ...ledgerItems.map(item => [
        item.date_bs,
        item.date_ad,
        item.type.toUpperCase(),
        item.ref,
        item.increase,
        item.decrease,
        item.balance
      ])
    ]

    const ws = XLSX.utils.aoa_to_sheet([...infoData, ...transactionData])

    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 18 }
    ]

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: R })]
        if (cell && cell.t === 'n') cell.z = '#,##0.00'
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger')
    const timestamp = `${getCurrentBsDate().replace(/\//g, '-')}_${getCurrentTime().replace(/:/g, '-')}`
    XLSX.writeFile(wb, `Ledger_Customer_${selectedCustomer.name.replace(/\s+/g, '_')}_${timestamp}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Ledger</h1>
          <p className="text-muted-foreground">Detailed financial history for individual customers</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a customer" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.customer_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedCustomerId ? (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="py-20 text-center text-muted-foreground">
            Select a customer above to generate the ledger report
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatNPR(openingBalance)}</p>
                {selectedCustomer?.opening_balance_date_bs && (
                  <p className="text-xs text-muted-foreground mt-1">As of {selectedCustomer.opening_balance_date_bs}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-lg font-semibold text-primary">{formatNPR(totalSales)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <p className="text-lg font-semibold text-green-600">{formatNPR(totalCollections)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className={finalBalance > 0 ? 'bg-primary/5 border-primary' : 'bg-green-50 border-green-200'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Net Receivable</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${finalBalance > 0 ? 'text-primary' : 'text-green-700'}`}>
                  {formatNPR(finalBalance)}
                </p>
                <p className="text-[10px] uppercase font-bold mt-1 text-muted-foreground">
                  {finalBalance > 0 ? 'Due from Customer' : 'Advance / Cleared'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Customer Ledger History</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadExcel} className="hidden sm:flex">
                  <TableIcon className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={downloadPdf}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date (BS)</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference / Note</TableHead>
                    <TableHead className="text-right">Sales (+)</TableHead>
                    <TableHead className="text-right">Collections (-)</TableHead>
                    <TableHead className="text-right">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/30 italic">
                    <TableCell colSpan={3}>Opening Balance Forward</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right font-bold">{formatNPR(openingBalance)}</TableCell>
                  </TableRow>
                  {ledgerItems.map((item) => (
                    <TableRow key={`${item.type}-${item.id}`}>
                      <TableCell className="whitespace-nowrap">{item.date_bs}</TableCell>
                      <TableCell>
                        <Badge variant={item.type === 'sale' ? 'outline' : 'secondary'} className="capitalize">
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm font-medium">
                        {item.ref}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.increase > 0 ? formatNPR(item.increase) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {item.decrease > 0 ? formatNPR(item.decrease) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${item.balance > 0 ? 'text-primary' : 'text-green-700'}`}>
                        {formatNPR(item.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
