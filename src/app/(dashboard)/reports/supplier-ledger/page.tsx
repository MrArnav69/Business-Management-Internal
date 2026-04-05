'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { Supplier, SupplierBill } from '@/types'
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

export default function SupplierLedgerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SupplierLedgerContent />
    </Suspense>
  )
}

function SupplierLedgerContent() {
  const searchParams = useSearchParams()
  const initialSupplierId = searchParams.get('supplier_id') || ''
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bills, setBills] = useState<SupplierBill[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId)
  const [loading, setLoading] = useState(true)

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('status', 'active')
        .order('name', { ascending: true })
      if (error) throw error
      setSuppliers((data as any[]) || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  useEffect(() => {
    if (!selectedSupplierId) {
      setBills([])
      setPayments([])
      return
    }
    async function fetchData() {
      setLoading(true)
      try {
        const [billsRes, paymentsRes] = await Promise.all([
          supabase.from('supplier_bills').select('*').eq('supplier_id', selectedSupplierId).order('date_ad', { ascending: true }),
          supabase.from('supplier_payments').select('*').eq('supplier_id', selectedSupplierId).order('date_ad', { ascending: true })
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
  }, [selectedSupplierId])

  // Combine and calculate ledger
  const openingBalance = Number(selectedSupplier?.opening_balance || 0)
  
  const transactions = [
    ...bills.map(b => ({
      id: b.id,
      date_ad: b.date_ad,
      date_bs: b.date_bs,
      type: 'purchase',
      ref: b.bill_code,
      increase: Number(b.total_with_vat || 0),
      decrease: 0,
    })),
    ...payments.map(p => ({
      id: p.id,
      date_ad: p.date_ad,
      date_bs: p.date_bs,
      type: 'payment',
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

  const totalPurchases = bills.reduce((sum, b) => sum + Number(b.total_with_vat || 0), 0)
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const finalBalance = openingBalance + totalPurchases - totalPayments

  const downloadPdf = () => {
    if (!selectedSupplier) return
    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(20)
    doc.text('Supplier Ledger Report', 14, 22)
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30)
    
    // Supplier Info
    doc.setTextColor(0)
    doc.setFontSize(14)
    doc.text(selectedSupplier.name, 14, 45)
    doc.setFontSize(11)
    doc.text(`Code: ${selectedSupplier.supplier_code}`, 14, 52)
    doc.text(`Phone: ${selectedSupplier.phone}`, 14, 58)
    
    // Summary Cards
    doc.setDrawColor(200)
    doc.line(14, 65, 196, 65)
    doc.text('Summary Statistics', 14, 75)
    doc.text(`Opening Balance: NPR ${openingBalance.toLocaleString()}`, 14, 82)
    doc.text(`Total Purchases: NPR ${totalPurchases.toLocaleString()}`, 14, 88)
    doc.text(`Total Payments: NPR ${totalPayments.toLocaleString()}`, 14, 94)
    doc.setFont(undefined, 'bold')
    doc.text(`Closing Balance: NPR ${finalBalance.toLocaleString()}`, 14, 102)
    doc.setFont(undefined, 'normal')
    
    // Table
    const tableData = [
      ['Date (BS)', 'Type', 'Reference', 'Purchase (+)', 'Payment (-)', 'Balance'],
      [selectedSupplier.opening_balance_date_bs || '—', 'OPENING', 'Forwarded', '—', '—', openingBalance.toLocaleString()],
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
    doc.save(`Ledger_${selectedSupplier.name.replace(/\s+/g, '_')}_${timestamp}.pdf`)
  }

  const downloadExcel = () => {
    if (!selectedSupplier) return
    
    // Header info
    const infoData = [
      ['Supplier Ledger Report'],
      [`Supplier: ${selectedSupplier.name} (${selectedSupplier.supplier_code})`],
      [`Generated on: ${getCurrentBsDate()} ${getCurrentTime()}`],
      [],
      ['SUMMARY'],
      ['Opening Balance', openingBalance],
      ['Total Purchases', totalPurchases],
      ['Total Payments', totalPayments],
      ['Closing Balance (Owed)', finalBalance],
      [],
      ['TRANSACTION DETAILS'],
      ['Date (BS)', 'Date (AD)', 'Type', 'Reference', 'Purchase (+)', 'Payment (-)', 'Running Balance']
    ]

    // Transaction rows
    const transactionData = [
      [selectedSupplier.opening_balance_date_bs || '—', selectedSupplier.opening_balance_date_ad || '—', 'OPENING', 'Opening Balance Forward', 0, 0, openingBalance],
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

    // Set Column Widths
    ws['!cols'] = [
      { wch: 12 }, // Date BS
      { wch: 12 }, // Date AD
      { wch: 12 }, // Type
      { wch: 30 }, // Reference
      { wch: 15 }, // Purchase
      { wch: 15 }, // Payment
      { wch: 18 }  // Balance
    ]

    // Apply Number Formatting to currency columns
    // We iterate through entries in the sheet; Purchase is col E (4), Payment col F (5), Balance col G (6)
    // Summary values are also at col B (1) in rows 6-9
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R }
        const cell_ref = XLSX.utils.encode_cell(cell_address)
        const cell = ws[cell_ref]
        
        if (!cell || cell.t !== 'n') continue

        // Apply currency format #,##0.00
        cell.z = '#,##0.00'
      }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger')
    const timestamp = `${getCurrentBsDate().replace(/\//g, '-')}_${getCurrentTime().replace(/:/g, '-')}`
    XLSX.writeFile(wb, `Ledger_${selectedSupplier.name.replace(/\s+/g, '_')}_${timestamp}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Ledger</h1>
          <p className="text-muted-foreground">Detailed transaction-by-transaction history</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a supplier" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.supplier_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSupplierId ? (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="py-20 text-center text-muted-foreground">
            Select a supplier above to generate the ledger report
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
                {selectedSupplier?.opening_balance_date_bs && (
                  <p className="text-xs text-muted-foreground mt-1">As of {selectedSupplier.opening_balance_date_bs}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <p className="text-lg font-semibold text-blue-600">{formatNPR(totalPurchases)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <p className="text-lg font-semibold text-green-600">{formatNPR(totalPayments)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className={finalBalance > 0 ? 'bg-destructive/5 border-destructive' : 'bg-green-50 border-green-200'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Balance Owed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl font-bold ${finalBalance > 0 ? 'text-destructive' : 'text-green-700'}`}>
                  {formatNPR(finalBalance)}
                </p>
                <p className="text-[10px] uppercase font-bold mt-1 text-muted-foreground">
                  {finalBalance > 0 ? 'Payable to Supplier' : 'Advance / Cleared'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Transaction Ledger</CardTitle>
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
                    <TableHead className="text-right">Purchase (+)</TableHead>
                    <TableHead className="text-right">Payment (-)</TableHead>
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
                        <Badge variant={item.type === 'purchase' ? 'outline' : 'secondary'} className="capitalize">
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
                      <TableCell className={`text-right font-bold ${item.balance > 0 ? 'text-foreground' : 'text-green-700'}`}>
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
